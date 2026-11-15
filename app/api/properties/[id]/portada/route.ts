import sharp from "sharp";
import { getPropertyById } from "@/lib/db";
import { canReadListing } from "@/lib/listing-visibility-policy";
import { hasValidShareToken } from "@/lib/share-token";
import { absoluteUrl, SITE_URL } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const property = await getPropertyById(id);
  const shared = hasValidShareToken(new URL(request.url).searchParams.get("share"), "property", id);
  if (!property || !canReadListing(property.visibility, undefined, shared) || !property.images[0]) {
    return new Response(null, { status: 404 });
  }
  try {
    // Only fetch stored covers from our media hosts; never accept a remote URL parameter.
    const source = new URL(absoluteUrl(property.images[0]));
    const storage = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lmpbugahpcktnrybmdqx.supabase.co";
    const allowed = new Set([new URL(storage).hostname, new URL(SITE_URL).hostname, "images.unsplash.com"]);
    if (source.protocol !== "https:" || source.port || source.username || source.password || !allowed.has(source.hostname)) {
      return new Response(null, { status: 404 });
    }
    const upstream = await fetch(source, { redirect: "error", signal: AbortSignal.timeout(10000) });
    if (!upstream.ok || !upstream.headers.get("content-type")?.startsWith("image/")) {
      return new Response(null, { status: 502 });
    }
    const input = Buffer.from(await upstream.arrayBuffer());
    if (input.length > 20 * 1024 * 1024) return new Response(null, { status: 413 });
    const image = sharp(input, { limitInputPixels: 40000000 }).rotate().resize(1200, 630, { fit: "cover" }).flatten({ background: "#ffffff" });
    for (const quality of [78, 60, 42, 25]) {
      const output = await image.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
      if (output.length <= 250000) {
        return new Response(new Uint8Array(output), { headers: {
          "Content-Type": "image/jpeg",
          "Content-Length": String(output.length),
          "Cache-Control": "public, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        } });
      }
    }
    return new Response(null, { status: 422 });
  } catch {
    return new Response(null, { status: 502 });
  }
}
