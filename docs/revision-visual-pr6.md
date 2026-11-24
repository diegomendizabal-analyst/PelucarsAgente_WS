# Correcciones y revisión visual de PR #6 — 24/11/2026

Revisión posterior a `2af8906`. Alcance: unicidad por origen y correcciones visuales/responsive. No se aplicaron migraciones remotas, cargaron/resetearon seeds, modificaron cuentas o datos comerciales, ni se hizo merge/despliegue.

## Catálogo: colisión entre real y demo

Reproducción local: crear Toyota Corolla real, comprobar que el catálogo demo no lo devuelve e intentar crear Toyota Corolla demo. El índice global `vehicles_brand_model_key` produce `23505` aunque las búsquedas separen los orígenes.

La migración **pendiente de aplicar** `20261124153608_vehicle_catalog_source_uniqueness.sql` crea `vehicles_source_brand_model_key` sobre `source` y las mismas expresiones `lower(regexp_replace(btrim(...), '\s+', ' ', 'g'))` de marca/modelo, y elimina el índice anterior dentro de una transacción. No cambia registros, políticas ni funciones. Se conserva la unicidad también para fichas dadas de baja. La creación normal del índice bloquea escrituras mientras se construye; planificar su aplicación aparte. No se editaron migraciones aplicadas.

`supabase/tests/inventory-source-uniqueness.sql`, incorporada a `test:reports`, falló con el índice anterior y pasó con la nueva migración en PostgreSQL WASM local. Comprueba:

- Identidades diferentes para el mismo modelo real/demo y catálogos separados.
- Duplicados rechazados dentro de ambos orígenes por la RPC.
- Índice directo: mayúsculas, espacios externos e internos repetidos/tabuladores, sin depender de la limpieza de la RPC.
- Rechazo de una actualización de origen que produciría una colisión.

**El entorno remoto conserva el problema hasta que se autorice y aplique esta migración en otro paso.** No se hicieron altas remotas para reproducirlo.

## Problemas visuales y correcciones

| Caso observado | Reproducción | Corrección |
| --- | --- | --- |
| Calculadora cortada a 1024 y 768 px | Abrir el dólar desde el encabezado; el panel sale por el borde derecho y corta Cerrar/cotización | Alinear el desplegable al borde derecho en tamaños intermedios; conservar panel fijo en móvil |
| Moneda ilegible en presupuesto de tablet | A 768 px, seleccionar ARS con mínimo/máximo; «Quitar» encoge el selector | Rangos apilados cuando el espacio es reducido; cabecera flexible y ancho estable del selector |
| Precio ARS partido entre dígitos y columnas amontonadas en 768/320 px | Abrir ficha Ford demo | Apilar unidad/acciones en tablet y móvil y dar al precio la fila completa; mantener el importe unido en móvil |
| Título largo desborda la página | Stress local del DOM con marca de 80 caracteres y modelo de 120 sin espacios | Permitir corte de palabras y que el contenedor del título se contraiga |
| Modelo largo queda cortado en Demanda | Mismo stress, dentro de la tabla | Tabla con ancho fijo y enlaces que envuelven el texto; no basta medir el ancho de la página |
| Resultados anteriores junto a filtros inválidos, sin explicar su relación | Desde posterior a Hasta o años invertidos | El error aclara que se mantienen los últimos resultados válidos; consulta pendiente con indicador visible y resultados atenuados |
| Controles pequeños para interacción táctil | Rangos y widget en emulación táctil móvil | Ampliar zonas táctiles de deslizadores, selectores y botones; campos exactos más legibles |
| Pestaña activa cortada en Oportunidades | Abrir Todas las oportunidades a 390/320 px | Permitir que las pestañas ocupen otra fila, conservando el indicador activo |
| Dirección del conversor cortada a 320 px | Abrir calculadora con controles táctiles | Una columna para Conversión/Cotización en el ancho más pequeño |

Los placeholders se oscurecieron para mejorar su contraste. El indicador transitorio de filtros reserva su espacio para evitar que los resultados salten al comenzar/terminar la consulta. La segunda pasada detectó que el título largo también contraía el contenedor del botón; se corrigió sobre `.heading-action`, sin ocultar el botón ni el desborde.

La identidad visual, los colores de marca y las fórmulas se conservan. Los textos máximos y el fallo de cotización se simulan únicamente en el navegador de QA: no se guardan ni se presentan como datos de negocio reales.

## Recorridos y evidencia

Automatización en Chrome local con las cuentas/configuración existentes, perfil de navegador separado y build de producción local en `localhost:3104`.

```powershell
# Desde frontend, con servidor local iniciado
npm.cmd run check:ui -- http://localhost:3104 --review --smoke
# Sólo estados de carga/error, filtros y stress de texto
npm.cmd run check:ui -- http://localhost:3104 --review --states-only --smoke
# Sólo alta/edición de modelo en los cinco anchos
npm.cmd run check:ui -- http://localhost:3104 --review --forms-only --smoke
```

`--review` recorre **1440, 1024, 768, 390 y 320 px**, aun con `--smoke` (ese flag sólo abrevia el preámbulo de login). Recorre Reportes y detalle, Oportunidades y ficha/historial, Clientes y ficha/historial, catálogo, ficha, alta/edición de vehículo, usuarios, modales de alta/edición de vendedor y unidad, notificaciones y dólar/calculadora. Los modales se abren, se desplazan hasta las acciones, se recorren con Tab/Shift+Tab y se cierran con Escape, comprobando retorno del foco. No se envían formularios comerciales ni se abren avisos que los marcarían leídos.

Estados adicionales: demo/vacío en las cuatro pantallas comerciales, búsqueda sin coincidencias, rangos/fechas inválidos, filtro con latencia de red, cotización en carga y fallo 503 simulado conservando el último dato. Stress de texto a 768/320 px y toque real emulado sobre el deslizador con campo exacto sincronizado. La altura de las pruebas es 900 px en la matriz y 700 px en los estados adicionales; no se emula un teclado virtual del sistema.

Las capturas originales y manifiestos se conservan localmente en `.pr-work/visual-review/before` y `after` (ignorados por Git). El indicador de ausencia de desbordes se complementa con inspección de capturas: el texto cortado dentro de Demanda no generaba desborde del documento y se encontró mirando la imagen. No se considera aprobación visual sólo por tener consola limpia.

**Roles:** administrador habilitado probado. Las credenciales existentes de vendedor devuelven «Tu cuenta no tiene acceso habilitado»; se verificó ese bloqueo sin habilitar la cuenta. No se pudo completar el recorrido de un vendedor habilitado con las credenciales disponibles. Las pruebas locales SQL cubren permisos de vendedor, pero no sustituyen ese recorrido visual pendiente.

Comparativas recortadas de las capturas reales (izquierda: antes; derecha: después):

- [Cotización/calculadora a 768 px](evidencia/pr6/dolar-tablet.png).
- [Presupuesto y moneda a 768 px](evidencia/pr6/presupuesto-tablet.png).
- [Pestañas de Oportunidades a 390 px](evidencia/pr6/pestanas-movil.png).

La pasada final produjo 113 capturas/observaciones, sin desbordes de página, superposiciones del encabezado ni errores de JavaScript. Al inspeccionar las imágenes se detectó también un defecto del script: concatenaba `/editar` después de un `?` final del enlace del catálogo y capturaba la ficha. Se corrigió usando el pathname, se agregó una comprobación del campo Marca y se repitieron alta/edición reales en los cinco anchos (10 capturas adicionales que sustituyen las anteriores). Se inspeccionaron las capturas corregidas, incluidos los textos largos y las acciones de los modales.

## Validación y límites

- **20/20 pruebas Node aprobadas**, incluyendo la nueva regresión y todas las migraciones/suites SQL en memoria. Comando: `node --test scripts/auth-validation.test.mjs scripts/crm-validation.test.mjs scripts/inventory-validation.test.mjs scripts/exchange.test.mjs scripts/report-filters.test.mjs scripts/database-local.test.mjs`, desde `frontend`. Node emite el aviso existente `MODULE_TYPELESS_PACKAGE_JSON`; no hay fallos.
- **Lint, TypeScript y build aprobados:** `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`.
- **Recorrido responsive repetido** después de las correcciones, más la repetición específica de formularios indicada arriba.
- **Regresión Reportes aprobada:** `npm.cmd run check:ui -- http://localhost:3104 --reports --smoke`; 11 comprobaciones y ningún error de JavaScript. Incluye fechas/vendedor, detalle, campos exactos/deslizadores, demo/vacío y actualización de cotización.
- **Regresión calculadora aprobada:** `npm.cmd run check:ui -- http://localhost:3104 --exchange --smoke`; ARS/USD, Compra/Venta explícitas, valores inválidos/cero/vacío, foco y tres anchos.
- Los placeholders ahora tienen contraste aproximado **5,33:1 sobre blanco**, frente a 4,19:1 antes. No equivale a una certificación de accesibilidad integral.

Limitaciones: revisión en Chrome con emulación de tamaño/tacto; pendiente comprobación física en iOS/Android y otros motores. El error de proveedor se simula en el navegador, no interrumpiendo DolarAPI ni Supabase. No se crean cuentas o datos adicionales para cubrir estados. Ventas, bot, score y actividades conservan sus estados previos; esta revisión no completa esas integraciones.
