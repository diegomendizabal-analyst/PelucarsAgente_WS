# Demo temporal y cotización — 24/11/2026

Herramienta del equipo durante la preparación de Pelucars, no función comercial del cliente. El usuario autorizó actualizar Supabase y agregar muestras sin reiniciar ni borrar registros ni alterar cuentas.

## Funcionamiento

`PELUCARS_DEMO_TOOLS=true` (sólo servidor) habilita **Datos demo** en la barra superior, encendido inicialmente. Una cookie HttpOnly recuerda la elección. Después de guardarla se recarga el documento completo, con “Cambiando…” durante la operación. Encendido muestra exclusivamente consultas `source=demo` e inventario `source=demo`; apagado muestra pantallas comerciales vacías, incluyendo avisos. No cambia roles, cuentas ni datos. Reportes sigue siendo exclusivo de admin. Las acciones comerciales comprueban el conjunto en servidor y rechazan operaciones desde la vista vacía.

Con el flag ausente o `false`, desaparece el interruptor; el servidor consulta exclusivamente leads `whatsapp_bot` y vehículos `real`, ignorando cookies y parámetros de origen del navegador. La gestión de cuentas permanece operativa. El widget cambiario es información externa real, rotulada como referencia en su detalle. La banda explicativa demo se retiró por pedido del usuario.

Clientes y contadores se derivan del origen de sus consultas. Intereses históricos que apuntan a inventario de otro conjunto conservan su texto, pero no ofrecen enlace a esa ficha. Los permisos existentes continúan vigentes; el interruptor no concede acceso adicional.

## Carga realizada

- Migraciones aplicadas: `20261124125922_admin_reports.sql`, `20261124132709_inventory_year_ranges.sql`, `20261124132919_demo_data_isolation.sql`.
- `supabase/demo/reports.sql`: 24 clientes/consultas, 4 modelos, 9 unidades, intereses, asignaciones y estados variados. Fechas relativas a la primera carga, sin desplazarlas al repetir.
- Resultado: 31 consultas demo (7 anteriores + 24 nuevas), 4 modelos demo y 9 unidades. Se conservaron 3 modelos anteriores con origen `real` por defecto. Esa etiqueta no certifica datos de producción: revisar procedencia antes de entregar.
- IDs determinísticos con prefijo lógico `pelucars-reports-demo-20261124`; transacción y bloqueo asesor. Repetir no sobrescribe registros existentes ni sus modificaciones. No crea/habilita cuentas, ni carga ventas/score ficticios.
- Huellas de registros preexistentes antes/después en nueve tablas: perfiles, clientes, vehículos, unidades, auditoría de inventario, leads, asignaciones, estados y avisos. Coincidieron; se excluyó únicamente la nueva columna `source` de la huella.

`scripts/report-increment.ps1`: Inspect, Fingerprint, Plan, Apply, LoadDemo y Status. Configuración local ignorada por Git, sin imprimir credenciales. Apply revisa el plan y admite sólo las tres migraciones, sin seed. No usar `demo:reset` para esta entrega. Idempotencia verificada con dos cargas en PostgreSQL aislado, conservando una edición entre ambas.

## Retiro antes de datos reales

El usuario indicó eliminar las muestras por completo y retirar la herramienta antes o alrededor de la entrega. **Todavía no se borró nada.** Antes de ingresar información real, revisar registros antiguos y relaciones; preparar una purga acotada de muestras y dependencias con comprobaciones de integridad. Desactivar el flag impide mostrarlas, pero no las elimina. Retirar también código/configuración temporal al cerrar la demo. No ofrecer al cliente un selector permanente de muestras.

## DolarAPI

Oficial por decisión provisional del usuario, pendiente de conversación con el cliente. Compra/venta en ARS por USD, nombre y fecha de la fuente; no convierte importes de inventario o Reportes. `DOLAR_API_CASA=oficial` permite cambiar referencia desde servidor (implementadas oficial y blue; otras requieren ampliar validación).

Control compacto en barra superior, con compra/venta, detalle desplegable y botón **Actualizar cotización**. Endpoint autenticado `/api/cotizacion`, proveedor fijo `https://dolarapi.com/v1/dolares/oficial`, timeout 6 segundos y caché automática de 5 minutos. Consulta al montar, al recuperar visibilidad y cada 5 minutos con pestaña visible. El botón usa `?refresh=1` y `cache:no-store` hacia el proveedor: no devuelve sólo la caché anterior. No garantiza que el proveedor cambie su valor/fecha. Respuesta inválida nunca se convierte en cero; muestra indisponibilidad o último dato con fecha y aviso de fallo. Fuente: [documentación DolarAPI](https://dolarapi.com/docs/argentina/operations/get-dolares).

Calculadora informativa autorizada e implementada el 24/11 dentro del detalle del widget. Permite ARS → USD y USD → ARS, con elección explícita Compra/Venta (sin tasa predeterminada). Muestra la tasa usada y conserva la fecha de la fuente. Fórmulas: ARS / cotización = USD; USD × cotización = ARS. No redondea pasos intermedios; presenta resultado con dos decimales. Admite coma/punto decimal, importes desde cero y hasta 12 enteros/2 decimales, sin separadores de miles. Vacío, inválido o cotización ausente muestran `—`, nunca un cero ficticio. Si falló la actualización, identifica el uso del último dato recibido.

Todo el cálculo ocurre en navegador: no persiste ni modifica precios, presupuestos, filtros o totales comerciales. Pendiente con cliente: referencia definitiva, uso comercial y tipo de cambio acordado para futuras ventas. No hay ajuste manual de cotización.

Pruebas: `test:exchange` (3 casos con múltiples aserciones), lint y build/tipos pasan; `check:ui -- http://localhost:3000 --exchange --smoke` verifica ambas direcciones y tasas, decimales, inválidos, cero/vacío, ausencia de recarga y cierre/foco en 1440/390/320 px, altura 600 px. Captura móvil inspeccionada, cero errores de consola.
