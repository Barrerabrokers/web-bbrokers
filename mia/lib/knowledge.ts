import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';

export const knowledgeTypes = {
  comercial: 'Información comercial',
  regla: 'Reglas de atención',
  ejemplo: 'Ejemplos de conversación',
} as const;

export async function listKnowledge(type: keyof typeof knowledgeTypes) {
  const sql = getSharedDatabase();
  try {
    return await sql`
      select k.id, k.slug, k.titulo, k.contenido, k.estado, k.version,
        to_jsonb(k)->>'borrador' as borrador,
        array(select v.version from public.mia_knowledge_versions v where v.knowledge_id = k.id order by v.version desc) as versiones
      from public.mia_knowledge k where k.tipo = ${type} order by k.titulo`;
  } finally {
    await releaseSharedDatabase(sql);
  }
}

export async function changeKnowledge(id: string, operation: string, content: string, restoreVersion: number) {
  const sql = getSharedDatabase();
  try {
    await sql.begin(async tx => {
      const [row] = await tx`select * from public.mia_knowledge where id = ${id} for update`;
      if (!row) throw new Error('Estrategia inexistente');
      if (operation === 'draft') {
        await tx`update public.mia_knowledge set borrador = ${content} where id = ${id}`;
        return;
      }
      if (operation === 'archive') {
        await tx`update public.mia_knowledge set estado = 'archivado' where id = ${id}`;
        return;
      }
      if (operation === 'restore') {
        const [version] = await tx`
          select contenido_snapshot from public.mia_knowledge_versions
          where knowledge_id = ${id} and version = ${restoreVersion}`;
        if (!version) throw new Error('Versión inexistente');
        const snapshot = typeof version.contenido_snapshot === 'string'
          ? JSON.parse(version.contenido_snapshot) : version.contenido_snapshot;
        const restored = typeof snapshot.contenido === 'string'
          ? snapshot.contenido : JSON.stringify(snapshot.contenido);
        if (!restored) throw new Error('Versión sin contenido');
        await tx`
          update public.mia_knowledge set contenido = ${restored}, estado = 'publicado',
            version = ${restoreVersion}, borrador = null, publicado_en = now() where id = ${id}`;
        return;
      }
      if (operation !== 'publish' || !content.trim()) throw new Error('Contenido requerido');
      const [latest] = await tx`
        select max(version) as version from public.mia_knowledge_versions where knowledge_id = ${id}`;
      const version = Math.max(row.version ?? 0, latest.version ?? 0) + 1;
      await tx`
        update public.mia_knowledge set contenido = ${content}, estado = 'publicado',
          version = ${version}, borrador = null, publicado_en = now() where id = ${id}`;
      await tx`
        insert into public.mia_knowledge_versions (knowledge_id, version, contenido_snapshot)
        select k.id, k.version, snapshot.contenido_snapshot
        from public.mia_knowledge k
        cross join lateral jsonb_populate_record(null::public.mia_knowledge_versions,
          jsonb_build_object('contenido_snapshot', to_jsonb(k) - 'borrador')) as snapshot
        where k.id = ${id}`;
    });
  } finally {
    await releaseSharedDatabase(sql);
  }
}
