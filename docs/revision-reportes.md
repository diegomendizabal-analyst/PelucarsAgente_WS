# Revisión de Reportes, demo e inventario — 24/11/2026

Rama: `reportes-primer-incremento`. Base: `main`, originalmente `fa4be36`. Revisar el diff completo de la PR, conservando cualquier cambio local del usuario. La PR se entrega en borrador para revisión independiente y pruebas manuales; no implica autorización de merge ni despliegue.

## Contexto y alcance

Leer `frontend/AGENTS.md`, [continuidad](continuidad.md), [Reportes](reportes.md), [demo temporal](demo-temporal.md), [presupuesto multimoneda](inventario-presupuesto.md), [decisiones](decisiones.md) y las referencias V3/V2. Los documentos de referencia distinguen diseño futuro de implementación; verificar código y migraciones.

- Reportes exclusivo de administradores habilitados e inicio por rol. Agregados SQL, detalle paginado, filtros automáticos, atribución y separación período/situación actual.
- Demo temporal del equipo: activada muestra sólo muestras; desactivada muestra vacío. Sin la herramienta habilitada desde servidor, sólo datos reales. Verificar también fichas, acciones y notificaciones, no sólo listados.
- Inventario con rangos exactos/deslizables sincronizados, filtros automáticos y presupuesto en ambas monedas usando **Oficial/Venta** provisional. Precio original único, equivalencias calculadas antes de paginar y condiciones sobre la misma unidad.
- Widget de dólar, actualización manual y calculadora informativa con elección explícita Compra/Venta; mejoras visuales y pendientes de navegación autorizados.
- Ventas y score tienen interfaz pendiente de integración, no métricas terminadas ni ceros ficticios. Bot, ventas y actividades manuales no se implementan en este incremento.

## Pruebas aisladas reproducibles

Desde `frontend`, usar una versión de Node que soporte importar los `.ts` usados por las pruebas (esta revisión se ejecutó con Node 26.13.1). En Windows usar `npm.cmd`; en otros sistemas, `npm`. Para una copia nueva, ejecutar `npm.cmd ci` primero.

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:auth
npm.cmd run test:inventory
npm.cmd run test:crm
npm.cmd run test:exchange
npm.cmd run test:reports
npm.cmd run build
```

En una copia nueva, `typecheck` puede necesitar los tipos generados por Next: ejecutar primero `npm.cmd run build` si todavía no existen. Las pruebas reúnen **20 casos Node**. Uno ejecuta todas las migraciones y suites SQL en PostgreSQL WASM en memoria, con identidades locales ficticias y carga demo idempotente; no conecta con Supabase remoto. Incluye permisos/RLS, fechas, más de mil consultas y presupuesto con más de una página de modelos. La simulación local de Auth no sustituye una prueba integral de Supabase Auth.

Build requiere configuración del proyecto en `.env.local`; partir de `.env.example` sin inventar credenciales. Si no se dispone de configuración o navegador, ejecutar las comprobaciones independientes y documentar el bloqueo restante, sin crear ni alterar cuentas. No publicar archivos `.env*` salvo `.env.example`, claves, contraseñas ni sesiones.

## Navegador y pruebas manuales

Usar un servidor local ya iniciado o `npm.cmd run start -- --port 3104` después del build. No detener el servidor que esté usando el usuario ni ejecutar build mientras otro proceso de QA depende del mismo `.next`. Chrome/Chromium es necesario; `CHROME_BIN` permite señalar su ejecutable. La automatización utiliza un perfil de navegador separado.

Con acceso local a las credenciales existentes en `frontend/.env.demo.local` (`DEMO_ADMIN_EMAIL` y `DEMO_ADMIN_PASSWORD`), ejecutar secuencialmente:

```powershell
npm.cmd run check:ui -- http://localhost:3104 --reports --smoke
npm.cmd run check:ui -- http://localhost:3104 --budget --smoke
npm.cmd run check:ui -- http://localhost:3104 --exchange --smoke
```

Sin credenciales, `npm.cmd run check:ui -- http://localhost:3104 --public-only --smoke` verifica acceso público y rutas cerradas. No omitir los flags para lanzar un recorrido distinto inadvertidamente. La evidencia se guarda bajo `frontend/.next/ui-qa/build`, ignorada por Git y eliminable por el próximo build. Los recorridos indicados leen los datos comerciales, cambian filtros/cookie demo y autentican sesiones de prueba; no guardan cambios comerciales. DolarAPI y la base remota deben estar disponibles para los recorridos integrados.

Pruebas manuales recomendadas:

1. Admin entra a Reportes; vendedor habilitado entra a Oportunidades y no accede a Reportes ni a sus RPC. La cuenta de vendedor usada por el recorrido `--guards` estaba deshabilitada: esa evidencia comprueba bloqueo, no navegación de vendedor habilitado. Los roles habilitados/deshabilitados sí se prueban en SQL local; no habilitar cuentas para completar QA.
2. Demo apagada vacía Reportes, Oportunidades, Clientes, Vehículos y avisos; encendida recupera las muestras. Revisar que un enlace guardado no cruce conjuntos.
3. Cambiar fecha/vendedor: los KPI del período cambian según las fórmulas; cartera/demanda usan situación actual. Revisar estado vacío, error y secciones pendientes.
4. Buscar un presupuesto ARS y luego USD que incluya unidades de ambas monedas. Confirmar límites inclusivos, precio original conservado, equivalente y cotización visible, filtros en la misma unidad, paginación y sincronización teclado/deslizadores.
5. Actualizar dólar; probar calculadora en ambos sentidos y ambos tipos de cotización. Probar sin cotización y con importe inválido/vacío/cero. El botón del widget no recalcula inventario ya cargado: volver a filtrar o actualizar la búsqueda.
6. Revisar contraste, foco de teclado y disposición en escritorio, tablet y móvil, especialmente estados, filtros y panel del dólar.

## Base remota y límites de revisión

Estas cuatro migraciones ya se aplicaron a Supabase con autorización explícita del usuario:

- `20261124125922_admin_reports.sql`
- `20261124132709_inventory_year_ranges.sql`
- `20261124132919_demo_data_isolation.sql`
- `20261124145350_inventory_budget_conversion.sql`

No volver a aplicarlas ni editar su historia: una corrección de base debe proponerse como migración nueva. Durante esta revisión no ejecutar `db push`, `db reset`, `demo:load`, `demo:reset`, `users:bootstrap`, `LoadDemo`, `Apply` ni el flag `--notifications` (marca avisos leídos). No modificar cuentas, seed ni registros remotos. El usuario hace pruebas manuales en paralelo.

La demo añadida contiene 24 consultas/clientes, 4 modelos y 9 unidades; se conservaron 7 consultas demo anteriores. Los 3 modelos anteriores siguen clasificados `real` por defecto: auditar su procedencia antes de producción. Eliminar las muestras y retirar la herramienta temporal requiere trabajo posterior; apagar el flag no borra datos. Cotización definitiva, atribución histórica de pérdidas, reglas de ventas y bandas de score continúan pendientes.

## Evidencia y entrega del revisor

Al preparar la PR: 20/20 pruebas Node, lint, tipos y build pasan. Se repitió `check:ui -- http://localhost:3104 --reports --smoke`: aprobado, con Reportes/detalle, filtros automáticos, rangos exactos, demo/vacío, actualización manual DolarAPI y dos anchos móviles; sin mutaciones comerciales. Los recorridos integrados anteriores y sus límites están registrados en los documentos de cada funcionalidad; no confundir checks automatizados con la aceptación manual pendiente del usuario.

Incidencias al repetir QA: el servidor iniciado sin acceso de red no pudo autenticar; se reinició únicamente el servidor de QA con conectividad. Además, el recorrido Reportes esperaba cualquier `.dollar-refresh` habilitado, incluyendo el botón Cerrar, y podía pulsar Actualizar mientras todavía estaba deshabilitado. Se corrigió la espera para identificar explícitamente `Actualizar cotización`, conservando la comprobación de una sola solicitud manual al proveedor.

Entregar hallazgos por severidad con archivo/línea, reproducción, impacto y prueba que falta o falla. Diferenciar bugs de preferencias visuales y decisiones de negocio pendientes. Informar comandos ejecutados, resultados y límites del entorno. No afirmar que una métrica está completa sólo porque tiene interfaz. Proponer cambios antes de alterar el alcance, sin merge ni despliegue automáticos.
