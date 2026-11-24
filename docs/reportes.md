# Reportes — primer incremento, 24/11/2026

Rama `reportes-primer-incremento`, base `fa4be36` de main. Frontend local y migraciones aplicadas a Supabase con autorización posterior explícita. Los adjuntos se conservan en [alcance V3](referencias/alcance-v3-2026-11-24.md) y [modelo V2](referencias/modelo-backend-v2-2026-11-24.md); esta página registra el avance posterior a esas referencias.

## Decisiones confirmadas en esta sesión

El usuario confirmó consultas al primer asignado, asignaciones al receptor del evento, cartera al responsable actual y últimos 30 días inclusivos. Posteriormente pidió muestras por defecto durante la demo, filtros automáticos, rangos editables, interruptor temporal global y DolarAPI oficial compra/venta (provisional). Autorizó explícitamente «Sí, actualizar y cargar la demo», conservando cuentas y registros. Actividades, bot y módulo de ventas siguen excluidos; tampoco se reinició el seed.

## Estado de avance

“Conectado” significa frontend local y fuente SQL habilitada en Supabase; no significa publicación del frontend. Las métricas de ventas y score no están terminadas.

| ID V3 | Estado de este incremento | Evidencia / pendiente |
| --- | --- | --- |
| R01 | Conectado | `/reportes`, control en proxy/servidor y RPC aplicada. |
| R02 | Implementado local | `/` redirige por perfil: admin a Reportes, vendedor a Oportunidades. |
| R03 | Conectado | Desde/hasta y Todos/perfil, aplicación automática. Incluye perfiles deshabilitados y admins. Origen controlado por servidor según modo temporal. |
| R04 | Conectado | Consultas/clientes, recibidas/reasignadas, mediana, cartera/estados, pendientes/antigüedad y espera de stock; agregados SQL. |
| R05 | Parcial | Pérdidas y motivos globales conectados. Ventas, montos, tickets, tasa y tiempo hasta venta sólo tienen interfaz pendiente de fuente. Pérdidas por vendedor requieren atribución histórica. |
| R06 | Interfaz únicamente | Distribución y resultados por score pendientes de evaluaciones, snapshots, bandas y reglas. |
| R07 | Conectado | Demanda vigente, deduplicada por modelo, genéricas separadas y subconjunto awaiting_stock. No mide compatibilidad exacta. |
| R08 | Conectado | `leads.source` y `vehicles.source`; modo demo/vacío global. Sin selector de datos reales durante demo. |
| R09 | Conectado | Cero real, Sin datos, No aplica, No disponible, vista vacía y Error distintos; fecha de actualización de la base al obtener resultado válido. |
| R10 | Parcial | Detalle paginado de consultas, recibidas, reasignadas, cartera, pendientes, espera, pérdidas globales y demanda. Clientes únicos/mediana no tienen un detalle específico; ventas y score tampoco. |
| V09 | Implementado local | Ficha de vehículo lista oportunidades con interés activo; permiso y filtro antes de contar/paginar. |
| V12 | Parcial | Listado inverso disponible y cambio de estado existente; no se agregaron avisos de stock ni se validó un recorrido de mutación de vendedor habilitado. |
| V13 | Pendiente | Avisos de stock bloqueados por criterios D20. No se creó stock_alerts. |

Evolución temporal y tabla comparativa simultánea de vendedores permanecen como ampliaciones de la organización propuesta; el filtro individual y Todos están implementados. Actividades manuales, agenda y contadores de recontacto son posteriores.

## Fórmulas y atribución

Todas las cifras provienen de PostgreSQL; el frontend no suma listas. Período en America/Buenos_Aires: `[medianoche desde, medianoche del día posterior a hasta)`, convertido a timestamptz. Incluye fracciones del segundo final. Los parámetros de fecha se validan en UI/servidor y SQL, entre 2000 y 2100. No se limita la cartera por fecha de ingreso.

| Indicador | Universo y fórmula | Vendedor |
| --- | --- | --- |
| Consultas ingresadas | Cantidad de leads creados en el período | Primer `lead_assignments.assignee_id` conocido al consultar; sin historial queda sin asignar y sólo entra en Todos. |
| Clientes que consultaron | `count(distinct customer_id)` de esas consultas | Primer asignado de cada consulta. Un cliente puede aparecer en más de un vendedor. |
| Recibidas | Leads distintos con al menos una asignación en el período | `assignee_id` del evento. Una consulta antigua puede recibirse dentro del período. |
| Recibidas por reasignación | Leads distintos de recibidas con `previous_assignee_id IS NOT NULL` | Receptor. Varias reasignaciones del mismo lead al mismo vendedor cuentan una. |
| Tiempo a primera asignación | `percentile_cont(0.5)` de minutos entre creación y primera asignación de la cohorte | Primer asignado. Incluye asignaciones posteriores al período conocidas al consultar; no es respuesta/contacto. Sin muestra: Sin datos. |
| Cobertura de asignación | Cohorte con/sin primera asignación | Misma atribución. Con vendedor elegido, las nunca asignadas no pertenecen a su cohorte. |
| Cartera abierta | Leads con `closed_at IS NULL`, de cualquier fecha | Responsable actual. Todos incluye pendientes sin responsable. |
| Pendientes y antigüedad | Cartera sin responsable; mínimo `waiting_since` | Global en Todos; No aplica con vendedor. |
| Estados / espera de stock | Cartera agrupada por estado; subconjunto awaiting_stock | Responsable actual. |
| Demanda | Leads abiertos distintos por `vehicle_id` entre intereses activos | Responsable actual. Intereses sin modelo se agrupan aparte; sin ningún interés no integra la tabla. |
| Pérdidas y motivos | Leads lost con `closed_at` en período; agrupación de `loss_reason` | Sólo total global. No usar actor ni responsable actual como snapshot de cierre. |

La primera asignación se ordena por `occurred_at, id` (desempate determinista). El historial existente se considera fuente; no se reconstruye desde `assigned_to`. Si una importación futura trae asignaciones simultáneas ambiguas o fechas anteriores al ingreso deberá conciliarse: la mediana excluye duraciones negativas y no se inventa un tiempo válido. No se hacen importaciones en esta entrega.

Todos deduplica entidades, no suma resultados de vendedores. Los clientes únicos y las recibidas pueden solaparse entre vendedores. Una consulta con varios intereses puede aparecer en varios modelos; dentro de cada modelo cuenta una. La demanda no compara presupuesto, año o versión con unidades físicas.

Reales significa `source='whatsapp_bot'`; Demo significa `source='demo'`. No se infiere origen por nombre del cliente ni se suman clientes de otro conjunto. Ventas y score deberán heredar el filtro desde lead. ARS y USD tienen secciones independientes; no se calculan conversiones ni se usa presupuesto/precio de lista como venta. Montos y tickets pendientes nunca se muestran como cero.

## Arquitectura y permisos

`20261124125922_admin_reports.sql` agrega dos índices y tres funciones de sólo lectura. `private.report_scope` define la selección compartida; `get_admin_report` agrega con una fila por lead; `list_admin_report_details` aplica el mismo universo antes de paginar 20 filas. Devuelve total incluso en una página sin filas. No agrega tablas de resultados, ventas, score ni actividades.

Funciones `STABLE`, `SECURITY INVOKER`, `search_path=''`, permisos EXECUTE explícitos sin PUBLIC/anon y verificación de `private.is_enabled_admin()` antes de leer. RLS permanece activo. Un vendedor no puede llamar la RPC ni siquiera filtrando por sí mismo o invocando el helper privado. No se utiliza service role. Cada respuesta agregada comparte snapshot de sentencia; el detalle es otra consulta y explica que puede variar si hubo cambios.

El servidor exige `requireAdmin` tanto en página como en acceso a datos. El proxy rechaza Reportes/detalle antes del streaming. La navegación oculta Reportes al vendedor; no es el control de seguridad. Se conserva `Cache-Control: private, no-store` y no se cachean reportes entre sesiones.

El selector consulta perfiles de forma paginada para no truncarlos. Incluye todos los vendedores y administradores, habilitados o no; un perfil sin actividad puede dar una cohorte vacía. Los agregados no dependen de esa lista. Un error al cargar perfiles se informa.

Si PostgREST informa que la RPC no existe, aparece la integración pendiente. Otro error se muestra como error, sin totales alternativos ni demo automática. Una respuesta válida sin registros muestra 0 o Sin datos para una mediana. Ventas, score y pérdidas individuales tienen fuente pendiente independientemente de que las demás consultas funcionen.

## Pendientes anteriores incluidos

- `BackLink`: borde y fondo visibles, altura mínima 42 px, foco existente y destino conservado.
- Interés: filas con separación; se elimina tarjeta anidada y acento lateral duplicado. Se conserva jerarquía y etiqueta principal.
- Paginación CRM: no ocupa pie para una sola página; sigue mostrando navegación si se accede a una página fuera de rango.
- Rótulo “Resumen de la consulta”, sin cambiar `leads.summary` ni crear notas manuales.
- Vehículos: consulta de leads con intereses activos a ese modelo, deduplicada por lead mediante relación embebida. RLS y filtro explícito de responsable para vendedor antes del total y límite. Admin ve todas; incluye cerradas identificadas por estado. No genera avisos ni promete compatibilidad.
- Campana, navegación y vistas previas apuntan a `/oportunidades`; los placeholders activos distinguen compras/score pendientes de actividades posteriores.

## Pruebas y bugs

### Revisión visual posterior del 24/11

Se compactaron tarjetas, filtros y bloques pendientes; cartera por estado acerca cada número a su etiqueta. Ayudas de KPI se consultan con el icono de información; fórmulas completas siguen en el desplegable. Tabla de demanda en filas adaptadas para móvil. Contraste reforzado; se retiraron mensajes repetidos de aplicación automática, origen/fechas redundantes y banda demo. El origen no puede elegirse por URL: sigue controlado por servidor.

Dólar como control compacto en barra superior, con detalle y actualización manual que vuelve a consultar DolarAPI sin caché. Demo guarda cookie y recarga, con “Cambiando…” durante la operación. El fallo del usuario no se reprodujo en sesión limpia en localhost:3000; se verificó alternancia antes y después y se reforzó actualización completa. No se cambió Supabase ni se cargaron/borraron registros en esta revisión.

Verificaciones de esta revisión: build/tipos, lint y 10 pruebas de filtros/cotización pasan. Navegador inventario en localhost:3000: 20 verificaciones de layout en cuatro anchos, sin errores; Reportes en build local: 21 verificaciones, incluyendo widget desplegado, actualización manual, slider con teclado, valores exactos, demo/vacío y recarga/persistencia. No se alteraron cuentas ni registros comerciales. Las suites SQL de 18 pruebas de la entrega anterior no se repitieron porque no cambió base ni fórmulas.

Después del ajuste final de demanda móvil se repitió `--reports --smoke` en localhost:3000: 11 verificaciones en 390/320 px y controles funcionales, cero errores. Captura móvil inspeccionada. Build final y lint pasan. No se implementó conversión ARS/USD en esta revisión.

Confirmación posterior del usuario: calculadora informativa ARS ↔ USD incorporada al widget; no convierte ni mezcla totales de Reportes. Implementación y pruebas registradas en [demo-temporal.md](demo-temporal.md).

Comandos desde `frontend/` (Windows: `npm.cmd`): `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:auth`, `npm run test:inventory`, `npm run test:crm`, `npm run test:reports`, `npm run test:exchange`. Reportes incluye filtros y todas las migraciones en PGlite 0.3.14 (dependencia de desarrollo fijada), con regresiones SQL de identidad, inventario, CRM, recurrencia y Reportes. La base en memoria simula `auth.users`/`auth.uid`; no reemplaza Auth/PostgREST remotos.

SQL de reportes: 1005 consultas dentro del período, límites de medianoche/fracciones, consulta anterior asignada en período, clientes repetidos, reasignaciones repetidas, intereses duplicados, cartera anterior al período, perfil deshabilitado histórico, pérdida global, vacío, demo/real, total en páginas vacías y rechazo de anónimo/vendedor/admin deshabilitado. Todas las muestras se revierten; no ejecuta el seed remoto. Sin prueba de carga o simultaneidad multisesión.

Bugs encontrados durante implementación: enlaces antiguos al inicio podían llevar al admin a Reportes en vez de Mis oportunidades (corregidos); falta de rechazo anticipado de las nuevas rutas antes del streaming (corregida); inferencia TypeScript de componente de redirección como Promise<void> (corregida). El primer fixture SQL suponía que recibidas coincidía con consultas nuevas: se corrigió la expectativa para incluir una oportunidad anterior asignada en el período; no se alteró la fórmula.

Resultado final: lint sin advertencias, tipos/build y 18 pruebas Node pasan, incluida la suite SQL con sus aserciones internas. `git diff --check` sin errores. Node informa MODULE_TYPELESS_PACKAGE_JSON al importar TypeScript; no impide pruebas. Se verifican carga demo repetida sin sobrescribir una edición, separación real/demo, rangos sobre la misma unidad y respuestas cambiarias inválidas.

Navegador: `npm run check:ui -- http://127.0.0.1:3104 --reports` pasa con 20 verificaciones de layout y sin errores de consola en 1440/768/390/320 px. Login/inicio admin, rutas sin sesión, cifras demo pobladas, detalle conectado, filtros vendedor/fechas sin recarga, rango inválido, valores exactos/sliders sincronizados, interruptor muestras/vacío en cuatro módulos y DolarAPI oficial compra/venta. También comprueba BackLink, resumen y oportunidades por vehículo. Capturas en `.next/ui-qa/build/` (no versionadas).

`--inventory` pasa con 20 verificaciones de layout y cero errores: escritura rápida, espacios/foco/Enter, rangos de año/precio, validación de extremos, moneda, limpieza, fichas y formularios sin guardar. Se comparó `performance.timeOrigin` para verificar ausencia de recarga del documento. `--real --smoke`, contra servidor local con `PELUCARS_DEMO_TOOLS=false`, confirma ausencia de interruptor y muestras, incluso con `source=demo` en URL; no modifica configuración persistente.

`--guards --smoke` pasa con JWT válido de la cuenta de vendedor existente, que está deshabilitada: rechaza Reportes/detalle y demás rutas sin mostrar datos. No se habilitó la cuenta. El vendedor habilitado y admin deshabilitado se probaron en SQL aislado; falta el recorrido de login/navegación con vendedor habilitado en navegador. No se hicieron mutaciones comerciales desde el navegador.

La UI final usa RPC habilitada contra Supabase remoto; cifras pobladas, detalle y modo vacío verificados. Bugs detectados en esta ampliación: identificadores determinísticos PostgreSQL rechazados por validación RFC (se usa GUID con regresión de formato), enlaces de intereses históricos hacia otro conjunto (se omite sólo el enlace) y barra superior ajustada en tablet (permite envolver). Pruebas posteriores pasan. Las huellas de nueve tablas preexistentes coincidieron antes/después de migración y carga aditiva. No hubo mutaciones comerciales desde el navegador. La cuenta de vendedor disponible en las credenciales de QA sigue deshabilitada; no se alteró para probar.

## Pendientes de integración y negocio

Las tres migraciones de este incremento se aplicaron tras autorización explícita posterior. Ventas requiere D17 y snapshots de cierre; score necesita D08 y snapshots de asignación. Avisos de stock dependen de D20; no se eligieron destinatarios/compatibilidad/reingresos por cuenta propia. Disponibilidad/capacidad, siete días, cola, emails, reapertura, uso comercial del tipo de cambio y carga externa siguen abiertos. La interfaz no completa esos compromisos.
