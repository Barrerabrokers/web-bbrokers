import { NextRequest, NextResponse } from "next/server";
import {
  importMetaLeadgenId,
  verifyMetaSignature,
  type MetaLeadWebhookValue,
} from "@/lib/meta-leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MetaWebhookChange = {
  field?: string;
  value?: MetaLeadWebhookValue;
};

type MetaWebhookEntry = {
  changes?: MetaWebhookChange[];
};

type MetaWebhookPayload = {
  object?: string;
  entry?: MetaWebhookEntry[];
};

function leadgenChanges(payload: MetaWebhookPayload) {
  return (payload.entry || [])
    .flatMap((entry) => entry.changes || [])
    .filter((change) => change.field === "leadgen" && change.value?.leadgen_id);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const expectedToken = process.env.META_VERIFY_TOKEN;

  if (!expectedToken) {
    return new NextResponse("Falta META_VERIFY_TOKEN", { status: 500 });
  }

  if (mode === "subscribe" && token === expectedToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Token de verificación inválido", { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyMetaSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Firma Meta inválida" }, { status: 403 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  if (payload.object !== "page") {
    return NextResponse.json({ received: true, ignored: true });
  }

  const changes = leadgenChanges(payload);
  const results = [];

  for (const change of changes) {
    const leadgenId = change.value?.leadgen_id;
    if (!leadgenId) continue;

    try {
      const result = await importMetaLeadgenId(leadgenId, {
        webhookValue: change.value,
      });
      results.push({ leadgenId, ...result });
    } catch (error) {
      console.error("Error importing Meta lead:", error);
      results.push({
        leadgenId,
        error: error instanceof Error ? error.message : "No se pudo importar el lead",
      });
    }
  }

  return NextResponse.json({
    received: true,
    processed: results.length,
    results,
  });
}
