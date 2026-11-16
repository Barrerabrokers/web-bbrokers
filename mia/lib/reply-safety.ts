function tokens(text: string) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
}

export function repeatsLastMessage(reply: string, previous: string) {
  const first = tokens(reply);
  const second = tokens(previous);
  if (!first.length || !second.length) return false;
  if (first.join(' ') === second.join(' ')) return true;
  if (first.filter(word => /\d/.test(word)).join(' ') !== second.filter(word => /\d/.test(word)).join(' ')) return false;
  if (first.length < 5 || second.length < 5) return false;
  const left = new Set(first);
  const right = new Set(second);
  const shared = [...left].filter(word => right.has(word)).length;
  return shared / new Set([...left, ...right]).size >= 0.75;
}

export function unverifiedMeetingClaim(text: string) {
  const reply = tokens(text).join(' ');
  return /\b(?:reunion|cita|visita|llamada)\b.{0,55}\b(?:confirmada|agendada|coordinada|reservada)\b/.test(reply)
    || /\b(?:queda|quedo|ya la)\b.{0,25}\b(?:confirmad[ao]|agendad[ao]|coordinad[ao]|reservad[ao])\b/.test(reply)
    || /\b(?:te (?:contacto|contactare|llamo|llamare|escribo|escribire)|un agente te (?:contactara|llamara))\b/.test(reply) && /\b(?:manana|hoy|horas|hs|a las|a la)\b/.test(reply);
}

export function socialClosing(text: string) {
  const value = tokens(text).join(' ');
  return /^(?:ok(?: gracias)?|gracias|muchas gracias|perfecto(?: gracias)?|listo(?: gracias)?)$/.test(value)
    ? value.includes('gracias') ? 'De nada, seguimos por acá.' : 'Perfecto, quedamos así.'
    : null;
}
