type PdfLine = {
  text: string;
  size?: number;
  bold?: boolean;
  muted?: boolean;
  gapAfter?: number;
};

type PdfLink = {
  label: string;
  url: string;
};

export type PdfImage = {
  data: Buffer;
  width: number;
  height: number;
  label?: string;
  mimeType: "image/jpeg";
};

type TextPdfOptions = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  lines: PdfLine[];
  links?: PdfLink[];
  images?: PdfImage[];
  footer?: string;
  singlePage?: boolean;
  imageVariant?: "standard" | "compact";
  titleSize?: number;
  subtitleSize?: number;
};

type QuotePdfTableRow = {
  label: string;
  value: string;
};

export type QuotePresentationPdfOptions = {
  title: string;
  planLabel: string;
  unitLabel: string;
  subtitle?: string;
  features: string[];
  tableRows: QuotePdfTableRow[];
  images?: PdfImage[];
  footer?: string;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 54;
const MARGIN_TOP = 58;
const MARGIN_BOTTOM = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapText(text: string, size: number, maxWidth = CONTENT_WIDTH) {
  const normalized = normalizeText(text);
  const words = normalized.split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  const averageCharWidth = size * 0.48;
  const maxChars = Math.max(24, Math.floor(maxWidth / averageCharWidth));

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function pdfDate() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `D:${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function createTextPdf({
  title,
  subtitle,
  eyebrow = "Barrera Brokers",
  lines,
  links = [],
  images = [],
  footer = "barrerabrokers.com",
  singlePage = false,
  imageVariant = "standard",
  titleSize = 28,
  subtitleSize = 13,
}: TextPdfOptions) {
  const pages: string[] = [];
  let commands: string[] = [];
  let y = MARGIN_TOP;
  const imageRefs = images.slice(0, 5).map((image, index) => ({
    ...image,
    name: `Im${index + 1}`,
  }));

  const startPage = () => {
    commands = [
      "q",
      "0.957 0.93 0.88 rg",
      `0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f`,
      "Q",
      "0.09 0.11 0.13 rg",
    ];
    y = MARGIN_TOP;
  };

  const finishPage = () => {
    commands.push(
      "0.45 0.39 0.34 rg",
      "BT",
      "/F1 9 Tf",
      `1 0 0 1 ${MARGIN_X} ${MARGIN_BOTTOM - 14} Tm`,
      `(${escapePdfText(normalizeText(footer))}) Tj`,
      "ET"
    );
    pages.push(commands.join("\n"));
  };

  const ensureSpace = (height: number) => {
    if (y + height <= PAGE_HEIGHT - MARGIN_BOTTOM) return true;
    if (singlePage) return false;
    finishPage();
    startPage();
    return true;
  };

  const drawTextLine = (text: string, size: number, bold = false, muted = false) => {
    commands.push(
      muted ? "0.45 0.39 0.34 rg" : "0.09 0.11 0.13 rg",
      "BT",
      `/${bold ? "F2" : "F1"} ${size} Tf`,
      `${size * 1.22} TL`,
      `1 0 0 1 ${MARGIN_X} ${PAGE_HEIGHT - y} Tm`,
      `(${escapePdfText(text)}) Tj`,
      "ET"
    );
  };

  const addParagraph = ({ text, size = 11, bold = false, muted = false, gapAfter = 7 }: PdfLine) => {
    const wrapped = wrapText(text, size);
    if (!ensureSpace(wrapped.length * size * 1.38 + gapAfter)) return;
    for (const line of wrapped) {
      drawTextLine(line, size, bold, muted);
      y += size * 1.38;
    }
    y += gapAfter;
  };

  const drawImage = (
    image: (typeof imageRefs)[number],
    boxX: number,
    boxTop: number,
    boxWidth: number,
    boxHeight: number
  ) => {
    const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const drawX = boxX + (boxWidth - drawWidth) / 2;
    const drawY = PAGE_HEIGHT - boxTop - boxHeight + (boxHeight - drawHeight) / 2;

    commands.push(
      "q",
      "0.88 0.83 0.76 rg",
      `${boxX.toFixed(2)} ${(PAGE_HEIGHT - boxTop - boxHeight).toFixed(2)} ${boxWidth.toFixed(
        2
      )} ${boxHeight.toFixed(2)} re f`,
      "Q",
      "q",
      `${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(
        2
      )} cm`,
      `/${image.name} Do`,
      "Q"
    );
  };

  const addImageGrid = () => {
    if (!imageRefs.length) return;

    const compact = imageVariant === "compact";
    addParagraph({
      text: "Fotos",
      size: compact ? 11 : 14,
      bold: true,
      gapAfter: compact ? 5 : 8,
    });

    const gap = compact ? 8 : 12;
    const cellWidth = (CONTENT_WIDTH - gap) / 2;
    const cellHeight = compact ? 82 : 138;
    const rowGap = compact ? 8 : 18;

    for (let index = 0; index < imageRefs.length; index += 2) {
      if (!ensureSpace(cellHeight + rowGap)) return;
      const rowImages = imageRefs.slice(index, index + 2);
      rowImages.forEach((image, column) => {
        drawImage(image, MARGIN_X + column * (cellWidth + gap), y, cellWidth, cellHeight);
      });
      y += cellHeight + rowGap;
    }
  };

  startPage();

  addParagraph({
    text: eyebrow.toUpperCase(),
    size: 9,
    bold: true,
    muted: true,
    gapAfter: 10,
  });
  addParagraph({ text: title, size: titleSize, bold: true, gapAfter: singlePage ? 5 : 8 });
  if (subtitle) {
    addParagraph({
      text: subtitle,
      size: subtitleSize,
      muted: true,
      gapAfter: singlePage ? 10 : 18,
    });
  }

  addImageGrid();

  for (const line of lines) addParagraph(line);

  if (links.length > 0) {
    addParagraph({ text: "Links", size: 14, bold: true, gapAfter: 8 });
    for (const link of links) {
      addParagraph({
        text: `${link.label}: ${link.url}`,
        size: 10,
        muted: true,
        gapAfter: 5,
      });
    }
  }

  finishPage();

  const objects: Array<string | Buffer> = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const kids = pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);

  const imageObjectStart = 3 + pages.length * 2;
  const xObjectResources = imageRefs
    .map((image, index) => `/${image.name} ${imageObjectStart + index} 0 R`)
    .join(" ");
  const resources = `/Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >>${
    xObjectResources ? ` /XObject << ${xObjectResources} >>` : ""
  }`;

  pages.forEach((content, index) => {
    const pageObj = 3 + index * 2;
    const contentObj = pageObj + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << ${resources} >> /Contents ${contentObj} 0 R >>`
    );
    objects.push(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`);
  });

  imageRefs.forEach((image) => {
    objects.push(
      Buffer.concat([
        Buffer.from(
          `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.data.length} >>\nstream\n`,
          "binary"
        ),
        image.data,
        Buffer.from("\nendstream", "binary"),
      ])
    );
  });

  objects.push(`<< /Title (${escapePdfText(normalizeText(title))}) /Creator (Barrera Brokers) /CreationDate (${pdfDate()}) >>`);

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
  const offsets = [0];
  let pdfLength = chunks[0].length;

  objects.forEach((object, index) => {
    offsets.push(pdfLength);
    const prefix = Buffer.from(`${index + 1} 0 obj\n`, "binary");
    const body = typeof object === "string" ? Buffer.from(object, "utf8") : object;
    const suffix = Buffer.from("\nendobj\n", "binary");
    chunks.push(prefix, body, suffix);
    pdfLength += prefix.length + body.length + suffix.length;
  });

  const xrefOffset = pdfLength;
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index++) {
    xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(Buffer.from(xref, "binary"));

  return Buffer.concat(chunks);
}

export function createQuotePresentationPdf({
  title,
  planLabel,
  unitLabel,
  subtitle,
  features,
  tableRows,
  images = [],
  footer = "Cotizacion referencial sujeta a disponibilidad. barrerabrokers.com",
}: QuotePresentationPdfOptions) {
  const imageRefs = images.slice(0, 5).map((image, index) => ({
    ...image,
    name: `Im${index + 1}`,
  }));
  const commands: string[] = [];

  const teal = "0.02 0.29 0.30 rg";
  const mutedTeal = "0.10 0.39 0.39 rg";
  const gold = "0.72 0.57 0.20 rg";
  const lineGold = "0.70 0.52 0.12 RG";
  const ink = "0.08 0.10 0.10 rg";
  const muted = "0.35 0.35 0.33 rg";
  const paper = "0.985 0.975 0.945 rg";

  const textAt = (
    text: string,
    x: number,
    yFromTop: number,
    size: number,
    options: { bold?: boolean; color?: string; align?: "left" | "center" | "right" } = {}
  ) => {
    const normalized = normalizeText(text);
    const approxWidth = normalized.length * size * 0.5;
    const xPos =
      options.align === "center"
        ? x - approxWidth / 2
        : options.align === "right"
          ? x - approxWidth
          : x;
    commands.push(
      options.color || ink,
      "BT",
      `/${options.bold ? "F2" : "F1"} ${size} Tf`,
      `1 0 0 1 ${xPos.toFixed(2)} ${(PAGE_HEIGHT - yFromTop).toFixed(2)} Tm`,
      `(${escapePdfText(normalized)}) Tj`,
      "ET"
    );
  };

  const wrappedAt = (
    text: string,
    x: number,
    yFromTop: number,
    width: number,
    size: number,
    options: { bold?: boolean; color?: string; lineHeight?: number; maxLines?: number } = {}
  ) => {
    const lines = wrapText(text, size, width).slice(0, options.maxLines || 99);
    const lineHeight = options.lineHeight || size * 1.38;
    lines.forEach((line, index) => {
      textAt(line, x, yFromTop + index * lineHeight, size, options);
    });
    return yFromTop + lines.length * lineHeight;
  };

  const drawRule = (x: number, yFromTop: number, width: number, color = lineGold) => {
    commands.push(
      color,
      `${x.toFixed(2)} ${(PAGE_HEIGHT - yFromTop).toFixed(2)} m`,
      `${(x + width).toFixed(2)} ${(PAGE_HEIGHT - yFromTop).toFixed(2)} l`,
      "S"
    );
  };

  const drawImage = (
    image: (typeof imageRefs)[number],
    boxX: number,
    boxTop: number,
    boxWidth: number,
    boxHeight: number,
    mode: "contain" | "cover" = "contain"
  ) => {
    const scale =
      mode === "cover"
        ? Math.max(boxWidth / image.width, boxHeight / image.height)
        : Math.min(boxWidth / image.width, boxHeight / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const drawX = boxX + (boxWidth - drawWidth) / 2;
    const drawY = PAGE_HEIGHT - boxTop - boxHeight + (boxHeight - drawHeight) / 2;

    commands.push(
      "q",
      "0.92 0.90 0.86 rg",
      `${boxX.toFixed(2)} ${(PAGE_HEIGHT - boxTop - boxHeight).toFixed(2)} ${boxWidth.toFixed(
        2
      )} ${boxHeight.toFixed(2)} re f`,
      "Q",
      "q",
      `${boxX.toFixed(2)} ${(PAGE_HEIGHT - boxTop - boxHeight).toFixed(2)} ${boxWidth.toFixed(
        2
      )} ${boxHeight.toFixed(2)} re W n`,
      `${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(
        2
      )} cm`,
      `/${image.name} Do`,
      "Q"
    );
  };

  const drawPlaceholder = (x: number, yFromTop: number, width: number, height: number, label: string) => {
    commands.push(
      "q",
      "0.92 0.90 0.86 rg",
      `${x.toFixed(2)} ${(PAGE_HEIGHT - yFromTop - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`,
      "0.76 0.72 0.65 RG",
      `${x.toFixed(2)} ${(PAGE_HEIGHT - yFromTop - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`,
      "Q"
    );
    textAt(label, x + width / 2, yFromTop + height / 2, 10, {
      color: muted,
      align: "center",
    });
  };

  commands.push("q", paper, `0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f`, "Q");
  commands.push("0.88 0.86 0.80 RG", "0.4 w");
  commands.push("0 0 m", `${PAGE_WIDTH} 0 l`, "S");

  textAt(planLabel.toUpperCase(), 22, 30, 14, { color: teal });
  textAt(title.toUpperCase(), PAGE_WIDTH / 2, 68, 22, { color: gold, align: "center" });
  if (subtitle) textAt(subtitle, PAGE_WIDTH / 2, 93, 8.5, { color: muted, align: "center" });

  const mainImage = imageRefs[0];
  if (mainImage) {
    drawImage(mainImage, 32, 128, 326, 338, "contain");
  } else {
    drawPlaceholder(32, 128, 326, 338, "Imagen principal de la unidad");
  }

  textAt("FINANCIACION", 382, 142, 15, { bold: true, color: mutedTeal });
  const cleanFeatures = features.map((feature) => normalizeText(feature)).filter(Boolean).slice(0, 9);
  const fallbackFeatures = ["Consultar detalles comerciales de la unidad.", "Valores sujetos a disponibilidad."];
  let featureY = 166;
  for (const feature of cleanFeatures.length ? cleanFeatures : fallbackFeatures) {
    textAt("-", 378, featureY, 12, { color: teal });
    featureY = wrappedAt(feature, 392, featureY, 164, 12, {
      color: teal,
      lineHeight: 18,
      maxLines: 3,
    });
    featureY += 3;
    if (featureY > 444) break;
  }

  textAt("DESCRIPCION", 116, 548, 15, { bold: true, color: mutedTeal });
  drawRule(32, 568, 268);
  const visibleRows = tableRows.filter((row) => row.label && row.value).slice(0, 8);
  let rowY = 592;
  for (const row of visibleRows) {
    textAt(row.label, 48, rowY, 11.5, { bold: true, color: teal });
    wrappedAt(row.value, 234, rowY, 82, 11.5, { color: teal, maxLines: 1 });
    drawRule(32, rowY + 19, 268, "0.08 0.32 0.32 RG");
    rowY += 42;
    if (rowY > 794) break;
  }

  textAt("UBICACION EN PLANTA", 376, 548, 15, { bold: true, color: mutedTeal });
  drawRule(358, 568, 214);
  const locationImage = imageRefs[1] || imageRefs[0];
  if (locationImage) {
    drawImage(locationImage, 374, 584, 176, 172, "contain");
  } else {
    drawPlaceholder(374, 584, 176, 172, "Ubicacion en planta");
  }
  textAt(unitLabel, 462, 770, 8, { color: ink, align: "center" });

  textAt(footer, 32, 816, 7.5, { color: muted });

  const objects: Array<string | Buffer> = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");

  const imageObjectStart = 5;
  const xObjectResources = imageRefs
    .map((image, index) => `/${image.name} ${imageObjectStart + index} 0 R`)
    .join(" ");
  const resources = `/Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >>${
    xObjectResources ? ` /XObject << ${xObjectResources} >>` : ""
  }`;
  const content = commands.join("\n");
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << ${resources} >> /Contents 4 0 R >>`
  );
  objects.push(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`);

  imageRefs.forEach((image) => {
    objects.push(
      Buffer.concat([
        Buffer.from(
          `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.data.length} >>\nstream\n`,
          "binary"
        ),
        image.data,
        Buffer.from("\nendstream", "binary"),
      ])
    );
  });

  objects.push(`<< /Title (${escapePdfText(normalizeText(unitLabel))}) /Creator (Barrera Brokers) /CreationDate (${pdfDate()}) >>`);

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
  const offsets = [0];
  let pdfLength = chunks[0].length;

  objects.forEach((object, index) => {
    offsets.push(pdfLength);
    const prefix = Buffer.from(`${index + 1} 0 obj\n`, "binary");
    const body = typeof object === "string" ? Buffer.from(object, "utf8") : object;
    const suffix = Buffer.from("\nendobj\n", "binary");
    chunks.push(prefix, body, suffix);
    pdfLength += prefix.length + body.length + suffix.length;
  });

  const xrefOffset = pdfLength;
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index++) {
    xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(Buffer.from(xref, "binary"));

  return Buffer.concat(chunks);
}

export function pdfFileName(value: string) {
  const slug = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${slug || "ficha"}-barrera-brokers.pdf`;
}

function getJpegSize(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

  while (offset < buffer.length - 1) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > buffer.length) break;

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) break;

    if (sofMarkers.has(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }

    offset += segmentLength;
  }

  return null;
}

export async function loadPdfImages(urls: string[], limit = 4): Promise<PdfImage[]> {
  const images: PdfImage[] = [];
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean))).slice(0, limit * 2);

  for (const url of uniqueUrls) {
    if (images.length >= limit) break;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) continue;

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > 6 * 1024 * 1024) continue;

      const data = Buffer.from(arrayBuffer);
      const size = getJpegSize(data);
      if (!size) continue;

      images.push({
        data,
        width: size.width,
        height: size.height,
        mimeType: "image/jpeg",
      });
    } catch {
      // A missing or unsupported image should not block the ficha PDF.
    }
  }

  return images;
}
