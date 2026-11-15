# Filtros de Contactos

El listado CRM (`/admin/crm`) permite combinar Actividad / profesión, Estado del lead y Desarrollo, junto con los filtros de propietario y ubicación existentes. La actividad se toma del campo de la ficha del contacto. Las opciones se consultan sobre todos los contactos accesibles al usuario, no sobre la página visible. Administración conserva acceso al conjunto y los agentes a sus contactos asignados.

La actividad ignora mayúsculas y tildes de vocales y también permite consultar contactos sin actividad informada. El filtro se aplica en PostgreSQL tanto al total como a la paginación y a las actualizaciones del listado. La interfaz lo muestra en computadora y celular, recuerda la selección por usuario y lo incluye en Limpiar filtros.

Para abrir el listado de anestesiólogos de forma directa: `/admin/crm?occupation=Anestesiologo`. El enlace selecciona la actividad y deja los demás filtros abiertos; para administradores incluye todos los propietarios. Para agentes se conserva su alcance autorizado.

Validaciones: pruebas del armado de consultas y alcance por propietario, consulta real del listado y de las combinaciones, TypeScript y lint. La consulta de verificación del 16 de octubre de 2026 devolvió 20 anestesiólogos. No se modificaron datos de contactos.
