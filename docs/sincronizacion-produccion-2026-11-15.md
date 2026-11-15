# Sincronización de producción con GitHub — 15/11/2026

## Fuente verificada

- Proyecto Vercel: `web-bbrokers`.
- Dominio productivo: `barrerabrokers.com`.
- Despliegue de referencia: `dpl_5GmaDP2r4rvMpGoW41oup2m8pefN` (READY, producción).
- GitHub anterior: `b80df7aad7e077b314ba92fef2a54ee77b39eeb2`.
- Se distinguió producción de la vista previa posterior del README; la vista previa no se utilizó como fuente.

Se contrastaron los 1.124 archivos del manifiesto con el árbol de fuentes obtenido de Vercel. Los archivos locales se reutilizaron únicamente cuando su SHA-1 coincidía; los que diferían se recuperaron desde Vercel. El código de ejecución, dependencias y configuración de la aplicación se conserva respecto de esa fuente.

## Excepciones documentales y de mantenimiento

- README actualizado al estado operativo; sustituye la documentación antigua.
- Este registro documenta procedencia y validación.
- `.gitignore` y `.env.example` se conservaron desde GitHub, ya que no forman parte de la fuente subida a Vercel.
- Se añadió a `.gitignore` el informe histórico `scripts/report-lead-data.cjs`, excluido por contener datos personales de un cliente.
- Se excluyeron `tsconfig.tsbuildinfo` y los archivos ya ignorados por el repositorio: cachés, herramientas de asistentes, copias locales y paquetes de extensión. No son código de ejecución del CRM. `next-env.d.ts` se regenera con Next.js.
- Se excluyeron dos scripts de envíos históricos con destinatarios fijos y sus disparadores opcionales de build. Los envíos habituales del CRM/MIA no fueron modificados.
- Los datos de contacto reales usados como fixtures en archivos de pruebas se sustituyeron por ejemplos ficticios.
- Se reemplazaron dos placeholders de formularios por `contacto@example.com` y un teléfono de ejemplo, sin cambiar el comportamiento.
- No se incorporaron credenciales, exportaciones de datos, el directorio `work/` ni cambios locales diferentes de producción.

## Validación

- Árbol de fuentes Vercel y manifiesto: coincidencia de los 1.124 archivos.
- Comparación de contenido reconstruido: lógica de ejecución de `app/`, `components/` y `lib/` conservada; excepciones documentales, de scripts históricos y fixtures descritas arriba.
- TypeScript: `tsc --noEmit --incremental false`, aprobado en la copia aislada.
- Pruebas incluidas en la propia fuente productiva: `tests/mia-meetings.test.cjs` y `tests/mia-agent.test.cjs`: **26 aprobadas y 9 fallidas**. No se presenta esta batería como aprobada.
- Entre los fallos hay expectativas de texto anteriores y simulaciones de agenda que no alcanzan las ofertas esperadas. Revisar y actualizar las pruebas frente al comportamiento vigente requiere trabajo posterior; no se modificó el runtime para hacerlas pasar durante esta sincronización.

La copia local de trabajo contiene pruebas y otros cambios que no están en el despliegue de referencia. Deben revisarse en cambios separados, con trazabilidad, antes de publicarse.

## Publicaciones siguientes

Usar commits revisados como origen de Vercel y comprobar qué commit quedó asociado al dominio productivo. Una publicación manual de archivos debe incorporarse también a Git para evitar volver a separar el código desplegado del versionado. La configuración y los datos persistentes del CRM continúan en sus servicios; sincronizar el repositorio no copia la base de datos.

## Revisión para el repositorio público

La primera publicación fue detenida por la revisión automática al detectar datos personales en scripts históricos. Se retiraron esos scripts, se eliminaron sus disparadores opcionales de build y se anonimizaron fixtures de pruebas y placeholders. La revisión del conjunto final no detectó correos personales ni patrones de credenciales. Los teléfonos literales restantes son el número comercial de la empresa, ejemplos sintéticos o un falso positivo dentro de una huella de traducción. Las cuatro suites de pruebas cuyos datos fueron anonimizados pasan; esto no elimina los nueve fallos históricos descritos anteriormente.
