# Tablero de Alpha Place Belgrano

El desarrollo `/desarrollos/alpha-place-belgrano` muestra las unidades disponibles de la pestaña «Lista de Precios» del documento suministrado por el propietario. La consulta es de solo lectura, desde el servidor, con caché de cinco minutos; no requiere ni expone credenciales de Google. La planilla debe seguir permitiendo exportación por enlace.

El tablero no modifica los registros de unidades del CRM. En esta página reemplaza el listado genérico y usa los datos comerciales de la planilla para las seis unidades disponibles al incorporarse la funcionalidad. Las futuras modificaciones de estado y precio se leen de esa misma fuente.

Si la fuente falla o cambia su estructura, se muestra el CSV de referencia del 12-Nov-26 con una advertencia visible de disponibilidad a confirmar. Esa advertencia también se incluye al compartir. Una respuesta válida sin unidades disponibles produce un tablero vacío; no reactiva las del CSV de referencia.

Las imágenes verificadas están en `public/developments/alpha-place-belgrano/`. El plano #2 se corresponde con 201/301/401/501/601/701 y el #4 con 203/303/403/503/603. Una unidad fuera de esos grupos no recibe un plano por inferencia. La 701 conserva 54 m² de la lista y explicita la diferencia con los 53 m² del plano genérico.

Cada ficha tiene un enlace `?unidad=503#unidades`. WhatsApp y mail preparan mensajes con los datos, el enlace a la ficha, el plano y el brochure. El usuario elige el destinatario y envía. El botón «Copiar ficha» usa el portapapeles; si está bloqueado, selecciona un texto visible para copiar manualmente.

Validación: `node --test tests/alpha-belgrano-catalog.test.cjs`, `npx tsc --noEmit`, `npm run build`. Se comprobó además el flujo real de búsqueda, apertura/cierre de ficha, enlace directo, copia, enlaces de compartir y visualización de los dos planos en computadora y celular.

## Visibilidad del precio total

La vista pública muestra anticipo y 24 cuotas, sin precio total ni orden por precio. El servidor elimina los totales antes de serializar el catálogo, los modelos de página, los datos estructurados y las respuestas API de Alpha Place Belgrano. Las fichas PDF respetan el mismo permiso. Los roles existentes `agent`, `admin` y `marketing`, con sesión válida, conservan los precios completos. Los mensajes de WhatsApp, mail y copia siempre usan la versión para clientes, sin el precio total.

La misma política de precio total exclusivo para agentes se aplica a Alpha Place Libertador. Su listado de unidades existente respeta la sesión, conserva anticipo y cuotas de cada unidad y omite el total en mensajes para clientes. Las tarjetas de inicio, catálogo y mapa también filtran los precios de ambos Alpha en el servidor antes de renderizar o enviar datos al navegador.
