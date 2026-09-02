import nodemailer from "nodemailer";
import type { CrmEmailTemplateContentBlock, CrmLead } from "@/lib/db";
import {
  createCrmActivity,
  createCrmEmailAttachmentTracking,
  createCrmEmailTracking,
  getCrmEmailAccountWithSecret,
  type CrmEmailAccountWithSecret,
} from "@/lib/db";
import { friendlySmtpError } from "@/lib/crm-email-errors";
import { getAccessTokenForGoogleAccount } from "@/lib/google-oauth";

type EmailContentBlock = CrmEmailTemplateContentBlock;

type SendCrmEmailInput = {
  lead: CrmLead;
  agentId: string;
  subject: string;
  body: string;
  imageUrls?: string[];
  contentBlocks?: EmailContentBlock[];
  baseUrl?: string;
  activityTitle?: string;
  workflowName?: string;
};

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function sanitizeHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

function textParagraphsToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim())
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

function blocksToText(blocks: EmailContentBlock[]) {
  return blocks
    .map((block) => {
      if (block.type === "text") return block.text;
      if (block.type === "button") return `${block.label}: ${block.url}`;
      if (block.type === "attachment") return `${block.name}: ${block.url}`;
      if (block.type === "image") return block.url;
      if (block.type === "columns") return block.columns.map((column) => column.type === "text" ? column.text : column.url).join("\n");
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function emailActivityBody(blocks: EmailContentBlock[], fallbackBody: string, fallbackImages: string[]) {
  const text = blocks.length > 0
    ? blocks
        .flatMap((block) => {
          if (block.type === "text") return [block.text];
          if (block.type === "button") return [block.label];
          if (block.type === "attachment") return [`Adjunto: ${block.name}`];
          if (block.type === "columns") return block.columns
            .filter((column) => column.type === "text")
            .map((column) => column.text);
          return [];
        })
        .filter(Boolean)
        .join("\n\n")
    : fallbackBody;
  const images = blocks.length > 0
    ? blocks.flatMap((block) => block.type === "image"
        ? [block.url]
        : block.type === "columns"
          ? block.columns.filter((column) => column.type === "image").map((column) => column.url)
          : [])
    : fallbackImages;
  return [text, ...images.map((url) => `[[BB_EMAIL_IMAGE:${url}]]`)].filter(Boolean).join("\n\n");
}

function blocksToHtml(blocks: EmailContentBlock[], attachmentTrackingUrls = new Map<string, string>()) {
  const safeColor = (value: string | undefined, fallback: string) =>
    value?.match(/^#[0-9a-f]{6}$/i) ? value : fallback;
  const safeFont = (value: string | undefined) =>
    value?.replace(/[;"<>]/g, "").slice(0, 90) || "Arial,Helvetica,sans-serif";
  const safeAlign = (value: "left" | "center" | "right" | undefined) => value || "left";

  const blocksHtml = blocks
    .map((block) => {
      if (block.type === "text") {
        const color = safeColor(block.color, "#1c1a17");
        const backgroundColor = safeColor(block.backgroundColor, "transparent");
        const padding = Math.min(80, Math.max(0, Math.round(block.padding || 0)));
        const fontSize = Math.min(64, Math.max(10, Math.round(block.fontSize || 16)));
        const align = safeAlign(block.align);
        const html = block.html?.trim() ? sanitizeHtml(block.html) : textParagraphsToHtml(block.text);
        return `<div style="color:${color};background:${backgroundColor};font-family:${safeFont(block.fontFamily)};font-size:${fontSize}px;text-align:${align};padding:${padding}px;margin:0 0 10px 0;">${html}</div>`;
      }

      if (block.type === "columns") {
        const gap = Math.min(48, Math.max(0, Math.round(block.gap ?? 20)));
        const widths = block.widths?.length === block.columns.length
          ? block.widths
          : block.columns.map(() => 100 / block.columns.length);
        const cells = block.columns.map((column, index) => {
          const width = widths[index] || 100 / block.columns.length;
          if (column.type === "image") {
            const url = column.url.replaceAll('"', "%22");
            const radius = Math.min(40, Math.max(0, Math.round(column.borderRadius ?? 8)));
            return `<td class="bb-email-column" width="${Math.round(width)}%" valign="top" style="width:${width}%;padding:${gap / 2}px;max-width:${width}%;"><img src="${url}" alt="${escapeHtml(column.alt || "")}" style="display:block;width:100%;max-width:100%;height:auto;border-radius:${radius}px;" /></td>`;
          }
          const content = `<div style="color:${safeColor(column.color, "#1c1a17")};font-family:${safeFont(column.fontFamily)};font-size:${Math.min(64, Math.max(10, Math.round(column.fontSize || 16)))}px;font-weight:${column.bold ? 700 : 400};text-align:${safeAlign(column.align)};line-height:1.55;">${column.html?.trim() ? sanitizeHtml(column.html) : textParagraphsToHtml(column.text)}</div>`;
          return `<td class="bb-email-column" width="${Math.round(width)}%" valign="top" style="width:${width}%;padding:${gap / 2}px;max-width:${width}%;overflow-wrap:anywhere;word-break:break-word;">${content}</td>`;
        }).join("");
        return `<table class="bb-email-columns" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;margin:8px 0 16px;"><tr>${cells}</tr></table>`;
      }

      if (block.type === "button") {
        const align = safeAlign(block.align);
        const background = safeColor(block.backgroundColor, "#005c5c");
        const textColor = safeColor(block.textColor, "#ffffff");
        const radius = Math.min(40, Math.max(0, Math.round(block.borderRadius || 999)));
        const url =
          block.url.startsWith("http") || block.url.startsWith("mailto:") || block.url.startsWith("tel:")
            ? block.url
            : `https://${block.url}`;
        return `<div style="text-align:${align};margin:20px 0;"><a href="${url.replaceAll('"', "%22")}" style="display:inline-block;background:${background};color:${textColor};text-decoration:none;border-radius:${radius}px;padding:13px 22px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(block.label)}</a></div>`;
      }

      if (block.type === "divider") {
        const color = safeColor(block.color, "#d8d1c6");
        const thickness = Math.min(12, Math.max(1, Math.round(block.thickness || 1)));
        const width = Math.min(100, Math.max(20, Math.round(block.width || 100)));
        return `<hr style="border:0;border-top:${thickness}px solid ${color};width:${width}%;margin:24px auto;" />`;
      }

      if (block.type === "spacer") {
        const height = Math.min(160, Math.max(8, Math.round(block.height || 24)));
        return `<div style="height:${height}px;line-height:${height}px;font-size:1px;">&nbsp;</div>`;
      }

      if (block.type === "attachment") {
        const trackedUrl = attachmentTrackingUrls.get(block.id) || block.url;
        return `<p style="margin:16px 0;"><a href="${trackedUrl.replaceAll('"', "%22")}" style="color:#005c5c;text-decoration:underline;">${escapeHtml(block.name)}</a></p>`;
      }

      const width = Math.min(100, Math.max(20, Math.round(block.width || 100)));
      const margin =
        block.align === "left"
          ? "10px auto 10px 0"
          : block.align === "right"
            ? "10px 0 10px auto"
            : "10px auto";
      const radius = Math.min(40, Math.max(0, Math.round(block.borderRadius || 12)));
      const image = `<img src="${block.url.replaceAll('"', "%22")}" alt="${escapeHtml(block.alt || "")}" style="display:block;width:${width}%;max-width:640px;height:auto;margin:${margin};border-radius:${radius}px;" />`;
      const imageLink = block.linkUrl?.startsWith("http") ? block.linkUrl : "";
      const linkedImage = imageLink
        ? `<a href="${imageLink.replaceAll('"', "%22")}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">${image}</a>`
        : image;
      const caption = block.caption
        ? `<p style="margin:-8px 0 20px;text-align:${block.align || "center"};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;color:#625f59;">${escapeHtml(block.caption)}</p>`
        : "";
      return `${linkedImage}${caption}`;
    })
    .join("");

  return `
    <style>
      .bb-email-content p { margin-top: 0; margin-bottom: 14px; }
      .bb-email-content h1, .bb-email-content h2, .bb-email-content h3 { margin-top: 0; margin-bottom: 12px; line-height: 1.2; }
      @media only screen and (max-width: 600px) {
        .bb-email-shell { padding: 0 !important; }
        .bb-email-card { width: 100% !important; max-width: 100% !important; }
        .bb-email-content { padding: 14px 16px !important; font-size: 15px !important; line-height: 1.45 !important; }
        .bb-email-columns, .bb-email-columns tbody, .bb-email-columns tr { display: block !important; width: 100% !important; height: auto !important; }
        .bb-email-column { display: block !important; box-sizing: border-box !important; width: 100% !important; max-width: 100% !important; padding: 5px 0 !important; }
        .bb-email-column img { display: block !important; width: 100% !important; max-width: 100% !important; height: auto !important; margin: 0 auto !important; }
        .bb-email-column > div { font-size: 16px !important; line-height: 1.45 !important; }
        .bb-email-content p { margin-bottom: 12px !important; }
        .bb-email-content h1 { font-size: 28px !important; }
        .bb-email-content h2 { font-size: 24px !important; }
        .bb-email-content h3 { font-size: 20px !important; }
      }
    </style>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f3f4f4;margin:0;padding:0;"><tr><td class="bb-email-shell" align="center" style="padding:12px 8px;">
      <table class="bb-email-card" role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;background:#ffffff;margin:0 auto;"><tr><td class="bb-email-content" style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1c1a17;">
        ${blocksHtml}
      </td></tr></table>
    </td></tr></table>
  `;
}

function textToHtml(value: string, imageUrls: string[] = []) {
  const textHtml = value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
    .join("");
  const imagesHtml = imageUrls
    .map(
      (url) =>
        `<img src="${url.replaceAll('"', "%22")}" alt="" style="display:block;width:100%;max-width:640px;height:auto;margin:18px 0;border-radius:12px;" />`
    )
    .join("");

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#1c1a17;">
      ${textHtml}
      ${imagesHtml}
    </div>
  `;
}

function withOpenTrackingPixel(html: string, trackingUrl?: string) {
  if (!trackingUrl) return html;
  const pixel = `<img src="${trackingUrl.replaceAll('"', "%22")}" width="1" height="1" alt="" style="display:none!important;width:1px!important;height:1px!important;opacity:0!important;overflow:hidden!important;" />`;
  return `${html}\n${pixel}`;
}

function base64Url(value: Buffer) {
  return value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sendMailWithGoogleApi({
  account,
  origin,
  mail,
}: {
  account: CrmEmailAccountWithSecret;
  origin: string;
  mail: Parameters<ReturnType<typeof nodemailer.createTransport>["sendMail"]>[0];
}) {
  const accessToken = await getAccessTokenForGoogleAccount({ origin, account });
  const streamTransport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
  });
  const info = (await streamTransport.sendMail(mail)) as { message?: Buffer | string };
  const message = Buffer.isBuffer(info.message)
    ? info.message
    : Buffer.from(String(info.message || ""), "utf8");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: base64Url(message) }),
  });
  const data = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!response.ok) {
    throw new Error(data?.error?.message || "Gmail no pudo enviar el correo.");
  }
}

async function sendMailWithAccount({
  account,
  origin,
  mail,
}: {
  account: CrmEmailAccountWithSecret;
  origin: string;
  mail: Parameters<ReturnType<typeof nodemailer.createTransport>["sendMail"]>[0];
}) {
  if (account.provider === "google-oauth") {
    await sendMailWithGoogleApi({ account, origin, mail });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpSecure,
    auth: {
      user: account.smtpUser,
      pass: account.smtpPassword,
    },
  });
  await transporter.sendMail(mail);
}

export async function sendCrmEmail({
  lead,
  agentId,
  subject,
  body,
  imageUrls = [],
  contentBlocks = [],
  baseUrl = "",
  activityTitle,
  workflowName,
}: SendCrmEmailInput) {
  const account = await getCrmEmailAccountWithSecret(agentId);
  if (!account) {
    return {
      sent: false,
      activity: null,
      error: "Primero conectá el correo personal del agente propietario del contacto.",
    };
  }

  const bodyWithSignature = [body, account.signature].filter(Boolean).join("\n\n");
  const blocksWithSignature =
    contentBlocks.length > 0
      ? [
          ...contentBlocks,
          ...(account.signature
            ? [
                {
                  id: "signature",
                  type: "text" as const,
                  text: account.signature,
                },
              ]
            : []),
        ]
      : [];

  const { tracking } = await createCrmEmailTracking({
    leadId: lead.id,
    agentId,
    recipientEmail: lead.email,
    subject,
  });
  const trackingUrl =
    tracking && baseUrl ? `${baseUrl}/api/crm/email/open/${tracking.trackingId}.png` : undefined;
  const attachmentTrackingUrls = new Map<string, string>();

  await Promise.all(
    blocksWithSignature
      .filter((block): block is Extract<EmailContentBlock, { type: "attachment" }> => block.type === "attachment")
      .map(async (block) => {
        if (!baseUrl) return;
        const { tracking: attachmentTracking } = await createCrmEmailAttachmentTracking({
          emailTrackingId: tracking?.id,
          leadId: lead.id,
          agentId,
          fileName: block.name,
          fileUrl: block.url,
        });

        if (attachmentTracking) {
          attachmentTrackingUrls.set(
            block.id,
            `${baseUrl}/api/crm/email/attachment/${attachmentTracking.trackingId}`
          );
        }
      })
  );

  try {
    const attachments = blocksWithSignature
      .filter((block): block is Extract<EmailContentBlock, { type: "attachment" }> => block.type === "attachment")
      .map((block) => ({
        filename: block.name,
        path: block.url,
      }));

    await sendMailWithAccount({
      account,
      origin: baseUrl || process.env.NEXTAUTH_URL || "http://localhost:3000",
      mail: {
      from: account.fromName
        ? `"${account.fromName.replaceAll('"', "")}" <${account.email}>`
        : account.email,
      to: lead.email,
      subject,
      text:
        blocksWithSignature.length > 0
          ? blocksToText(blocksWithSignature)
          : [bodyWithSignature, ...imageUrls].filter(Boolean).join("\n\n"),
      html: withOpenTrackingPixel(
        blocksWithSignature.length > 0
          ? blocksToHtml(blocksWithSignature, attachmentTrackingUrls)
          : textToHtml(bodyWithSignature, imageUrls),
        trackingUrl
      ),
      attachments,
      },
    });

    const { activity, error: activityError } = await createCrmActivity({
      leadId: lead.id,
      type: "correo",
      title: activityTitle || `Correo enviado: ${subject}`,
      body:
        emailActivityBody(blocksWithSignature, bodyWithSignature, imageUrls),
      scheduledAt: new Date().toISOString(),
      createdBy: agentId,
      externalSource: workflowName ? "crm_workflow" : null,
      externalId: tracking ? `email-tracking:${tracking.id}` : null,
    });

    return {
      sent: true,
      activity,
      error: activity ? null : activityError || "El correo se envió, pero no se pudo registrar.",
    };
  } catch (error) {
    console.error("CRM email send error:", error);
    return {
      sent: false,
      activity: null,
      error: friendlySmtpError(error),
    };
  }
}
