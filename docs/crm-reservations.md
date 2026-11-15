# Reservas y firmas de unidades

El historial de la ficha del contacto permite agregar reservas con los mismos campos de compra: desarrollo, UF individuales o conjuntas, valor total, anticipo y saldo. La reserva requiere fecha de toma. Fecha y hora de firma pueden quedar vacías hasta confirmar el horario; se cargan juntas y se interpretan en Argentina.

La acción «Convertir en compra» abre la misma operación como venta. Al guardarla conserva las unidades, los importes, la firma, la fecha original de reserva y el historial de cambios. No crea otra operación.

Cada operación con firma tiene una única actividad en el CRM, visible para el agente asignado al contacto y todos los administradores. La agenda muestra estas actividades en «Próximas firmas», incluso sin conectar Google. La firma se edita desde Compras y reservas para mantener todas las agendas coherentes.

Google Calendar recibe una cita interna de una hora, con aviso una hora antes, en la cuenta conectada de cada administrador activo y del agente asignado. No se envía una invitación al cliente. Si una cuenta no está conectada o Google falla, las demás se sincronizan y la pendiente se reintenta. Al modificar el horario o las unidades se actualiza la cita existente; al retirar la firma o borrar la última UF se elimina la cita. La reasignación del contacto se reconcilia automáticamente.

## Puesta en producción

1. Aplicar `migrations/20261014_reservation_calendars.sql` antes de publicar el código. La tabla de cola tiene RLS y usa la conexión de servidor existente. Las tablas `crm_activities`, `agents` y `database_worker_leases` deben estar provisionadas como en el CRM actual.
2. Publicar el código. El guardado inicia la sincronización en segundo plano. El cron existente `/api/cron/crm-email-notifications` reintenta cada cinco minutos.
3. Los usuarios que necesiten la cita también en Google deben conectar Google Calendar desde Correo de CRM. Un contacto sin agente asignado conserva la firma en la agenda de los administradores; asignarle un agente lo incorpora en el siguiente ciclo.

## Verificación local

`node --test tests/crm-purchases.test.cjs tests/crm-reservations.test.cjs`

Se verificaron validaciones, fechas en Argentina, conversión con conservación de datos, identidad de operación administrada por servidor, rechazo de versiones antiguas, una firma para compras conjuntas, reintentos sin duplicados, independencia de cuentas de Google y presentación de firmas sin Google conectado. Las integraciones de base de datos y Google están simuladas en estas pruebas; no se crearon citas reales.
