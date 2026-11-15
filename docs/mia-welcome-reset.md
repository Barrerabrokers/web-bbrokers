# MIA: bienvenida única y pruebas privadas

Reinicio solicitado el 19/10/2026. Se eliminaron instrucciones, correcciones, proyectos aprobados, fuentes, opciones y estados comerciales anteriores de MIA. No se borran contactos, conversaciones ni el catálogo del sitio.

El generador activo es `lib/mia-reset-runtime.ts`. Los leads reciben el mensaje fijo de bienvenida con su primer nombre (si se conoce). Tras cualquier salida desde el reinicio, no se genera otra respuesta automática. El bloqueo de envío comprueba también en la base que no exista una salida anterior. Se mantienen las pausas manuales y las restricciones del canal y número comercial.

Solo la conversación de prueba previamente autorizada de Pablo Barrera puede usar nuevas instrucciones. Se verifica además que la cuenta vinculada siga siendo administradora. El historial de prueba empieza en la fecha del reinicio. El entorno de prueba no consulta el flujo comercial anterior, catálogo, planillas, entrenamientos compartidos ni otras conversaciones. Mientras las nuevas instrucciones estén vacías, avisa únicamente en ese chat que todavía no hay respuestas programadas.

Las instrucciones y correcciones se editan en el panel de MIA y están restringidas al administrador Pablo Barrera. Guardarlas no las publica para los leads. No existe promoción automática de reglas de prueba a la atención real.

La migración `202610_mia_welcome_reset.sql` es transaccional e idempotente. Deja el acceso pausado hasta verificar y promover la nueva versión. Descarta reintentos anteriores sin enviar mensajes.

Pruebas: `node --test tests/mia-reset-runtime.test.cjs tests/whatsapp-welcome-only.test.cjs tests/whatsapp-sales-webhook.test.cjs tests/instagram-mia.test.cjs`.
