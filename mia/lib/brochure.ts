export const brochureRequested = (text: string) => /\b(?:brochures?|folletos?)\b/i.test(text);

const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const brochureAccepted = (text: string) => /^(?:si|dale|ok|perfecto|por favor)(?: por favor| gracias)?$/.test(normalize(text));

export function lastQuestion(text: string) {
  return text.match(/¿[^?]*\?|[^.!?\n]+\?/g)?.at(-1)?.trim() ?? '';
}

export function questionIntent(question: string) {
  const value = normalize(question);
  if (/\b(brochure|folleto|enlace|archivo|link)\b/.test(value) && /envi|mand|recib|compart|pas/.test(value)) return 'envio-material';
  if (/presupuesto|rango|cuanto (?:queres|podes)|numero.*comodo/.test(value)) return 'presupuesto';
  if (/que (?:zona|barrio)|(?:zona|barrio).*(?:interesa|preferis|sirve|buscas)/.test(value)) return 'zona';
  if (/vivir o invertir|inversion o vivienda/.test(value)) return 'destino';
  return value;
}

export type BrochureProject = {id: string; name: string; location: string | null; brochure_url: string | null};

export function resolveBrochureProject(projects: BrochureProject[], evidence: string[], assignedId?: string) {
  for (const text of evidence) {
    const value = ' ' + normalize(text) + ' ';
    const named = projects.filter(project => {
      const name = normalize(project.name);
      return name.length >= 4 && value.includes(' ' + name + ' ');
    });
    if (named.length) return named.length === 1 ? named[0] : null;
    const inZone = projects.filter(project => {
      const zone = normalize(project.location ?? '');
      return zone.length >= 4 && value.includes(' ' + zone + ' ');
    });
    if (inZone.length) return inZone.length === 1 ? inZone[0] : inZone.find(project => project.id === assignedId) ?? null;
  }
  return projects.find(project => project.id === assignedId) ?? null;
}

export function verifiedBrochureUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (url.hostname === 'drive.google.com' && !/^\/file\/d\/[a-z0-9_-]+(?:\/|$)/i.test(url.pathname)) return null;
    if (url.hostname === 'docs.google.com' && !/^\/(?:document|presentation)\/d\/[a-z0-9_-]+(?:\/|$)/i.test(url.pathname)) return null;
    return url.href;
  } catch {
    return null;
  }
}
