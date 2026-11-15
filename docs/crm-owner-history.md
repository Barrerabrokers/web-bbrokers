# Historial de propietarios del CRM Barrera Brokers

Proyecto: Barrerabrokers/web-bbrokers. Vercel: web-bbrokers. Producción: https://barrerabrokers.com.
Checkout de trabajo: /Users/pablobarrera/Documents/Codex/2026-06-06/quiero-que-trabajes-en-mi-repositorio/web-bbrokers.
Los cambios solicitados son para el CRM propio; las capturas de HubSpot son referencias.

El historial se genera por trigger PostgreSQL en cada alta o cambio real de assigned_agent_id. Guarda nombres e identificadores sin claves externas para conservarlos si se elimina un agente/contacto. UPDATE, DELETE y TRUNCATE se rechazan. RLS sin políticas impide acceso desde clientes Supabase. Solo la página de detalle con sesión admin consulta y renderiza el historial; agentes y marketing no lo reciben.

Los cambios manuales en la API de leads transmiten el autor autenticado mediante set_config local a la transacción. Cambios sin contexto se identifican como sistema/integración, nunca se atribuyen a un administrador sin evidencia. No hay endpoint para editar/borrar el historial. Un operador con control directo del esquema puede desactivar triggers; no es almacenamiento externo WORM.

La migración guarda una referencia del propietario actual, fechada al activar el historial. No reconstruye cambios anteriores ni afirma que sea el propietario inicial. Los contactos nuevos sí registran la asignación inicial, incluyendo sin asignar.

Validar: node scripts/verify-owner-history.cjs (transacción revertida). Aplicar: node scripts/migrate-owner-history.cjs. Primero aplicar la migración y luego publicar el código.
