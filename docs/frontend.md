# Frontend visual — Pelucars

## Tipografía actual — Manrope

Ampliación de presupuesto del 24/11: filtros ARS/USD comparan ambas monedas con Oficial/Venta, confirmada provisionalmente por el usuario. Ficha conserva precio original y añade equivalente en moneda buscada; línea compacta de tasa/fecha. La comparación se hace en base antes de paginar. Detalle y estado de conexión en [inventario-presupuesto.md](inventario-presupuesto.md); sustituye las descripciones anteriores de filtro por moneda sin conversión.

Revisión visual posterior del 24/11: contraste de texto secundario/bordes reforzado; filtros compactos y alineados, una barra de rango con dos controles nativos accesibles y campos exactos. Reportes usa KPI más pequeños, definiciones desplegables, estados en una fila con cifras próximas y ventas/score agrupados. Se retiraron textos automáticos repetidos y banda demo. Dólar es un control compacto en barra superior con detalle y actualización manual sin caché del proveedor. Demo recarga tras persistir cookie. Las capturas anteriores ya no describen el layout vigente.

Ampliación del 24/11: Reportes aplica fechas/vendedor automáticamente, conservando resultados durante la navegación sin recarga completa. Inventario agrega rangos año/precio con sliders y campos exactos sincronizados; moneda separada, error conserva resultados anteriores. `Datos demo` es interruptor global temporal en barra superior, inicialmente encendido: muestras/vacío. Sólo existe con `PELUCARS_DEMO_TOOLS=true`; sin flag desaparece y se consultan datos reales. DolarAPI oficial compra/venta con fecha, renovación automática y fallo explícito. Barra ajustada para tablet. Ver [demo-temporal.md](demo-temporal.md); las secciones fechadas anteriores son antecedentes, no instrucciones para reiniciar muestras.

Actualización del 24/11: Reportes se incorpora como inicio exclusivo de admin; Oportunidades queda en `/oportunidades`. Se mantiene Manrope, paleta y componentes. El bloque **Interés del cliente** usa filas separadas, sin tarjeta dentro de tarjeta ni acento lateral duplicado; conserva etiqueta principal y descripción destacada. `BackLink` tiene apariencia de botón secundario. El paginado CRM se oculta si sólo hay una página. “Resumen de la consulta” reemplaza “Nota”. Se agrega listado de oportunidades por vehículo con permisos. Pruebas y límites actuales en [reportes.md](reportes.md); el resto del pulido visual sigue pendiente.

El 20/11 se aprobó Manrope para toda la aplicación. Se carga desde `src/app/fonts/manrope-latin-variable.woff2` mediante `next/font/local`, con pesos variables 200–800, precarga, `display: swap` y fallback Arial ajustado. El archivo latino incluye español, pesa 24.532 bytes y se distribuye con su licencia OFL. No requiere consultas a Google en el build ni desde el navegador.

El cuerpo mantiene 14 px con interlineado 1,6; títulos usan 700 y nombres/subtítulos 600–650. Etiquetas de formularios, ayudas y metadatos principales suben a 12–13 px según su jerarquía. Botones usan 13 px. La paleta blanco/negro/rojo se conserva; el manual de marca futuro puede revisar esta elección.

## Clientes y oportunidades conectados — 20/11/2026

Revisión posterior: las referencias visibles usan **OP-000123**, las consultas recurrentes vuelven al responsable actual de la última consulta si sigue habilitado y la campana avisa al destinatario. Los avisos se consultan cada 45 segundos con pestaña visible, al recuperar foco y al navegar; abrir uno lo marca leído. No envía correo ni WhatsApp. El seed se puede reconstruir con `npm run demo:reset` desde `frontend/` en Windows; ver [pruebas-crm.md](pruebas-crm.md).

Medición local del 20/11, tres cargas por ruta con Chrome y Supabase remoto, sin guardar cambios:

| Pantalla | Mediana de producción antes | Después | Desarrollo después, rutas ya compiladas |
| --- | --- | --- | --- |
| Bandeja | 1.406 ms | 687 ms | 711 ms |
| Clientes | 1.220 ms | 707 ms | 701 ms |
| Ficha de oportunidad | 1.782 ms | 1.196 ms | 1.020 ms |

Se quitó una consulta de perfil duplicada del proxy en rutas comunes y se sustituyó `getUser()` por verificación de JWT con `getClaims()`; el perfil habilitado/rol se sigue leyendo desde la base en cada petición. Las rutas exclusivas de admin conservan rechazo anticipado en el proxy por el comportamiento de streaming observado antes. No se cachean permisos ni datos privados entre usuarios. La campana carga aparte y no bloquea la página.

Son mediciones orientativas de carga completa (no un benchmark ni una promesa de latencia), con sondeo del DOM de 150 ms y tres muestras; la red y compilación inicial pueden variar. El servidor de desarrollo existente mostró también recargas de Fast Refresh al editar AppShell, que no son navegación normal de producción. Comando reproducible: `npm run check:ui -- http://localhost:3000 --timing`. `--guards` comprueba el rechazo con el JWT de la cuenta de vendedor de demo sin alterar su habilitación.

La rama `backend-clientes-oportunidades` reemplaza las pantallas comerciales de muestra por consultas reales a Supabase. **En espera** sólo expone identificador, ingreso/espera y Sin asignar al vendedor, con **Tomar oportunidad**; el administrador ve el detalle. **Mis oportunidades**, **Todas** (admin), clientes e historial consultan relaciones autorizadas por RLS. Las fichas permiten asignación/reasignación administrativa y cambios de estado, con sus eventos. La demo permite toma voluntaria sin tope provisional.

Las tablas se crearon vacías y luego se autorizó una carga explícita de [cinco clientes y siete oportunidades de prueba](pruebas-crm.md). El ingreso desde el bot, el alta manual desde la interfaz, el motor de score, las actividades y las ventas no están habilitados en este incremento. Las antiguas URLs de demo dejan de mostrar ejemplos y las vistas previas redirigen al listado. No hay actualizaciones en tiempo real; se ofrece **Actualizar**. Recorrido completo, seguridad y límites de verificación en [crm.md](crm.md). Las secciones siguientes describen entregas anteriores; sus referencias a clientes/oportunidades ficticios quedan como antecedente histórico.

## Inventario conectado — revisión del 20/11/2026

Rama `backend-vehiculos-inventario`, creada desde main después del merge de login. `/vehiculos` consulta Supabase y deja de mostrar el inventario ficticio. Oportunidades y clientes conservan su demo y banner; sus intereses ficticios no enlazan al catálogo real. Las antiguas rutas de vista previa de vehículos redirigen al módulo conectado.

Recorrido:

1. **Vehículos**: búsqueda por marca/modelo al escribir (300 ms de pausa), filtros inmediatos de stock, transmisión, año y activos/dados de baja. Sin recarga completa al escribir ni al presionar Enter. URL compartible, paginación de 20 fichas en servidor y reinicio a primera página al cambiar filtros. Limpiar restablece el catálogo activo. Los años provienen de las unidades registradas, sin opciones ficticias.
   **Precio publicado** ofrece moneda (ARS/USD), mínimo y máximo. Los límites se aplican al escribir y admiten coma o punto decimal, sin separadores de miles. Pueden usarse por separado y son inclusivos. Sin moneda o con un rango invertido se muestra el error; no se consulta un rango ambiguo. La búsqueda cruza precio, año, transmisión y disponibilidad sobre la misma unidad y conserva los límites al abrir la ficha. No hay conversión entre monedas.
2. **Crear vehículo** (admin): marca y modelo obligatorios, asteriscos rojos y validación en cliente/servidor. El guardado real muestra confirmación y enlace al detalle.
3. **Ficha**: conteos compactos y unidades en filas, con versión/año como título, código secundario, precio destacado y texto de características más legible. En móvil se apilan sin desbordamiento. Desde una búsqueda se conservan filtros y se muestran las unidades coincidentes; **Ver todas las unidades** los quita. Los indicadores superiores siempre cuentan toda la ficha. **Editar marca y modelo** abre la edición del catálogo.
4. **Agregar unidad / Editar unidad**: modal de hasta 840 px, con campos agrupados en dos columnas en escritorio y una en móvil. El código se genera automáticamente sin mostrar un recuadro ni un campo en el formulario. Estado requerido; año, versión, transmisión, kilometraje, precio/moneda y fecha de ingreso opcionales. Precio y moneda se completan juntos. Valores desconocidos se guardan NULL. Transmisión ofrece Manual, Automática, Otra y Sin informar, conservando cualquier texto anterior. No se inventa un año, precio o cantidad.
5. **Retirada** excluye la unidad del stock sin borrar el registro. Volver a **Disponible** repone stock. **Baja del catálogo** requiere cero disponibles y confirmación explícita; **Restaurar** mantiene los estados de unidades.

El vendedor tiene lectura, sin botones de escritura; las URLs de alta/edición se rechazan antes del render. Acciones y RPC verifican permisos independientemente. Los formularios mantienen valores ante errores, bloquean envíos duplicados y rechazan ediciones desactualizadas. No existe operación de venta, borrado físico, envío de mensajes, integración externa ni importación en este incremento. Auditoría guardada en base, todavía sin pantalla propia.

Migraciones aplicadas: `20261119162242_vehicle_inventory.sql`, `20261120121950_inventory_codes_and_filters.sql` y `20261120132113_inventory_price_filters.sql`. Pruebas SQL de inventario, códigos automáticos, filtros sobre la misma unidad, rangos inclusivos/abiertos, separación de monedas y permisos aprobadas con rollback. Al incorporar el rango de precios había 2 vehículos, 3 unidades y 8 eventos cargados por el usuario; esos conteos se conservaron después de la migración y pruebas. El código existente `1213` se mantiene. Advisors sólo informa la observación ya pendiente de protección de contraseñas filtradas en Auth.

Verificación local: lint, tipos, build y cinco pruebas de validación/filtros. `npm run check:ui -- http://127.0.0.1:3101 --inventory` revisa login admin, búsqueda rápida y Enter sin recarga, filtros inmediatos, año/transmisión, rango exacto de precio, moneda requerida, rango invertido, limpieza y conservación del foco. Comprueba catálogo, ficha real, modal de edición sin guardar, ausencia del recuadro/campo de código en ambos modales, alta de ficha vacía bloqueada y asteriscos en 1440/768/390/320 px. Capturas en `.next/ui-qa/build/`. Las altas/ediciones de unidades, bajas y conflictos se prueban mediante SQL transaccional; no se guardan modificaciones sobre vehículos reales durante la prueba de navegador. No se modifican usuarios para habilitar pruebas; permisos del vendedor se comprueban en SQL.

## Gestión de usuarios — revisión del 19/11/2026

En `/usuarios`, la lista del equipo ocupa el centro de la pantalla. Incluye búsqueda por nombre, correo o teléfono y filtro de acceso habilitado/deshabilitado. En escritorio se presenta como tabla; en móvil, cada fila agrupa la identidad y sus datos.

**Crear vendedor**, en la cabecera, abre un modal. **Editar**, en cada vendedor, abre el mismo patrón con los datos actuales. Ambos separan datos personales de acceso al sistema; las cuentas de administrador aparecen protegidas. El control **Cuenta habilitada** integra casilla, título y explicación en un bloque clickeable y aclara que el cambio se aplica al guardar.

El modal permite cancelar o cerrar con Escape, contiene el foco del teclado y bloquea el cierre durante el envío. Los errores conservan el formulario y el éxito real muestra una confirmación antes de volver al equipo. No se modifican los permisos ni las operaciones del servidor en esta revisión.

Actualización posterior: nombre, teléfono y correo de contacto son obligatorios al crear y editar vendedores; correo de acceso y contraseña inicial también lo son en el alta. Se señalan con asterisco rojo, con una leyenda, errores junto a cada campo y foco en el primero incorrecto. Los valores se conservan ante errores. La validación compartida se ejecuta también en servidor; la base exige los contactos. Las cuentas históricas incompletas muestran «Completar al editar». El mismo componente de asterisco rojo se utiliza en alta y edición de vehículos, que continúan siendo formularios visuales sin persistencia.

> **Actualización 19/11/2026:** esta rama incorpora acceso real con Supabase Auth y gestión de vendedores en `/usuarios`. El selector de rol fue reemplazado por el perfil autenticado. Las rutas comerciales conservan su muestra ficticia, compartida y claramente rotulada; todavía no consultan cartera real. Ver [autenticacion.md](autenticacion.md) para el estado de la conexión, requisitos y pruebas actuales. El recorrido y las verificaciones del 18/11 que siguen describen la entrega visual previa.

**Revisión visual del 18/11/2026:** se corrigen la distribución de las filas y la jerarquía de las cronologías, con componentes compartidos en listados y fichas. El diagnóstico y la cobertura de revisión están en [pendientes-frontend.md](pendientes-frontend.md).

Actualizado el 18 de noviembre de 2026. Aplicación Next.js en `frontend/`. A pedido del usuario, la interfaz incorpora una muestra ficticia local para evaluar las pantallas antes de definir el modelo final. No hay conexión a Supabase, autenticación, persistencia, backend de negocio ni envíos.

## Ejecutar y recorrer

Desde `frontend/`, ejecutar `npm.cmd run dev` en PowerShell (o `npm run dev` en otras terminales) y abrir la URL indicada por Next.js.

Si había un servidor ejecutándose con la primera entrega, detenerlo y volver a iniciarlo una vez: cambió la configuración del procesamiento de CSS.

1. **Oportunidades → En espera:** Ana Martínez consulta por el Corolla. Abrir la fila para ver sus datos, dos mensajes ficticios, score ilustrativo y evidencia resaltada. **Ver mensaje original** abre Conversación y enfoca el mensaje correspondiente, incluso desde otra sección.
2. **Mis oportunidades:** Bruno López consulta por el Cronos. Su ficha tiene cuatro mensajes, una llamada programada, un intento de recontacto realizado y cambios de responsable/estado. Representa al vendedor de demostración tanto en vista Vendedor como Admin.
3. **Clientes:** abrir Ana o Bruno. Consultas, mensajes, intentos de recontacto y compras tienen contadores independientes. Bruno muestra una compra anterior; Ana conserva el estado vacío de compras.
4. **Vehículos:** Corolla con stock y Cronos sin stock. Buscar por marca/modelo/versión o filtrar por stock. Los precios y cantidades son ficticios.
5. Seleccionar **Admin** en **Vista de demostración**. Abrir un vehículo y **Ver formulario de edición** para revisar campos precargados. **Alta de vehículo · diseño** conserva el formulario vacío. Vendedor sólo consulta; entrar a una ruta de edición no le muestra el formulario.
6. Los enlaces del pie de cada listado permiten revisar las fichas vacías de la primera etapa.

El selector de rol sólo cambia la presentación. Se conserva durante navegación con Next Link y vuelve a Vendedor al recargar. No es autenticación ni autorización real.

## Muestra local

Todos los ejemplos están en `src/lib/demo-data.ts`, con IDs prefijados por `demo-` y sin dependencias de Supabase. Los tipos describen sólo la presentación de esta muestra y no fijan el modelo de producción.

| Ejemplo | Cantidad / uso |
| --- | --- |
| Vehículos | 2: Toyota Corolla y Fiat Cronos, una moneda distinta y disponibilidad distinta. |
| Clientes | 2: Ana Martínez y Bruno López; correos bajo `example.test`, sin números telefónicos reales. |
| Oportunidades | 2: una en espera y otra asignada al vendedor de demostración. |
| Mensajes | 6: dos de Ana y cuatro de Bruno; autores y fechas explícitos. |
| Intentos de recontacto | 1, vinculado a los dos mensajes del contacto vendedor/cliente de Bruno. |
| Agenda | 1 llamada programada, separada del intento realizado. |
| Compras | 1 operación histórica ficticia de Bruno; importe histórico independiente del precio y stock actuales. |

Precios, stock, estados, zonas y puntajes son ejemplos escritos manualmente. La escala 0–100 se utiliza únicamente para ilustrar el componente visual: no define reglas ni calcula scores. Los fragmentos de evidencia coinciden con mensajes de la muestra. No hay bot ni asignación automática; las conversaciones y el historial son estáticos. Las fechas son fijas, se muestran en America/Buenos_Aires y no dependen de la fecha del navegador.

## Rutas

| Ruta | Contenido |
| --- | --- |
| `/` | Bandeja poblada, En espera/Mis oportunidades, búsqueda por cliente/interés y filtro por estado de ejemplo. |
| `/oportunidades/demo-consulta-ana` | Oportunidad en espera del Corolla. |
| `/oportunidades/demo-consulta-bruno` | Oportunidad del Cronos con seguimiento e historial. |
| `/clientes` | Listado y búsqueda por nombre/correo. |
| `/clientes/demo-ana`, `/clientes/demo-bruno` | Fichas de cliente con contadores y secciones de historial. |
| `/vehiculos` | Listado con búsqueda y filtro de stock. |
| `/vehiculos/demo-corolla`, `/vehiculos/demo-cronos` | Detalles de los vehículos ficticios. |
| `/vehiculos/demo-corolla/editar`, `/vehiculos/demo-cronos/editar` | Formularios precargados sólo en vista Admin. |
| `/vehiculos/nuevo` | Formulario vacío de alta visual Admin. |
| `/oportunidades/vista-previa`, `/clientes/vista-previa`, `/vehiculos/vista-previa` | Estructuras vacías preservadas. |
| `/vehiculos/vista-previa/editar` | Formulario visual sin vehículo seleccionado. |

Las rutas dinámicas generan páginas desde la muestra local. Un ID desconocido devuelve la pantalla de no encontrado, sin inventar un registro de respaldo.

## Interacciones y límites

Funcionan navegación, búsqueda y filtros sobre los ejemplos, secciones, foco en mensaje original, cambio de rol visual y escritura temporal en formularios. Las búsquedas ignoran mayúsculas y acentos; al no coincidir muestran estados vacíos. Los contadores se derivan de los datos locales, sin contar tareas como intentos ni mensajes como consultas.

Tomar/asignar oportunidad, cambiar estado, registrar seguimiento, enviar mensajes y crear/editar/dar de baja vehículos siguen **deshabilitados y rotulados Pendiente**. No se simulan guardados exitosos. No hay localStorage, cookies de aplicación, seed, migraciones ni cambios remotos. El envío de formularios se cancela localmente. La edición no modifica los ejemplos y se pierde al abandonar el formulario.

Las fichas vacías mantienen `—` para información no disponible; los registros demo pueden mostrar un cero real de la muestra (por ejemplo, compras de Ana o stock del Cronos).

## Archivos

- `src/lib/demo-data.ts`: única fuente de ejemplos y utilidades de presentación.
- `src/components/demo-lists.tsx`: listados de demostración con filtros locales.
- `src/components/demo-details.tsx`: fichas, conversación, evidencia, historial y edición visual precargada.
- Páginas `[id]/page.tsx` en clientes, oportunidades y vehículos, y `[id]/editar/page.tsx` en vehículos: resolución de IDs y generación de rutas demo.
- `src/components/app-shell.tsx`: navegación, selector de rol y aviso global de datos ficticios.
- `src/components/ui.tsx`: componentes compartidos; indicadores con valor opcional para soportar muestras y estados vacíos.
- `src/components/opportunities.tsx`, `clients.tsx`, `vehicles.tsx`: conservan las estructuras vacías originales.
- `src/app/globals.css`: paleta, tipografía, estructura, formularios y adaptación responsive.
- `src/app/records.css` y `src/components/record-ui.tsx`: columnas compartidas, identidades, distintivos, mensajes y eventos de cronología.
- `src/app/loading.tsx` y límites `Suspense` en las páginas dinámicas: estado de carga para navegar a las fichas.
- `scripts/check-ui.mjs`: revisión repetible de estilos efectivos, navegación y actualizaciones de CSS.

La paleta provisional usa blanco, negro y grises con acentos rojos. Sólo se tomaron los colores de la referencia: no se agregó la foto del logo. Títulos, nombres, descripciones y metadatos tienen niveles tipográficos diferenciados. Las cronologías muestran fecha/hora, tipo, título, detalle y responsable; tareas programadas e intentos realizados permanecen separados. Las horas usan formato de 24 horas, consistente entre servidor y navegador. El manual de marca queda pendiente (D19).

Se mantiene la navegación lateral en escritorio y superior en móvil. Filas y formularios se apilan, filtros envuelven, pestañas pueden desplazarse. Hay labels, foco visible, enlace de salto al contenido, `aria-current` y botones de sección con `aria-pressed`. Los ejemplos no requieren imágenes externas ni nuevas dependencias.

## Verificación

Desde `frontend/`:

```text
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

El 18/11/2026 pasaron lint, tipos y build. La revisión con `scripts/check-ui.mjs` pasó en Chrome sin ventana tanto en desarrollo como en el build servido localmente: 15 rutas, dos roles y anchos de 1440/768/390/320 px, con todas las secciones de las cuatro fichas pobladas. Se comprobaron estilos computados, alineación de columnas, espaciado, jerarquía de eventos y ausencia de desbordamiento horizontal y errores de consola/hidratación. También se verificaron ambas bandejas, búsqueda sin acentos y sin resultados, filtro de stock, concordancia de contadores, foco de evidencia desde Historial, contadores de Bruno (1 consulta, 4 mensajes, 1 intento, 1 compra) y edición Admin precargada. Se inspeccionaron capturas de escritorio y móvil.

El recorrido completó 220 escenarios de presentación por ejecución; desarrollo agrega una comprobación de actualización de CSS, para un total de 221. Esa comprobación agrega y revierte una regla temporal y observa el estilo computado sin recargar ni reiniciar el servidor. Se corrigió además un desbordamiento a 320 px y los avisos de navegación de Next.js por leer parámetros fuera de un límite Suspense.

Para repetir, iniciar el servidor local y ejecutar, ajustando el puerto:

```text
npm.cmd run check:ui -- http://127.0.0.1:3100 --hmr
```

Requiere Chrome, Chromium o Edge local; `CHROME_BIN` permite indicar su ejecutable. Usar `--hmr` sólo contra desarrollo y sin editar `globals.css` durante la prueba. Para verificar producción ejecutar `npm.cmd run start -- --port 3100` después del build y omitir `--hmr`. Los reportes y capturas están en `.next/ui-qa/`; son temporales y el siguiente build puede borrarlos.

La exclusión de `**/.next/` en ESLint y Git se mantiene desde la primera entrega. No se agregaron dependencias. El verificador está versionado en `scripts/`; sus reportes y capturas quedan fuera del código versionado.

No se prueban autorización real, persistencia, stock real, scoring, integraciones ni envíos, que siguen fuera de alcance. La revisión visual no es una auditoría completa de accesibilidad ni una prueba en dispositivos físicos o múltiples navegadores.

Ver [decisiones.md](decisiones.md) para la excepción autorizada sobre datos ficticios y [modelo-de-datos.md](modelo-de-datos.md) para el diseño documental pendiente de revisión.
