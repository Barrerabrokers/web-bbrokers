# Recuperación de formularios de Meta

La conexión de campañas/formularios usa **Barrera Brokers CRM**, no la app de WhatsApp Omnicanal. La recuperación no envía mensajes ni correos.

## Ejecución independiente

- `POST /api/crm/meta/backfill` (solo administradores) crea o devuelve el único trabajo activo y responde `202`. No importa contactos dentro de la petición del navegador.
- `GET /api/crm/meta/backfill` devuelve progreso persistido; no ejecuta importaciones.
- Vercel invoca `/api/cron/meta-leads` cada minuto, autenticado por `CRON_SECRET`. Retoma el trabajo activo. Sin trabajo activo inicia una conciliación de los últimos 30 días como máximo cada 15 minutos.
- Cada invocación procesa hasta 12 pasos o 5 importaciones y deja de iniciar pasos después de 75 segundos. La función permite 300 segundos para terminar la operación ya iniciada.
- Un lease en PostgreSQL evita dos workers simultáneos; caduca en diez minutos si Vercel interrumpe el worker. Cada página y cada resultado se guardan mediante comparación del lease.

Cerrar el CRM o apagar la computadora no detiene el trabajo. La interfaz solo consulta su estado mientras está visible.

## Seguridad y consistencia

- El estado guarda IDs, nombres de formularios, cursores y contadores, nunca tokens ni URLs de paginación de Graph.
- Los tokens se resuelven de nuevo en cada lote. Un cambio de app/página detiene el trabajo para evitar mezclar conexiones.
- Se descubren formularios de la página configurada y se incluyen formularios conocidos en el CRM. Si el descubrimiento falla, esos formularios se procesan y el resultado queda **parcial**, no completado.
- Se deduplican IDs de consultas y se omiten las que ya tienen actividad `meta_lead_ads` vinculada a un contacto existente. Una consulta nueva del mismo email usa el importador que conserva propietario y estado, agrega la consulta y notifica al propietario.
- Los contactos nuevos quedan como `Nuevo` y `Sin asignar`. `Formulario Recoleta` corresponde a `Feel Recoleta` por confirmación del administrador.
- Errores transitorios se reintentan hasta tres veces. Los formularios inaccesibles y consultas sin email quedan identificados en el resultado parcial.
- Una recuperación parcial no adelanta `last_success_at`.

## Formularios de otras agencias

`META_LEAD_RECOVERY_EXCLUDED_FORM_IDS` permite excluir IDs de formularios separados por coma. La exclusión prevalece sobre formularios predeterminados, configurados, descubiertos en Meta o encontrados en contactos históricos. También se aplica al retomar trabajos pendientes. Solo se filtran las consultas de recuperación y sus advertencias; los contactos existentes, su historial, la importación manual y los webhooks no se eliminan ni modifican por esta política.

El administrador confirmó que `1473751244572870` (Av Juan b Justo 4098) pertenece a publicidad de otra agencia. Debe figurar en esta variable de **Production**; sus contactos se conservan en el CRM. Las demás advertencias de conexión o permisos siguen vigentes y no se ocultan.

## Comprobación

Ejecutar `node --test tests/meta-recovery-*.test.cjs tests/meta-lead-recovery.test.cjs tests/meta-oauth-callback.test.cjs tests/meta-app-config.test.cjs` y `npm run build`.

Aplicar la migración de `crm_meta_recovery_jobs` antes de desplegar. Verificar luego la ejecución de cron, el estado del trabajo y sus advertencias. Código Meta `100` no prueba por sí solo que falte un permiso: también puede indicar un ID incorrecto o un activo no accesible. Nunca cambiar credenciales de Omnicanal para solucionar Lead Ads.
