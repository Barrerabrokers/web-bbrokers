# Agenda conversacional de MIA

La agenda usa exclusivamente el Google Calendar primario conectado al administrador activo pablo@barrerabrokers.com. `mia-meeting-scheduling-v1` habilita el servicio e indica la dirección, duración y horarios autorizados. Se mantienen las pausas de MIA por conversación y el control de intervenciones humanas.

MIA consulta las franjas ocupadas de Google, las reservas previas del CRM y las reservas en proceso. Ofrece hasta dos alternativas con fecha, hora y zona de Argentina; busca días distintos cuando hay disponibilidad. Si el cliente pide una fecha o franja, respeta esa preferencia. No conoce ni comparte los títulos o detalles de otras citas.

Después de elegir, solicita modalidad y los datos que falten para la invitación. Muestra un resumen y exige confirmación explícita. Antes de reservar vuelve a comprobar disponibilidad. Las reuniones presenciales usan la dirección configurada y las virtuales solicitan un enlace Google Meet. Se pide a Calendar enviar la invitación al correo que confirmó el cliente. Solo después de una respuesta válida de Google se comunica una confirmación y se registra la actividad y la duración en el CRM. No se cambia automáticamente el estado comercial del contacto.

El estado es persistente por conversación. Un identificador estable de evento evita duplicados ante respuestas perdidas; las reservas de MIA se serializan para el calendario de Pablo y se respeta el bloqueo del chat. Si la respuesta de Google es incierta, se recupera ese mismo evento; si el cliente desiste mientras tanto, la reserva pasa a revisión y no se intenta otra creación. No se borran ni reprograman automáticamente citas ya confirmadas.

El simulador privado consulta disponibilidad real pero nunca crea eventos, envía invitaciones ni modifica el contacto. La verificación de despliegue `MIA_MEETING_SMOKE=1` comprueba acceso a Calendar y extracción de preferencias usando datos sintéticos; no crea citas de prueba. Las pruebas automatizadas cubren horarios, días, conflictos, falta de correo, confirmación, reintentos, intervención humana y aislamiento del simulador.

Configuración inicial: Av. Santa Fe 1193; se conserva el rango existente del CRM, todos los días de 08:00 a 21:00 de Argentina, con duración predeterminada de 60 minutos. Los campos pueden modificarse sin alterar el calendario del organizador. Nunca se asume libre un horario cuando Calendar falla.
