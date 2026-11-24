# Búsqueda por presupuesto en ARS y USD — 24/11/2026

El usuario confirmó **«Usar siempre Venta oficial por ahora»**. La moneda del filtro representa el presupuesto del comprador, no una restricción a la moneda de carga. Sustituye la búsqueda anterior sólo por moneda original. La referencia oficial es provisional, pendiente de conversación con cliente.

## Contrato

- Cada unidad conserva un único `listed_price` y `currency` (ARS o USD). No se almacena otro precio ni se sobrescribe el original.
- Al elegir ARS o USD en Presupuesto, se comparan unidades de ambas monedas. En la misma moneda se usa el importe original; USD → ARS multiplica por venta oficial; ARS → USD divide por esa misma tasa.
- Mínimo y máximo inclusivos, opcionales. Comparación numérica en PostgreSQL, sin redondear antes del filtro. Sólo la equivalencia mostrada se presenta con dos decimales y `≈`.
- Año, transmisión, stock y presupuesto deben coincidir en la **misma unidad**. Cada modelo aparece una vez, con `matching_units` calculado en base. Totales y filtros se aplican antes de paginar, también en la ficha.
- Moneda elegida sin límites incluye unidades con precio conocido en ambas monedas. Sin moneda ni límites se mantiene el catálogo sin conversión, incluyendo precios desconocidos. Desconocido no equivale a cero.
- En ficha se conserva el precio original y se añade equivalente sólo si difiere de la moneda buscada. La línea de contexto identifica Oficial/Venta, tasa y fecha de la fuente.
- La tasa viene de DolarAPI desde servidor; no se acepta una tasa por URL. Una consulta al proveedor por render (memoización React), timeout 6 segundos, `no-store`. Se reutiliza la misma tasa para selección y presentación de esa respuesta. Al navegar o volver a filtrar puede cambiar; la tasa/fecha visible corresponde a esa consulta. El botón del widget no cambia resultados ya cargados: hay que actualizar o volver a filtrar el inventario.
- Si no se obtiene una cotización válida, se muestra error y reintento, sin resultados parciales de una sola moneda ni un falso “sin coincidencias”. Quitando moneda/límites se puede seguir consultando todo el catálogo.
- Demo/real, roles, cuentas, stock, ventas y Reportes conservan sus reglas. La calculadora del widget sigue permitiendo elegir Compra/Venta; la búsqueda comercial usa siempre Oficial/Venta según la decisión confirmada.

## Implementación

Migración local `20261124145350_inventory_budget_conversion.sql`: dos RPC de sólo lectura `search_inventory_units_budget` y `search_vehicle_catalog_budget`, `STABLE`, `SECURITY INVOKER`, `search_path=''`, sin permisos PUBLIC/anon. Heredan RLS. La segunda usa la primera para mantener idéntica selección. No crea tablas/columnas, no toca precios, cuentas, seed ni registros existentes; conserva RPC anteriores.

Frontend: `getInventoryQuote` obtiene la tasa validada, se propaga a las consultas y a la presentación. El campo se llama Presupuesto y conserva los deslizadores, ingreso exacto, filtros automáticos y enlaces con parámetros. No hay conversión de totales de Reportes.

Estado: implementación local y migración probadas. El usuario autorizó explícitamente **«Sí, aplicar la migración»**; aplicada a Supabase el 24/11/2026. El plan y la ejecución incluyeron únicamente `20261124145350_inventory_budget_conversion.sql`, sin seeds/roles ni cambios de datos.

## Pruebas

`supabase/tests/inventory-conversion.sql`, incluida en `test:reports`: 25 modelos (más de una página), ambas monedas/direcciones, límites exactos y abiertos, deduplicación, coincidencia en misma unidad, precios desconocidos, tasas ausentes/cero/NaN, rango invertido, separación demo/real, vendedor habilitado/deshabilitado, rechazo anónimo y conservación de precios. Transacción revertida en PostgreSQL WASM aislado. Build/tipos y lint pasan.

Recorrido integrado: `npm.cmd run check:ui -- http://localhost:3000 --budget --smoke`. Verifica presupuesto en ambas monedas, precios originales, equivalencias, navegación y filtros sin recarga en escritorio/móvil. No modifica datos comerciales.

Resultado después de aplicar la migración: recorrido integrado aprobado, 5 verificaciones de layout (login y ficha en 1440/390/320 px) y aserciones funcionales, cero errores de consola. Ford demo devuelve sus 3 unidades al buscar presupuesto amplio en ARS y también en USD; se comprueba que aparecen ambas monedas, que los precios publicados se conservan y que las equivalencias sólo se agregan a los importes de la otra moneda. Filtros automáticos sin recarga, captura móvil inspeccionada y `git diff --check` sin errores. La base conserva los registros y cuentas; no se ejecutó seed ni ninguna mutación comercial.
