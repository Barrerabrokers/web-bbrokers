# Datos de leads y campañas

La campaña es un campo independiente del canal de origen y del desarrollo. Se guarda como `meta_properties.crm_campaign_name`, con atribución original de Meta conservada en `meta_campaign_name`. Se expone como `CrmLead.campaignName` y admite edición, limpieza y ordenamiento en el listado. Las campañas genéricas pueden tener desarrollo vacío. Los nombres de desarrollos históricos siguen disponibles; las campañas y consultas de zona no son opciones de desarrollo.

Los mensajes entrantes de WhatsApp Cloud, los históricos de Meta y la sincronización de WhatsApp Web guardan las respuestas etiquetadas del formulario dentro de la transacción del mensaje o actividad. Se completa la identidad faltante y se conservan todas las respuestas como formularios independientes en `whatsapp_form_submissions`; no se suman anticipos y cuotas ni se transforman en un precio total. Los mensajes salientes no completan datos de clientes. Los mensajes repetidos conservan un único formulario por identificador externo. Un email que ya pertenece a otro contacto se conserva como respuesta y se señala mediante `whatsapp_form_email_conflict`, sin fusionar contactos. Las atribuciones de anuncios de WhatsApp solo toman nombres de campaña respaldados por un identificador de anuncio presente en los metadatos de Meta; los títulos publicitarios no se interpretan como nombres de campaña.

El desarrollo vinculado por ID tiene prioridad sobre un texto antiguo al mostrar la ficha. Todas las actividades aparecen primero; las respuestas de los formularios quedan al final de la información del cliente. Campaña aparece debajo de Desarrollo y también tiene una columna en el listado y una línea en la vista móvil.

## Auditoría y recuperación

`node scripts/audit-lead-data.cjs` revisa todos los leads y sus formularios de Meta, campos importados de HubSpot y mensajes entrantes identificados de WhatsApp. Es de solo lectura por defecto. `--apply` relee cada candidato bajo bloqueo, completa únicamente campos recuperables, normaliza textos de desarrollo y separa las campañas explícitas. Se preservan valores anteriores en `crm_legacy_development_text` y en `work/lead-recovery-before.jsonl`. Los archivos de `work/` están excluidos de Git y Vercel.

Los valores no recuperables y los conflictos se informan para revisión; nunca se inventa un teléfono, email, campaña o asociación comercial. No se cambian propietarios, estados, notas ni actividades existentes.

## Validación

- `node --test tests/crm-lead-data.test.cjs tests/whatsapp-form-context.test.cjs tests/crm-company-location.test.cjs tests/meta-lead-recovery.test.cjs`
- `node scripts/verify-lead-form-persistence.cjs` prueba persistencia, duplicados y conflictos de email dentro de una transacción que siempre se revierte.
- `npx tsc --noEmit --incremental false`
- `npm run build`
