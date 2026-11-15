'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square, Upload, X } from 'lucide-react';
import { CRM_AUDIO_ACCEPT, validateCrmAudio } from '@/lib/crm-audio';

type Props = { leadId: string; onTranscript: (text: string) => void; onBusyChange: (busy: boolean) => void; disabled?: boolean };

export function CrmAudioTranscriber({ leadId, onTranscript, onBusyChange, disabled = false }: Props) {
  const [phase, setPhase] = useState<'idle' | 'starting' | 'recording' | 'transcribing'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retryFile, setRetryFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const controller = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const generation = useRef(0);
  const locked = useRef(false);
  const callbacks = useRef({ onTranscript, onBusyChange });
  callbacks.current = { onTranscript, onBusyChange };

  function releaseMicrophone() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  }
  function changePhase(next: typeof phase) {
    locked.current = next !== 'idle';
    setPhase(next);
    callbacks.current.onBusyChange(next !== 'idle');
  }
  function cancel() {
    generation.current++;
    controller.current?.abort();
    if (recorder.current) {
      recorder.current.onstop = null;
      if (recorder.current.state !== 'inactive') recorder.current.stop();
    }
    releaseMicrophone();
    changePhase('idle');
    setNotice('');
  }
  useEffect(() => () => {
    generation.current++;
    controller.current?.abort();
    if (recorder.current) {
      recorder.current.onstop = null;
      if (recorder.current.state !== 'inactive') recorder.current.stop();
    }
    if (timer.current) clearInterval(timer.current);
    stream.current?.getTracks().forEach(track => track.stop());
    callbacks.current.onBusyChange(false);
  }, [leadId]);

  async function transcribe(file: File) {
    const invalid = validateCrmAudio(file);
    if (invalid) { setError(invalid); changePhase('idle'); return; }
    const token = ++generation.current;
    changePhase('transcribing'); setError(''); setNotice(''); setRetryFile(file);
    const abort = new AbortController(); controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 55_000);
    try {
      const form = new FormData(); form.set('leadId', leadId); form.set('audio', file);
      const response = await fetch('/api/crm/transcribe', { method: 'POST', body: form, signal: abort.signal });
      const data = await response.json().catch(() => null) as { text?: string; error?: string } | null;
      if (!response.ok || !data?.text) throw new Error(data?.error || 'No se pudo transcribir. Probá un audio de hasta 4 MB.');
      if (token !== generation.current) return;
      callbacks.current.onTranscript(data.text);
      setRetryFile(null); setNotice('Transcripción agregada. Revisá el texto antes de guardar.');
    } catch (cause) {
      if (token === generation.current) setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'La transcripción demoró demasiado. Podés reintentar.');
    } finally {
      clearTimeout(timeout);
      if (token === generation.current) changePhase('idle');
    }
  }
  async function startRecording() {
    if (locked.current || disabled) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError('Este navegador no permite grabar. Podés subir un archivo de audio.'); return; }
    const token = ++generation.current;
    changePhase('starting'); setError(''); setNotice(''); setRetryFile(null); setSeconds(0);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (token !== generation.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
      const rec = new MediaRecorder(media, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64_000 });
      recorder.current = rec;
      const chunks: Blob[] = [];
      rec.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      rec.onerror = () => { cancel(); setError('No se pudo grabar el audio. Probá nuevamente o subí un archivo.'); };
      rec.onstop = () => {
        releaseMicrophone();
        if (token !== generation.current) return;
        const type = rec.mimeType || mimeType || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        void transcribe(new File(chunks, `resumen.${ext}`, { type }));
      };
      rec.start(1000); changePhase('recording');
      let elapsed = 0;
      timer.current = setInterval(() => {
        elapsed++; setSeconds(elapsed);
        if (elapsed >= 300 && rec.state === 'recording') rec.stop();
      }, 1000);
    } catch (cause) {
      if (token !== generation.current) return;
      releaseMicrophone(); changePhase('idle');
      setError(cause instanceof Error && cause.name === 'NotAllowedError' ? 'Permití el acceso al micrófono en tu navegador o subí un audio.' : 'No se pudo acceder al micrófono. Probá subir un audio.');
    }
  }
  const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006b6b] disabled:opacity-50';
  return <div className="my-3 rounded-lg border border-[#006b6b]/20 bg-[#f2f8f7] p-3">
    <div className="flex flex-wrap items-center gap-2">
      {phase === 'recording' ? <button type="button" onClick={() => recorder.current?.stop()} className={`${button} border-red-200 bg-white text-red-700`}><Square className="h-4 w-4" />Detener y transcribir · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</button> : <button type="button" disabled={disabled || phase !== 'idle'} onClick={() => void startRecording()} className={`${button} border-[#006b6b]/25 bg-white text-[#006b6b]`}><Mic className="h-4 w-4" />Grabar audio</button>}
      <button type="button" disabled={disabled || phase !== 'idle'} onClick={() => fileInput.current?.click()} className={`${button} border-ink/15 bg-white text-ink`}><Upload className="h-4 w-4" />Subir audio</button>
      {phase !== 'idle' && <button type="button" onClick={cancel} className={`${button} border-transparent text-ink/70`}><X className="h-4 w-4" />Cancelar audio</button>}
      <input ref={fileInput} type="file" accept={CRM_AUDIO_ACCEPT} aria-label="Elegir audio para transcribir" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file && !locked.current && !disabled) void transcribe(file); }} />
    </div>
    <p role="status" className="mt-2 text-xs leading-relaxed text-ink/70">{phase === 'transcribing' ? <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />Transcribiendo audio…</span> : phase === 'starting' ? 'Esperando acceso al micrófono…' : phase === 'recording' ? 'Grabando tu resumen. Máximo 5 minutos.' : notice || 'Dictá tu nota o el resultado de la llamada. Archivos de hasta 4 MB.'}</p>
    {error && <div role="alert" className="mt-2 text-sm text-red-700"><p>{error}</p>{retryFile && <button type="button" disabled={disabled || phase !== 'idle'} onClick={() => void transcribe(retryFile)} className="mt-2 min-h-11 underline disabled:opacity-50">Reintentar transcripción</button>}</div>}
  </div>;
}
