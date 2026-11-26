# Barrera Brokers — sitio inmobiliario, CRM y MIA

**Documentación actualizada al 15 de noviembre de 2026.**

Barrera Brokers reúne el sitio público de desarrollos y propiedades, un CRM para el equipo comercial y MIA, la asistente comercial integrada con WhatsApp, correo y Google Calendar.

- Sitio: https://barrerabrokers.com
- Acceso al equipo: https://barrerabrokers.com/login
- Centro administrativo de MIA: https://barrerabrokers.com/admin/crm/mia

## Alcance de esta documentación

Este documento describe la implementación operativa revisada al corte indicado. El código de la aplicación se sincronizó tomando como fuente el despliegue productivo de Vercel `dpl_5GmaDP2r4rvMpGoW41oup2m8pefN`, activo en barrerabrokers.com al realizar la revisión. Se verificó el manifiesto de origen y el contenido de los archivos antes de incorporarlos a GitHub.

Los cambios locales que no coincidían con ese despliegue no se incorporaron automáticamente. La documentación se actualizó por separado; se excluyeron cachés, herramientas locales ignoradas y un informe histórico con datos personales. El detalle está en [el registro de sincronización](docs/sincronizacion-produccion-2026-11-15.md).

Las integraciones dependen de credenciales, permisos, configuración y disponibilidad de cada proveedor. Su presencia en el código no garantiza que todas las cuentas estén conectadas ni que un mensaje haya sido entregado.

## Sitio público y catálogo

- Páginas de desarrollos, propiedades y sus fichas individuales.
- Unidades por desarrollo, tipologías, precios, financiación y estado comercial.
- Imágenes, videos, brochures, listas de precios y fichas compartibles.
- Formularios de consulta y entradas desde campañas.
- Contenido institucional, prensa y blog.
- Integración de medición con Meta y endpoint de catálogo `/api/feed/facebook`.

El feed publicitario y el catálogo comercial de MIA tienen alcances distintos. La existencia del endpoint no confirma que Meta haya aceptado la importación: debe comprobarse en Commerce Manager. La publicación de unidades depende de las políticas de visibilidad y los datos vigentes; no publicar una unidad vendida o reservada no implica necesariamente borrar su registro interno.

## CRM comercial

| Módulo | Función |
| --- | --- |
| Contactos | Leads, asignación a agentes, estado comercial, datos del formulario, notas e historial de actividad. |
| Pipeline | Seguimiento por estado del lead; el grado de interés se trata por separado. |
| Panel de agentes | Resumen del trabajo, contactos, tareas, reuniones e indicadores. El agente consulta su ámbito; los administradores pueden consultar el equipo. |
| Mis tareas | Actividades pendientes, vencidas y programadas. |
| Conversaciones | Bandeja de WhatsApp y canales sociales integrados, con intervención humana y controles de IA. |
| Correo de CRM | Conexión de cuentas, envío, respuestas y registro de interacciones. |
| Calendario y links de reuniones | Agenda comercial, coordinación y conexión con Google Calendar. |
| Marketing | Campañas, audiencias, integración con Meta y recuperación de leads. |
| Plantillas y workflows | Contenido reutilizable y automatizaciones comerciales. |
| Operaciones y agentes | Configuración operativa, equipo y accesos según rol. |
| Precios y brochures | Administración de documentación comercial de desarrollos. |

La autorización se comprueba también en el servidor. La visibilidad de un menú no sustituye los controles de acceso de sus endpoints.

## MIA: funcionamiento actual

MIA atiende WhatsApp entrantes según los controles de activación, pausa e intervención humana. El seguimiento comercial saliente utiliza los contactos asignados a MIA y la configuración habilitada para ese flujo. No equivale a autorizar campañas masivas sobre todos los contactos.

### Conversación y asesoramiento

1. Recupera el mensaje, formulario, contexto del CRM y memoria disponible.
2. Identifica intención, preferencias y datos que faltan, evitando volver a preguntar lo informado.
3. Consulta las fuentes comerciales autorizadas. El flujo de venta de valor utiliza BA Opportunities; precios y financiación requieren sus fuentes verificadas.
4. Combina interpretación mediante el proveedor de IA con reglas y respuestas deterministas.
5. Registra memoria, interacciones y observaciones de aprendizaje cuando corresponde.

Las reglas comerciales incluyen tono argentino, respuestas breves, una pregunta por mensaje, hasta dos opciones compatibles y respeto por pedidos de retomar más adelante. La espera mínima configurada es de diez segundos; la latencia real puede ser mayor por agrupación de mensajes, proveedor o reintentos. No debe inventar precios, disponibilidad, testimonios ni resultados de acciones.

### Centro administrativo

`/admin/crm/mia` está reservado a administradores y organiza:

- Conversaciones y datos del cliente.
- Memoria y preferencias registradas.
- Aprendizaje, correcciones e informes.
- Reuniones y verificación de conexión con Google Calendar.
- Configuración, simulador y controles del seguimiento comercial.

La supervisión de MIA tiene una sección propia. La antigua ruta de configuración en Marketing redirige al centro MIA; Marketing conserva sus funciones de campañas y bandeja general.

### Qué significa «aprender»

Hay dos mecanismos diferentes:

- **Memoria del cliente:** preferencias, opciones presentadas, datos conocidos y pendientes de la conversación.
- **Aprendizaje supervisado:** observaciones registradas y reglas administrativas aprobadas para conversaciones futuras.

Las reglas activas se consultan desde `mia_learnings`, con `aplicar_en_futuro = true` y aprobación administrativa. Guardar un chat no reentrena automáticamente el modelo ni convierte lo que dice un cliente en una instrucción global.

`data/mia/mia_learnings.json` es una copia versionable de reglas importadas. La fuente operativa es la base de datos; la exportación administrativa acumulativa está en `/api/crm/mia/learnings/export`.

### Reuniones confirmadas

El flujo implementado verifica las agendas de los organizadores habilitados, Pablo Barrera y Lucas Barrera, antes de asignar un horario. La política habitual es lunes a sábado de 10:00 a 20:00, con reuniones de 60 minutos. Los pedidos fuera de ese horario quedan pendientes de aprobación administrativa.

Tras la confirmación del cliente:

1. Crear o recuperar un único evento en Google Calendar.
2. Solicitar Google Meet para la modalidad virtual e invitaciones por correo a los participantes.
3. Registrar actividad y agenda en el CRM.
4. Cambiar el estado del lead a `Reunion`.
5. Cerrar el tema de coordinación para no volver a pedir el mismo día y horario.

El identificador del evento permite recuperar intentos inciertos sin duplicar reservas. Si Calendar tuvo éxito y el registro posterior en el CRM falló, el proceso de recuperación reintenta la sincronización. Una invitación solicitada a Google no acredita su entrega en la bandeja del destinatario.

Los cambios o cancelaciones solicitados por el cliente se registran para revisión; no deben anunciarse como ejecutados sin comprobar el cambio efectivo en Calendar. Pedir un recordatorio por WhatsApp registra una preferencia: no implica por sí solo que exista un envío automático programado.

## Arquitectura y persistencia

| Capa | Responsabilidad |
| --- | --- |
| Repositorio | Código, integraciones, validaciones, pruebas y documentación. |
| Vercel | Aplicación Next.js, endpoints, ejecución programada y variables de entorno. |
| PostgreSQL | Datos persistentes del CRM, conversaciones, memoria, reglas y estados de trabajo. |
| Supabase | Integración de almacenamiento y servicios asociados a los archivos del catálogo. |
| Google | OAuth, correo y Calendar, según permisos de cada cuenta. |
| Meta | Campañas, formularios de leads y mensajería mediante las integraciones configuradas. |
| Proveedor de IA | Generación e interpretación; el flujo de WhatsApp utiliza el adaptador de Groq. |

El CRM utiliza **PostgreSQL real mediante el cliente `postgres`**, no una base de datos simulada en memoria. `lib/db.ts` contiene acceso a datos y lógica del CRM. La conexión se resuelve por variables de entorno; no hace falta introducir Prisma o MongoDB para ponerlo en producción.

### Datos principales de MIA

| Información | Ubicación actual |
| --- | --- |
| Leads y perfil comercial | `crm_leads`, incluyendo datos estructurados en `meta_properties`. |
| Conversaciones y mensajes | `crm_whatsapp_conversations` y `crm_whatsapp_messages`. |
| Notas y actividades | `crm_activities`. |
| Memoria por conversación | `crm_whatsapp_agent_settings`, claves `mia-agent-memory-v1:<conversationId>`. |
| Instrucciones administrativas | `crm_whatsapp_agent_settings`, clave `mia-guidance-v1` y revisiones. |
| Reglas y observaciones | `mia_learnings`. |
| Estado de coordinación | `crm_mia_meeting_sessions`. |
| Agenda vinculada al CRM | `crm_meeting_schedules` y actividad asociada. |

Los documentos externos y las listas requieren control de vigencia. Actualizar una unidad en el CRM no actualiza automáticamente una planilla externa, ni una planilla sustituye automáticamente todos los registros del catálogo.

## Mapa del código operativo

Estas rutas corresponden a la fuente productiva sincronizada. Revisar siempre la rama y el commit utilizados antes de ejecutar o desplegar.

| Ruta | Responsabilidad |
| --- | --- |
| `app/desarrollos/`, `app/propiedades/` | Catálogo público. |
| `app/admin/crm/`, `components/admin/` | Interfaz del CRM y permisos. |
| `app/admin/crm/mia/`, `lib/mia-admin-workspace.ts` | Centro administrativo de MIA. |
| `app/api/whatsapp/webhook/`, `lib/whatsapp-inbox.ts` | Entrada de mensajes y procesamiento. |
| `lib/mia-project-trial.ts`, `lib/mia-value-first.ts` | Entrada al flujo comercial y conversación de valor. |
| `lib/mia-agent.ts`, `lib/mia-agent-search.ts` | Componentes de planificación, búsqueda y memoria. |
| `lib/mia-agent-memory.ts`, `lib/mia-commercial-profile.ts` | Persistencia de preferencias y perfil del lead. |
| `lib/mia-form-profile.ts`, `lib/whatsapp-form-context.ts` | Recuperación de datos del formulario. |
| `lib/mia-learnings.ts`, `lib/mia-learning-import.ts`, `lib/mia-guidance.ts` | Aprendizaje supervisado e instrucciones. |
| `lib/mia-opportunities.ts`, `lib/whatsapp-mia-sources.ts` | Fuentes comerciales y lectura de documentos. |
| `lib/mia-meetings.ts`, `lib/mia-meeting-policy.ts` | Coordinación y política de reuniones. |
| `lib/mia-meeting-recovery.ts`, `lib/mia-meeting-reconciliation.ts` | Recuperación y sincronización Calendar/CRM. |
| `lib/mia-sales-worker.ts`, `lib/mia-sales-followup.ts` | Seguimiento comercial en segundo plano. |
| `lib/whatsapp-ai-provider.ts` | Adaptador de IA y alternativas de modelo. |
| `lib/database-pool.ts`, `lib/db.ts`, `lib/supabase.ts` | Conexiones y acceso a datos/almacenamiento. |
| `lib/google-oauth.ts`, `lib/crm-email-sender.ts` | Google y envío de correo. |
| `tests/`, `scripts/`, `data/mia/` | Pruebas, utilidades operativas y copias de reglas. |

## Stack y desarrollo local

Implementación revisada: Next.js **15.5.25** con App Router, React **18.3.1**, TypeScript, Tailwind CSS, NextAuth.js 4, Zod, PostgreSQL, Supabase, herramientas de correo y procesamiento de documentos. El `package.json` operativo declara Node.js **22.x**. Verificar la revisión y su lockfile antes de instalar.

```bash
npm ci
cp .env.example .env.local
# Completar la configuración de desarrollo autorizada.
npm run dev
```

El ejemplo de entorno es una referencia inicial y puede no enumerar todas las integraciones. Usar una base de desarrollo y cuentas de prueba; los scripts operativos pueden modificar datos o enviar comunicaciones reales.

### Configuración por servicio

| Servicio | Variables o configuración relevante |
| --- | --- |
| Sesión | `NEXTAUTH_URL`, `NEXTAUTH_SECRET`. |
| PostgreSQL | `POSTGRES_PRISMA_URL`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `DATABASE_URL` o `SUPABASE_DB_URL`, según la precedencia del código. |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`; credenciales privilegiadas solo del lado servidor. |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, callback OAuth y autorización de cada cuenta. |
| Cifrado de cuentas | `CRM_EMAIL_SECRET` o la clave alternativa prevista por el código. Cambiar la clave sin migrar los datos cifrados puede impedir leer las conexiones existentes. |
| IA de WhatsApp | `GROQ_API_KEY`; modelos configurables mediante `GROQ_WHATSAPP_MODEL` y alternativas. |
| Meta/WhatsApp | Tokens, identificadores, permisos y suscripción del webhook; algunas credenciales se administran cifradas en el CRM. |
| Procesos programados | `CRON_SECRET` y las rutas de `vercel.json`. |

No hay credenciales de demo que deban utilizarse para entrar en producción. Los usuarios se administran mediante el sistema de agentes y autenticación. No publicar secretos, exportaciones de contactos, chats reales, archivos `.env` ni copias de credenciales.

### Verificación

```bash
npm run lint
npm run build
```

Las pruebas específicas están en `tests/*.test.cjs`. Cuando esos archivos estén presentes en la revisión:

```bash
node --test tests/mia-meetings.test.cjs tests/mia-meeting-recovery.test.cjs tests/mia-calendar-status.test.cjs
```

Las pruebas con proveedores simulados no verifican credenciales reales ni entrega de correos o WhatsApp. Una validación de integración debe comprobar el evento, los registros del CRM y los estados del proveedor sin enviar comunicaciones de prueba a clientes sin autorización.

## Producción y procesos programados

La aplicación opera en Vercel. El `vercel.json` operativo configura:

| Ruta | Frecuencia |
| --- | --- |
| `/api/cron/meta-leads` | Cada 5 minutos. |
| `/api/cron/crm-email-notifications` | Cada 5 minutos. |
| `/api/cron/crm-client-campaigns` | Cada 5 minutos. |
| `/api/cron/crm-device-notifications` | Cada minuto. |
| `/api/cron/whatsapp-ai-retry` | Cada 5 minutos. |
| `/api/cron/mia-sales-pilot` | Cada 5 minutos; incluye recuperación de reuniones. |

La frecuencia del proceso no es la frecuencia de contacto al cliente: cada flujo evalúa sus condiciones, pausas y vencimientos. No ejecutar scripts de envío o migraciones indiscriminadamente.

Antes de una publicación, comprobar la versión productiva, las diferencias pendientes, las variables del entorno y las pruebas correspondientes. Un build exitoso no comprueba por sí solo las integraciones externas.

## Limitaciones y trabajo pendiente

- La batería recuperada de producción de `mia-agent` y `mia-meetings` tiene 9 fallos sobre 35 pruebas; TypeScript pasa. Ver el registro de sincronización antes de interpretar las pruebas históricas como validación del flujo actual.

- Revisar por separado los cambios locales que no forman parte del despliegue sincronizado; no tratarlos como publicados.
- MIA combina múltiples módulos y respuestas fijas. Una regla administrativa nueva no garantiza que todas las ramas deterministas cambien su texto.
- La lectura de memoria puede retornar una memoria vacía ante un error; falta mejorar la visibilidad y el tratamiento de esa situación.
- El flujo comercial depende de fuentes externas: una lectura fallida puede producir una respuesta genérica de confirmación pendiente.
- La memoria está vinculada a conversaciones y se complementa con el perfil del CRM; una memoria unificada de todos los canales sigue siendo una mejora propuesta.
- La reorganización del conocimiento en una fuente comercial central y la reducción de respuestas rígidas son propuestas de mejora, no una migración ya terminada.

## Propiedad y mantenimiento

Proyecto de Barrera Brokers. La visibilidad del repositorio no implica una licencia de uso libre. Coordinar accesos y mantenimiento con los administradores del proyecto; no se publican contactos de soporte de ejemplo ni credenciales operativas.

### VIBE Bonpland: inventario conectado a Drive

El desarrollo `vibe-bonpland` usa la lista Google Drive `12kpRGnq790xOWcEZaJApwnzm8hKyqvWV` como fuente de unidades, estados, precios y financiación. El cron `/api/cron/development-drive-sync` corre diariamente a las 09:00 UTC (06:00 Argentina), protegido por `CRON_SECRET`.

- `lib/vibe-price-list.ts` valida columnas, identidades e importes antes de modificar datos. Un formato desconocido aborta y conserva la última carga válida.
- `lib/vibe-drive-sync.ts` actualiza unidades por número, sin duplicarlas. Solo incorpora disponibles; vendidas/reservadas existentes y unidades retiradas se conservan para historial, pero dejan de publicarse.
- La migración `migrations/20261125_development_drive_sync.sql` crea configuración y respaldos por ejecución con RLS. `development_drive_sync.last_success` permite verificar la última actualización correcta.
- La Variante 603 es independiente de 603/604 por confirmación comercial. Por instrucción del 26/11/2026, las cocheras y bauleras independientes quedan excluidas de la carga y sincronización. Se conserva Cabana 03 y las ofertas de departamentos con cochera incluida.
- Imágenes y planos provienen del brochure; la sincronización de la planilla no interpreta nuevos brochures. Las unidades de nuevas plantas o variantes sin plano identificado requieren asignación manual de su plano.

Pruebas: `node --test tests/vibe-price-list.test.cjs tests/parking-unit.test.cjs`.
