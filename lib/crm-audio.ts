// Below the 4.5 MB Vercel request limit, including multipart overhead.
export const MAX_CRM_AUDIO_BYTES = 4_000_000;
export const CRM_AUDIO_ACCEPT = '.mp3,.mp4,.m4a,.mpeg,.mpga,.wav,.webm,.ogg,.flac,audio/*';
export function audioExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() || '';
}
export function validateCrmAudio(file: { name: string; size: number }) {
  if (!file.size) return 'El audio está vacío. Grabá nuevamente o elegí otro archivo.';
  if (file.size > MAX_CRM_AUDIO_BYTES) return 'El audio supera los 4 MB. Elegí un archivo más pequeño o grabá un resumen.';
  if (!['mp3','mp4','m4a','mpeg','mpga','wav','webm','ogg','flac'].includes(audioExtension(file.name))) return 'Formato no compatible. Usá MP3, M4A, WAV, WebM, OGG o FLAC.';
  return null;
}
export function appendTranscript(current: string, text: string) {
  return current.trimEnd() ? `${current.trimEnd()}\n\n${text.trim()}` : text.trim();
}
