# Audio para notas y resultados de llamadas

En la ficha del contacto y en el panel CRM, `Grabar audio` solicita el micrófono del navegador. `Detener y transcribir` convierte el resumen dictado en texto automáticamente. `Subir audio` admite archivos del celular o la computadora. La transcripción se agrega al texto existente y el agente la revisa antes de guardar la actividad.

Incluye notas nuevas, edición de notas y resultados de llamadas. Grabar audio sirve para dictar el resumen del agente; no graba automáticamente la llamada telefónica. No almacena el archivo de audio en la base ni en un bucket: se envía al proveedor de transcripción y se conserva únicamente el texto al guardar. Si falla, el archivo permanece en memoria del navegador para reintentar mientras el formulario sigue abierto.

La API `/api/crm/transcribe` usa la variable existente `GROQ_API_KEY` y el modelo multilingüe `whisper-large-v3`. Verifica sesión, rol y acceso al contacto antes de usar el proveedor. No necesita migración de base de datos ni nuevas credenciales. Documentación del proveedor: https://console.groq.com/docs/speech-to-text

Límites: 4.000.000 bytes por archivo para dejar margen al límite de petición multipart de Vercel; grabaciones de hasta 5 minutos, con bitrate solicitado de 64 kbps. MP3, MP4/M4A, MPEG/MPGA, WAV, WebM, OGG y FLAC. Grabación disponible en contexto seguro HTTPS (o localhost) y navegadores con MediaRecorder. Si el navegador no permite micrófono, se mantiene la carga de archivos.

La cancelación y el desmontaje abortan la solicitud del navegador y liberan el micrófono. Respuestas tardías se ignoran. Guardar queda bloqueado mientras se graba o transcribe. Los fallos no reemplazan el texto previo y se muestran con mensajes seguros sin contenido del proveedor ni credenciales.

Validación: `node --test tests/crm-audio.test.cjs tests/crm-audio-ui.test.cjs`, `npx tsc --noEmit`, `npm run build`. Tests con proveedor y micrófono simulados; no equivalen a una prueba real de voz en Safari/iOS/Android ni a una validación del proveedor productivo.
