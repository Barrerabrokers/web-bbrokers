type ListingEmailDraft = {
  title: string;
  pageUrl: string;
  pdfUrl: string;
  image: Uint8Array;
};

function base64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function encodedText(value: string) {
  return base64(new TextEncoder().encode(value)).match(/.{1,76}/g)?.join("\r\n") || "";
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function buildListingEmailDraft({ title, pageUrl, pdfUrl, image }: ListingEmailDraft) {
  for (const link of [pageUrl, pdfUrl]) {
    if (new URL(link).protocol !== "https:") throw new Error("Enlace de ficha inválido.");
  }
  if (image.length > 250000 || image[0] !== 0xff || image[1] !== 0xd8) throw new Error("La portada no es un JPEG válido.");
  const related = `bb-related-${crypto.randomUUID()}`;
  const alternative = `bb-alternative-${crypto.randomUUID()}`;
  const subject = Array.from(`Ficha de propiedad - ${title.replace(/[\r\n]/g, " ")}`).reduce<string[]>((parts, character, index) => {
    const part = Math.floor(index / 12);
    parts[part] = (parts[part] || "") + character;
    return parts;
  }, []).map(part => `=?UTF-8?B?${base64(new TextEncoder().encode(part))}?=`).join("\r\n ");
  const text = `Hola,\n\nTe comparto esta propiedad: ${title}\n\nVer ficha: ${pageUrl}\n\nVer PDF: ${pdfUrl}\n\nBarrera Brokers`;
  const html = `<!doctype html><html><body style="margin:0;background:#f5f2ec;font-family:Arial,Helvetica,sans-serif;color:#171717"><table role="presentation" style="width:100%;max-width:600px;margin:24px auto;background:#fff" cellpadding="0" cellspacing="0"><tr><td style="padding:24px;font-size:18px;font-weight:bold">Barrera Brokers</td></tr><tr><td><a href="${escapeHtml(pageUrl)}"><img src="cid:listing-cover@barrerabrokers.com" alt="${escapeHtml(title)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0"></a></td></tr><tr><td style="padding:24px"><p>Hola, te comparto esta propiedad:</p><h1 style="font-size:24px;line-height:1.3">${escapeHtml(title)}</h1><p style="margin:24px 0"><a href="${escapeHtml(pageUrl)}" style="display:inline-block;padding:14px 22px;background:#171717;color:#fff;text-decoration:none">Ver propiedad</a></p><p><a href="${escapeHtml(pdfUrl)}" style="color:#171717">Ver ficha PDF</a></p></td></tr></table></body></html>`;
  return [
    "X-Unsent: 1", "MIME-Version: 1.0", `Subject: ${subject}`, "To: ",
    `Content-Type: multipart/related; boundary="${related}"`, "",
    `--${related}`, `Content-Type: multipart/alternative; boundary="${alternative}"`, "",
    `--${alternative}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", encodedText(text),
    `--${alternative}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", encodedText(html), `--${alternative}--`,
    `--${related}`, "Content-Type: image/jpeg; name=portada.jpg", "Content-Transfer-Encoding: base64", "Content-ID: <listing-cover@barrerabrokers.com>", 'Content-Disposition: inline; filename="portada.jpg"', "", base64(image).match(/.{1,76}/g)?.join("\r\n") || "", `--${related}--`, "",
  ].join("\r\n");
}

export async function downloadListingEmailDraft(input: { title: string; pageUrl: string; pdfUrl: string; coverUrl: string }) {
  const response = await fetch(input.coverUrl);
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/jpeg")) throw new Error("No se pudo cargar la portada. Intentá nuevamente.");
  const image = new Uint8Array(await response.arrayBuffer());
  const draft = buildListingEmailDraft({ ...input, image });
  const url = URL.createObjectURL(new Blob([draft], { type: "message/rfc822" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `ficha-${input.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 80)}.eml`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
