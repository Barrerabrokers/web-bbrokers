# Listas de marketing por actividad

En Correos de marketing (`/admin/crm/clientes`), Crear una lista de contactos permite filtrar por Actividad / profesión, Estado del lead y Desarrollo. Se puede usar cualquiera de los filtros por separado o combinarlos. Las actividades provienen del campo `crm_leads.occupation`; no se infieren profesiones del nombre, mensajes ni notas.

La pantalla muestra contactos coincidentes y correos informados, propone un nombre editable y mantiene la confirmación de autorización de marketing que ya existía. La lista se crea o actualiza como una fotografía de los contactos que coinciden al guardar; no es una regla dinámica. Los leads pueden participar en varias listas. Los contactos sin actividad no entran en un filtro de actividad específica.

El filtro ignora mayúsculas y tildes de vocales, con el mismo criterio en la pantalla y PostgreSQL. El API `POST /api/crm/clients`, acción `import-segment`, acepta `occupation` opcional y mantiene compatibilidad con filtros anteriores. Solo administración puede consultar y crear listas. Crear una lista no envía correos: se elige luego la lista y una plantilla y se utiliza la confirmación de envío existente.

Validación: pruebas de API de segmentos, TypeScript, lint y prueba transaccional con rollback de la selección por actividad, combinación con estado y desarrollo, conteo de correos y actualización de miembros de una lista. No se enviaron correos durante la verificación.
