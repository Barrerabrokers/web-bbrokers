export type EmailDevice = {
  deviceType: "iPhone" | "Móvil" | "Tablet" | "Computadora" | "Desconocido";
  mailClient: string;
  privacyProtected: boolean;
};

export function parseEmailUserAgent(userAgent = ""): EmailDevice {
  const value = userAgent.toLowerCase();
  const privacyProtected = /googleimageproxy|google image proxy|appleprivaterelay|cloudflare|yahoo.*proxy/.test(value);
  const deviceType = privacyProtected
    ? "Desconocido"
    : /iphone/.test(value)
      ? "iPhone"
      : /ipad|tablet|kindle/.test(value)
      ? "Tablet"
      : /iphone|android.*mobile|windows phone|mobile/.test(value)
        ? "Móvil"
        : value
          ? "Computadora"
          : "Desconocido";
  const mailClient = privacyProtected
    ? "Protección de privacidad"
    : /outlook|microsoft office/.test(value)
      ? "Outlook"
      : /thunderbird/.test(value)
        ? "Thunderbird"
        : /iphone|ipad|macintosh/.test(value)
          ? "Apple Mail o navegador Apple"
          : /gmail|google/.test(value)
            ? "Gmail"
            : value
              ? "Cliente de correo o navegador"
              : "No identificado";
  return { deviceType, mailClient, privacyProtected };
}

export function safeTrackedUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
