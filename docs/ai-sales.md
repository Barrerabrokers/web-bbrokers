# AI Sales Copilot — implementación

## Estado de entrega

Migración aplicada y AI Sales activado en producción el 22/09/2026, con autorización del usuario. Cron real de Vercel verificado; los primeros tres análisis del modelo `groq:openai/gpt-oss-120b:sales-v1`, recomendaciones e historial quedaron guardados. La clave actual de Groq respondió 429 al intentar procesar solicitudes consecutivas: se incorporó corte de lote, diagnóstico seguro y un máximo conservador de una llamada por ejecución. El ciclo de las 19:40 (Argentina) completó un análisis, recuperó uno de los contactos pendientes de reintento y no agregó errores. Los errores anteriores quedan en cola con reintento, no se descartan contactos. La cartera inicial tiene 4.430 contactos y su análisis es gradual (máximo 200 llamadas/día; aproximadamente 23 días como mínimo para todo el histórico, más interacciones nuevas/reintentos).

Despliegue vigente verificado: `dpl_6Sk17zVNNk9z6na3ZLZfEbMMMEse`, alias `https://barrerabrokers.com`, release `ai-sales-quota-safe-20260922`. Página protegida por login, API CRM 403 sin sesión y cron 401 sin secreto, verificados en producción.

La prueba de integración PostgreSQL también se realizó en un esquema aislado y eliminado al terminar. Su proveedor determinista se utiliza **solo en tests**; la verificación productiva utilizó Groq real. Ningún mensaje a clientes fue enviado por el copiloto.

## Integración y alcance

Se reutilizan Next.js App Router, NextAuth, roles existentes, PostgreSQL, leads/actividades, resultados de reuniones, mensajes vinculados de WhatsApp, composer de correo y campana de avisos. No cambia el pipeline ni las reglas de asignación. `admin` ve toda la cartera; los demás roles habilitados para CRM solo ven sus leads. No se creó un rol nuevo de team leader.

Seis especialistas lógicos (`agents.ts`) comparten una única llamada al modelo por lote: Lead Analyst, Conversation Analyst, Follow-up Manager, Sales Coach, Pipeline Monitor y Data Completion. El contrato `AIProvider` desacopla el modelo del worker y de la UI. Respuestas JSON validadas con Zod. Preferencias, hechos con evidencia, inferencias y datos faltantes se almacenan separados.

### Flujo

Escritura CRM → trigger transaccional → `crm_ai_events` → cron autenticado → contexto + resumen anterior → modelo → validación → score objetivo/semántico → estado, recomendaciones e historial → UI.

- La pantalla consulta estado guardado, nunca llama directamente al modelo.
- Cron cada 5 minutos; revisión temporal cada 30–60 minutos, según cola disponible.
- Reclamo por lead con `FOR UPDATE SKIP LOCKED`, lease de 5 minutos y comprobación del token al guardar. Solo marca como procesados los eventos analizados; los que llegan durante el análisis permanecen pendientes.
- 12 eventos por lote, 12 registros recientes en análisis incremental o 30 en el inicial. Se informa al modelo si el historial está recortado. Inventario acotado a 80 desarrollos; no afirma cubrir propiedades no cargadas. Resúmenes previos y feedback viajan en el contexto.
- Hasta 20 trabajos / 220 segundos por ejecución; por defecto solo uno puede llamar al modelo, los demás pueden ser revisiones temporales sin LLM. Límite diario global y atómico: 200 llamadas por defecto, máximo configurable 1000. Los intentos fallidos consumen cupo. La carga histórica inicial también consume ese cupo y se procesa gradualmente. No aumentar la concurrencia del proveedor sin verificar su cuota.
- La cola y la lista se ordenan por fecha de creación del lead, del más reciente al más antiguo (ID como desempate). Se conservan los análisis previos y los límites de reintentos. Las revisiones de tiempo y las aperturas de correo reutilizan el análisis semántico previo sin llamar al modelo.
- Las filas muestran nombre, agente, estado, fecha de alta y prioridad con color y etiqueta. Detalles despliega el análisis completo y las acciones. Rojo: muy alta; naranja: alta; amarillo: media; azul: baja; gris: muy baja, pendiente o cerrado (etiquetas distintas).
- Error: conserva estado anterior, guarda error genérico, reintentos con espera creciente, máximo 5. Un evento nuevo o la acción manual reabre el análisis. El cupo diario se reinicia según fecha de PostgreSQL.
- Recomendaciones con fingerprint estable. Nuevas acciones vuelven obsoletas las anteriores; completadas/descartadas no reaparecen por un simple cron. Posponer difiere su visualización 24 h.
- Alertas HIGH/CRITICAL en la campana interna, deduplicadas; no envía correos ni WhatsApp ni notificaciones push. El backfill no llena la campana con alertas iniciales.

### Eventos adaptados al CRM

| Registro existente | Evento AI |
| --- | --- |
| Lead nuevo, edición, propietario, etapa, formulario | lead_created / lead_updated / agent_changed / pipeline_changed / form_submitted |
| Correo o WhatsApp en actividades, incluidos mensajes de la extensión ya sincronizados | email_received/sent, whatsapp_received/sent |
| WhatsApp API vinculado por conversation.lead_id | whatsapp_received/sent; ignora actualizaciones de entrega sin contenido nuevo |
| Tracking de correos y adjuntos | email_opened (señal débil) |
| Eventos de campañas | email_opened / email_clicked |
| Llamada, nota, tarea | call_logged / note_created / task_updated |
| Reunión, resultado y cancelación | meeting_created / meeting_completed / meeting_updated / meeting_cancelled |
| Reserva o cierre expresado en etapa | pipeline_changed |

No se inventan eventos `property_viewed`, `reservation_created` ni `task_completed` si no existe un registro inequívoco correspondiente. El resultado de visita exige una reunión titulada como visita y resultado `completed`; una fecha pasada o cancelación no equivale a visita realizada. Las tablas opcionales reciben triggers únicamente si existen al aplicar la migración; reaplicarla instala los faltantes.

### Score y estado

Intención 35 %, engagement 20 %, urgencia 15 %, fit 10 %, respuesta 10 %, recencia 10 %. Sin fit conocido, se renormalizan las otras dimensiones. Aperturas aportan como máximo 2 puntos a engagement (menos de 1 punto al score); clics y mensajes tienen mayor peso. Las aperturas no reinician la fecha de contacto efectivo. El plazo propuesto por el análisis contextual condiciona las alertas de riesgo/reactivación.

Pipeline vendido → CLOSED_WON; perdido/no interesado → LOST. El modelo no puede cerrar por sí solo una operación ni cambiar el CRM. Historial y snapshot conservan contexto anterior/posterior para calibración futura; no se entrena ningún modelo.

### Interfaz

- `/admin/crm/ai-sales`: tarjetas filtrables, cola priorizada, páginas de 50 con filtros SQL sobre toda la cartera autorizada, feed y monitor de equipo solo para administrador.
- Filtros: score, intención, urgencia, estado AI, agente, fuente, texto de campaña/formulario, desarrollo, zona, presupuesto textual, país, idioma, fechas de contacto/seguimiento. No hay conversión monetaria ni filtros numéricos de rango presupuestario.
- Ficha del lead: score explicado, confianza, resumen, siguiente acción, plazo, evidencia, datos faltantes y preguntas. Borrador editable/copiable; abre el composer de correo existente para revisión/envío manual. WhatsApp se copia al flujo existente; no se agregó envío automático.
- Feedback útil/no útil, completar, descartar y posponer. El modelo consulta feedback reciente.
- `readSales(actor, leadId, filters)` es la capa estructurada preparada para futura búsqueda conversacional. La interfaz de preguntas libres no está implementada en este release.

## Migración y activación

La migración aditiva crea `crm_ai_events`, `crm_ai_state`, `crm_ai_recommendations`, `crm_ai_history`, `crm_ai_feedback`, `crm_ai_usage`, índices y triggers. RLS activado, sin acceso de roles públicos/anon/authenticated. El servidor usa la conexión PostgreSQL existente. No reescribe contactos ni conversaciones.

1. `node scripts/migrate-ai-sales.cjs --check`: valida y revierte toda la transacción.
2. `node scripts/migrate-ai-sales.cjs`: aplica esquema y encola el historial una sola vez.
3. Configurar en el servidor:
   - `AI_SALES_ENABLED=true` — activación explícita; omitir/false pausa el worker.
   - `AI_SALES_DAILY_LIMIT=200` — opcional, límite global de llamadas/día.
   - `AI_SALES_MODEL_CALLS_PER_RUN=1` — opcional, máximo por ejecución (1–20), adaptado a la cuota actual.
   - `GROQ_API_KEY` — existente en Vercel, no se copió a archivos locales.
   - `GROQ_CRM_MODEL` — opcional, defecto `openai/gpt-oss-120b`.
   - `CRON_SECRET` y conexión `POSTGRES_PRISMA_URL`/`POSTGRES_URL`/`DATABASE_URL` existentes.
4. Desplegar el código y cron. Verificar proveedor real, un lead de prueba propio y que el siguiente ciclo actualiza la ficha. No enviar mensajes a clientes para verificar.

La cola funciona en PostgreSQL/Vercel, no depende de esta sesión ni de la computadora del usuario. Para pausar, desactivar `AI_SALES_ENABLED`; se conservan datos y eventos. No borrar tablas para pausar.

## Verificación

- `node --test tests/ai-sales.test.cjs`: contrato, score, aperturas débiles, cierre, riesgo, visitas, permisos y límites.
- `AI_SALES_DB_TEST=1 node --test tests/ai-sales-db.test.cjs`: esquema aislado, captura real por trigger, procesamiento con proveedor determinista, estado e historial, acceso por propietario, deduplicación, fallo/reintento y cierre. Limpia el esquema de prueba al finalizar; no envía mensajes.
- `npm run build`: compilación, TypeScript y lint del proyecto.
- `node scripts/ai-sales-status.cjs`: diagnóstico productivo de solo lectura (cantidades, cuota, errores y modelo; sin datos personales ni secretos).
- Prueba preexistente `tests/crm-clients.test.cjs` falla porque espera `replyTo` dentro de la ruta de campañas, aunque el envío fue separado previamente al worker. No se alteró esa funcionalidad ni su test para ocultar el fallo.

## Archivos de este cambio

- `lib/ai-sales/{agents,model,store,worker}.ts`
- `migrations/202609_ai_sales.sql`, `scripts/migrate-ai-sales.cjs`
- `app/api/{crm,cron}/ai-sales/route.ts`
- `app/admin/crm/ai-sales/page.tsx`, `app/admin/crm/[id]/page.tsx`
- `components/admin/ai-sales.tsx`, `admin-sidebar.tsx`, `crm-nav.tsx`, `crm-email-composer.tsx`, `crm-notifications.tsx`
- `lib/db.ts` (tipo de aviso AI), `lib/crm-sales-context.ts` (recencia sin aperturas)
- `vercel.json`, `tests/ai-sales*.test.cjs`, este documento.

Los demás cambios que ya estaban en el repositorio se conservaron.
