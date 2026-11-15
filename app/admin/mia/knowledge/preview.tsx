'use client';

import { useActionState } from 'react';

export function KnowledgePreview({id, action}: {
  id: string;
  action: (previous: string, form: FormData) => Promise<string>;
}) {
  const [result, preview, pending] = useActionState(action, '');
  return <form action={preview} className="mt-4 space-y-2">
    <input type="hidden" name="id" value={id} />
    <label className="block">Mensaje de prueba
      <input className="ml-2 rounded border p-1" name="message" required maxLength={1500} />
    </label>
    <button disabled={pending}>{pending ? 'Generando…' : 'Previsualizar'}</button>
    {result && <p className="whitespace-pre-wrap" role="status">{result}</p>}
  </form>;
}
