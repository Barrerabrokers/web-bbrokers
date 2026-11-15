export type MiaSources = { projectsUrl: string };
export const EMPTY_MIA_SOURCES: MiaSources = { projectsUrl: '' };

export function isMiaSourceUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    if (url.hostname === 'docs.google.com') return /^\/spreadsheets\/d\/[\w-]+(?:\/|$)/.test(url.pathname);
    if (url.hostname === 'drive.google.com') return /^\/file\/d\/[\w-]+(?:\/|$)/.test(url.pathname) || /^\/(?:open|uc)$/.test(url.pathname) && /^[\w-]+$/.test(url.searchParams.get('id') || '');
    const storageHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lmpbugahpcktnrybmdqx.supabase.co').hostname;
    return url.hostname === storageHost && url.pathname.startsWith('/storage/v1/object/public/');
  } catch { return false; }
}

export function validateMiaSources(value: unknown): MiaSources {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Revisá los enlaces de las fuentes de Mía.');
  const raw = (value as Record<string, unknown>).projectsUrl;
  if (typeof raw !== 'string') throw new Error('Revisá el enlace de la planilla de proyectos.');
  const projectsUrl = raw.trim();
  if (projectsUrl.length > 2000 || projectsUrl && (!isMiaSourceUrl(projectsUrl) || new URL(projectsUrl).hostname !== 'docs.google.com')) {
    throw new Error('Usá el enlace HTTPS de la planilla de Google Sheets con todos los proyectos y sus enlaces a brochures y listas de precios.');
  }
  return { projectsUrl };
}
