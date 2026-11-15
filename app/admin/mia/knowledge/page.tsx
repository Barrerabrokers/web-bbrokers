import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { changeKnowledge, knowledgeTypes, listKnowledge } from '@/mia/lib/knowledge';

import { generateGroqCustomerReply } from '@/lib/whatsapp-ai-provider';
import { MIA_CONVERSATION_INSTRUCTIONS } from '@/mia/lib/conversation-instructions';
import { KnowledgePreview } from './preview';

const panelPath = '/admin/mia/knowledge';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login?from=' + panelPath);
  if (session.user.role !== 'admin') redirect('/admin/crm');
}

async function save(operation: string, form: FormData) {
  'use server';
  await requireAdmin();
  const id = String(form.get('id') ?? '');
  const content = String(form.get('content') ?? '');
  if (!/^[a-f0-9-]{36}$/i.test(id) || content.length > 30000) throw new Error('Datos inválidos');
  await changeKnowledge(id, operation, content, Number(form.get('version')));
  revalidatePath(panelPath);
}

async function preview(_previous: string, form: FormData) {
  'use server';
  await requireAdmin();
  const message = String(form.get('message') ?? '').trim();
  if (!message || message.length > 1500) return 'Ingresá un mensaje de prueba válido.';
  for (const type of ['comercial', 'regla', 'ejemplo'] as const) {
    const item = (await listKnowledge(type)).find(row => row.id === form.get('id'));
    if (!item) continue;
    try {
      return await generateGroqCustomerReply(
        MIA_CONVERSATION_INSTRUCTIONS +
          '\nSimulación sin datos verificados del catálogo. Usá este contenido como contexto: ' +
          JSON.stringify(item.borrador ?? item.contenido),
        [{role: 'user', content: message}], undefined, {timeoutMs: 15000},
      );
    } catch {
      return 'No se pudo generar la vista previa.';
    }
  }
  return 'No se encontró el contenido.';
}

export default async function KnowledgePage({searchParams}: {searchParams: Promise<{tipo?: string}>}) {
  await requireAdmin();
  const {tipo} = await searchParams;
  const type = tipo === 'regla' || tipo === 'ejemplo' ? tipo : 'comercial';
  const entries = await listKnowledge(type);
  return <main className="mx-auto max-w-4xl space-y-6 p-6">
    <h1 className="text-2xl font-semibold">Conocimiento de MIA</h1>
    <nav className="flex flex-wrap gap-4" aria-label="Tipos de conocimiento">
      {Object.entries(knowledgeTypes).map(([key, label]) =>
        <a key={key} href={panelPath + '?tipo=' + key} aria-current={type === key ? 'page' : undefined}
          className={type === key ? 'font-semibold underline' : 'underline'}>{label}</a>
      )}
    </nav>
    {entries.map(entry => <details key={entry.id} className="rounded border p-4">
      <summary className="cursor-pointer">{entry.titulo} · {entry.estado} · v{entry.version}</summary>
      <form action={save.bind(null, 'draft')} className="mt-4 space-y-3">
        <input type="hidden" name="id" value={entry.id} />
        <label className="block">Contenido
          <textarea className="mt-1 w-full rounded border p-2" name="content" rows={6}
            defaultValue={entry.borrador ?? entry.contenido} required maxLength={30000} />
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="submit">Guardar borrador</button>
          <button formAction={save.bind(null, 'publish')}>Publicar</button>
          <button formAction={save.bind(null, 'archive')} formNoValidate>Archivar</button>
          <select name="version" aria-label="Versión para restaurar">
            {(entry.versiones as number[]).map(version => <option key={version} value={version}>v{version}</option>)}
          </select>
          <button formAction={save.bind(null, 'restore')} formNoValidate disabled={!entry.versiones.length}>Restaurar versión</button>
        </div>
      </form>
      <KnowledgePreview id={entry.id} action={preview} />
    </details>)}
  </main>;
}
