# Orden manual del catálogo

En Administración → Propiedades y Administración → Desarrollos, los administradores y marketing pueden seleccionar «Ordenar catálogo», mover las fichas con el asa (arrastre o teclado) o con las flechas Subir/Bajar y pulsar «Guardar orden». Cancelar restaura el último orden guardado.

Las posiciones se guardan en `properties.sort_order` y `developments.sort_order`. Todos los lectores de las colecciones usan primero ese orden, luego fecha de creación e ID como desempate. La portada, los catálogos, las selecciones por categoría y el mapa respetan la secuencia de la colección correspondiente. Los filtros de visibilidad y disponibilidad siguen determinando qué fichas aparecen en cada sección. Las nuevas fichas sin posición quedan al final hasta ordenarlas.

El guardado exige el catálogo completo, incluida la parte oculta para agentes. Un cambio concurrente de orden, altas o bajas provoca un 409 y requiere refrescar la página; no se sobrescribe el trabajo de otra persona. El servidor controla los permisos, valida IDs y guarda todas las posiciones en una única transacción. No modifica precios, estados, visibilidad ni otros datos de las fichas.

Aplicar `node scripts/migrate-catalog-order.cjs` antes de desplegar. La migración inicial conserva la secuencia previa, de más nuevo a más antiguo. Puede validarse y revertirse con `--check`.

Pruebas: `node --test tests/catalog-order.test.cjs`. Para PostgreSQL real: `RUN_DB_TESTS=1 node --test tests/catalog-order.test.cjs`. La prueba de integración usa tablas temporales y revierte la transacción; no ordena los registros reales.
