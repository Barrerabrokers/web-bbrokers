# Agenda de reuniones y tareas

Disponibilidad común para agentes y administradores: lunes a domingo, 08:00 a 21:00 en Argentina. Inicios a las :00 y :30. Duraciones: 30 o 60 minutos. La cita debe finalizar hasta las 21:00: último inicio 20:30 para 30 minutos o 20:00 para 60 minutos. Las validaciones del servidor cubren altas y cambios de tareas, reuniones internas y reservas públicas. Los controles muestran el mismo rango.

La migración actualiza las configuraciones existentes y sus valores por defecto. El servicio de enlaces usa la misma política para nuevos usuarios y al guardar configuración. Conserva las citas y tareas previas sin moverlas. La duración de las tareas se persiste en crm_task_schedules.duration_minutes, se incluye en la versión de edición y en la versión de sincronización con Google. Las tareas anteriores mantienen 30 minutos. No se envían invitaciones al cliente al crear tareas.

Aplicar antes de publicar: node scripts/migrate-agenda-hours.cjs --apply. Sin --apply valida con rollback.

Verificación: node --test tests/crm-agenda-policy.test.cjs tests/meeting-client-invitation.test.cjs tests/crm-task-schedule.test.cjs; npx tsc --noEmit --incremental false.
