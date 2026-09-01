# Barrera Brokers CRM para WhatsApp — MVP interno

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
- También podés escribir o editar el texto y elegir una imagen local de hasta 5 MB.
- Con una imagen seleccionada, WhatsApp abre su vista previa nativa con el texto como descripción.
- La actividad se registra en el historial del cliente al insertar el mensaje.

## Alcance del MVP

- Las imágenes locales se adjuntan automáticamente. Las imágenes ya guardadas dentro de una plantilla todavía se muestran como enlaces.
- La detección automática del teléfono funciona cuando WhatsApp lo muestra en el encabezado; para contactos guardados se ingresa manualmente.
- Los cambios internos de WhatsApp Web pueden requerir actualizar el selector del campo de mensaje.
