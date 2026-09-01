export function buildMailto(subject: string, body: string) {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function openMailShare(subject: string, body: string) {
  const mailto = buildMailto(subject, body);

  window.location.href = mailto;

  window.setTimeout(async () => {
    if (document.visibilityState === "hidden") return;
    try {
      await navigator.clipboard?.writeText(`Asunto: ${subject}\n\n${body}`);
    } catch {
      // Some browsers block clipboard access after the mailto attempt.
    }
  }, 700);
}
