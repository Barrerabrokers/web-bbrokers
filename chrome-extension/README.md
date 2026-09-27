# Barrera Brokers CRM para WhatsApp — 0.6.18

La barra de contactos queda libre de avisos de sincronización. Abrí «Sincronización» para consultar el estado y usar sus controles dentro del panel. El cliente seleccionado incluye «Ver en CRM» para abrir su ficha en otra pestaña.

Extensión Manifest V3 para consultar contactos y usar las plantillas de WhatsApp del CRM dentro de WhatsApp Web.

## Instalación interna

1. Abrí `chrome://extensions` en Chrome.
2. Activá **Modo desarrollador**.
3. Elegí **Cargar extensión sin empaquetar**.
4. Seleccioná esta carpeta `chrome-extension`.
5. Abrí `https://barrerabrokers.com/admin/crm` e iniciá sesión.
6. Abrí `https://web.whatsapp.com` y tocá el botón **BB**.

## Flujo

- La extensión usa una pestaña autenticada del CRM como puente seguro; no guarda contraseñas ni tokens.
- Hacé doble clic en una conversación para abrir automáticamente el cliente completo del CRM.
- Si el contacto todavía no existe, el formulario de alta se abre con nombre y teléfono autocompletados.
- Elegí una plantilla, revisá el texto y presioná **Continuar a WhatsApp**.
- Los borradores se guardan automáticamente y se recuperan si WhatsApp se recarga.
- Si ya estás en el chat correcto, el mensaje se prepara sin recargar ni cerrar el panel.
- También podés escribir o editar el texto y elegir una imagen local de hasta 5 MB.
- Con una imagen seleccionada, WhatsApp abre su vista previa nativa con el texto como descripción.
- Los mensajes enviados y recibidos que WhatsApp carga se guardan en el historial del cliente identificado en el CRM. Preparar un borrador no lo registra como enviado.

## Alcance del MVP

- Las imágenes locales se adjuntan automáticamente. Las imágenes ya guardadas dentro de una plantilla todavía se muestran como enlaces.
- La detección automática del teléfono funciona cuando WhatsApp lo muestra en el encabezado; para contactos guardados se ingresa manualmente.
- Los cambios internos de WhatsApp Web pueden requerir actualizar el selector del campo de mensaje.

## Vincular Destacados (0.6.14)

Usá **Sincronizar destacados** en la barra de la extensión. Se vincula únicamente la lista existente cuyo nombre sea Destacados, con o sin un emoji (por ejemplo, Destacados💫). Si hay más de una coincidencia, se detiene. No se crean listas, no se renombran, no se quitan integrantes y no se modifican otras listas.

La vinculación reúne los destacados de ambos lugares:

- Los contactos con estrella del usuario conectado al CRM se buscan por teléfono completo en WhatsApp y se agregan a Destacados cuando existe un resultado único.
- Para los integrantes de la lista nativa, se recorren los chats que WhatsApp muestra en esa lista. El nombre o número propone una coincidencia con el CRM, que debe verificarse buscando el teléfono completo y comprobando que ya está marcado dentro de Destacados. Los nombres o teléfonos ambiguos se omiten.
- Los contactos importados reciben la misma estrella que usa la web. La web consulta esa información al recuperar el foco y cada 15 segundos mientras está visible. Las estrellas son personales del agente conectado al CRM.
- Los contactos sin coincidencia, sin teléfono válido, sin chat disponible o con nombres distintos entre ambas aplicaciones pueden requerir vinculación manual. Los chats archivados que WhatsApp no muestre en la lista no se consideran importados automáticamente. El aviso informa los casos que no pudieron verificarse; no se crean contactos ni se cambian sus propietarios.
- La primera ejecución tarda aproximadamente un segundo por teléfono. Mantené WhatsApp abierto sin usar sus formularios durante el proceso. Podés cancelar; las estrellas ya guardadas en el CRM se conservan y el borrador pendiente de WhatsApp se descarta.
- Repetí **Sincronizar destacados** después de incorporar nuevos destacados en cualquiera de los dos lugares. No se ejecutan cambios automáticos en segundo plano. Quitar una estrella no elimina integrantes de la otra aplicación.
- Pulsar la pestaña Destacados solo abre tu lista nativa. Las demás pestañas no modifican listas de WhatsApp.

## Actualizar

Reemplazá el contenido de la carpeta que ya usa la extensión, incluyendo `featured-bridge.js`. Recargá la extensión desde `chrome://extensions` y luego recargá WhatsApp Web. El antiguo `native-lists.js` ya no se carga. No mantengas dos versiones activas.

Esta versión usa la API de estrellas existente y no requiere despliegue en Vercel. Validación: sintaxis, planificación aditiva, coincidencias ambiguas, cancelación y regresión de conversaciones. Los controles se inspeccionaron en WhatsApp, pero queda pendiente comprobar la ejecución completa con esta versión instalada.

## Apertura directa de la pestaña (0.6.14)

Pulsar Destacados abre directamente la lista nativa Destacados💫, sin esperar llamadas al CRM. Conserva las filas originales y no ejecuta la vinculación ni cambia integrantes. Para reunir destacados sigue existiendo el botón separado Sincronizar destacados.

## Conversaciones (0.6.15)

- Mantené el CRM abierto con tu propio usuario en el mismo perfil de Chrome que WhatsApp Web.
- Los mensajes enviados y recibidos del chat abierto se registran automáticamente cuando WhatsApp los carga; los envíos pendientes no cuentan.
- Si aparece Chat sin vincular, buscá el cliente en BB y pulsá Vincular chat a [nombre], comprobando que sea la persona correcta.
- Para recuperar mensajes anteriores, abrí el chat y pulsá Sincronizar historial. Repetí en los chats que necesites recuperar. La extensión no puede leer chats de otro perfil o computadora.
- El panel cuenta envíos con su fecha de WhatsApp (formato español, hora argentina), no las respuestas entrantes como envíos.
- Los adjuntos quedan indicados; la extensión no copia el archivo, audio o video.


## Registro de conversaciones (0.6.17)

Corrige la captura tras el cambio de WhatsApp Web a `conv-msg-*`: las clases antiguas `message-in` y `message-out` ya no aparecen en la versión actual. La versión anterior podía mostrar “Chat registrado” sin haber detectado ningún mensaje.

- Detecta mensajes enviados y recibidos, con su fecha, incluidos los mensajes consecutivos sin indicador de cola.
- No registra borradores ni envíos pendientes como enviados.
- Conserva la cola local hasta que el CRM confirma el guardado y muestra el motivo de los errores.
- Detecta cambios del chat y reintenta también cuando WhatsApp está en segundo plano (Chrome puede limitar la ejecución de pestañas suspendidas).
- En la ficha del cliente, **Comunicaciones guardadas en CRM** permite consultar WhatsApp, correos, llamadas y reuniones existentes.
- Solo registra mensajes cargados en chats que pueden vincularse a un contacto accesible al usuario conectado. Los chats sin coincidencia requieren **Vincular chat**; no se deben vincular a otra persona. No recorre automáticamente todos los chats.
- Para recuperar mensajes de hoy, abrí cada chat y pulsá **Sincronizar historial**. Si WhatsApp pide obtener mensajes del teléfono, cargalos primero. La extensión no reenvía mensajes a los clientes.
- Los adjuntos se describen como imagen, video, audio o documento; sus archivos no se copian al CRM.

### Actualización necesaria

Descomprimí el ZIP 0.6.17 y reemplazá los archivos de la carpeta que Chrome ya tiene cargada. Incluí el nuevo archivo `message-capture.js`. En `chrome://extensions`, recargá Barrera Brokers CRM y luego recargá WhatsApp Web. Mantené una sola versión activa y el CRM abierto con tu usuario en el mismo perfil.

Validación: sintaxis y pruebas de captura con el DOM actual y el anterior, mensajes agrupados, dirección, fecha, audio y transición de pendiente a enviado. La validación del guardado real con esta versión requiere recargar la extensión instalada.
