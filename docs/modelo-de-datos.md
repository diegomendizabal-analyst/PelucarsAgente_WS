# Modelo de datos vigente — 24/11/2026

Fuentes vigentes: [modelo backend V2](referencias/modelo-backend-v2-2026-11-24.md) y [alcance V3](referencias/alcance-v3-2026-11-24.md), conservados tal como se recibieron. El [modelo reconciliado del 20/11](historico/modelo-de-datos-2026-11-20.md) queda como antecedente, incluyendo su diseño de actividades; no define el incremento actual.

## Implementado antes de Reportes

Ocho migraciones y once tablas: `profiles`, `user_admin_events`, `vehicles`, `inventory_units`, `inventory_events`, `customers`, `leads`, `lead_interests`, `lead_assignments`, `lead_status_history` y `lead_notifications`. Vistas: `vehicle_catalog`, `customer_directory`, `lead_timeline`. Operaciones controladas de usuarios, inventario, toma/asignación, cambio de estado y lectura de avisos. Ver [CRM](crm.md) y las migraciones; no confundir campos propuestos en referencias con columnas existentes.

El historial de estado no tiene responsable histórico ni score al cierre. Las asignaciones tampoco guardan evaluación de score. `leads.source` distingue `whatsapp_bot` y `demo`; las relaciones heredan ese criterio. En este incremento se agrega `vehicles.source` (`real`/`demo`); los clientes se seleccionan por origen de sus consultas.

## Incremento Reportes

Novena migración: `20261124125922_admin_reports.sql`. Agrega índices por origen/creación y fecha/receptor de asignación, la función privada `report_scope` y las RPC `get_admin_report` y `list_admin_report_details`. Aplicada a remoto con autorización explícita posterior del usuario. No agrega tablas de ventas/score ni modifica cuentas.

Décima y undécima migraciones aplicadas: `20261124132709_inventory_year_ranges.sql` y `20261124132919_demo_data_isolation.sql`. Incorporan búsqueda por rango de año en la misma unidad que precio/transmisión/stock, `vehicles.source` e índice, origen en `vehicle_catalog`, RPC `search_vehicle_catalog_range` e `inventory_filter_years_for_source`, vista `customer_directory_by_source` y operaciones `list_pending_leads_for_source` / `save_vehicle_for_source`. Los wrappers controlan acceso y el alta/edición auditada conserva origen. Las RPC anteriores se conservan para compatibilidad. Once tablas de aplicación, sin tablas nuevas.

La carga adicional `supabase/demo/reports.sql` inserta 24 clientes/consultas, 4 modelos y 9 unidades identificables, sin reiniciar las 7 consultas anteriores. Idempotente: no sobrescribe muestras existentes ni crea/modifica perfiles. Inventario anterior conserva `source=real` por defecto; su clasificación debe revisarse antes de producción, sin inferir por nombres. Procedimiento y retiro futuro: [demo-temporal.md](demo-temporal.md).

Las tres funciones son `SECURITY INVOKER`, con `search_path=''`, validación de administrador habilitado y parámetros. Las RPC revocan ejecución pública/anónima; authenticated necesita pasar el control admin. Agregados con snapshot de sentencia, intereses deduplicados y detalle paginado. No hay tabla editable de KPI ni secretos de servicio en el cliente.

La ficha de vehículo consulta oportunidades con intereses activos mediante relación embebida, con RLS y filtro del responsable antes de contar/paginar para vendedores. No requiere tabla nueva. Conserva el estado visible para distinguir espera de stock de oportunidades cerradas.

Definiciones, límites y cobertura: [Reportes](reportes.md).

Ampliación de inventario aplicada a Supabase tras autorización explícita el 24/11: `20261124145350_inventory_budget_conversion.sql` añade dos funciones de lectura para presupuesto multimoneda, sin nuevas columnas ni datos duplicados. Conserva `listed_price/currency` como única fuente original por unidad. Usa `numeric` para comparar equivalencias y RLS del invocador. [Estado y pruebas](inventario-presupuesto.md).

## Incluido en producto, pendiente de implementación

Ventas, ofertas, conversaciones, mensajes, evaluaciones/evidencias de score y snapshots históricos siguen siendo propuestas de la referencia V2. No se crean por anticipado. Ventas requieren transacción unidad/oportunidad e importes por moneda, con reglas de corrección/anulación por cerrar. Avisos por stock requieren D20; no existe `stock_alerts` en este incremento.

Actividades manuales, agenda y contadores de recontacto son **posteriores**. El historial automático existente se conserva. No se calculan contactos a partir de avisos leídos, aperturas de ficha ni cambios de estado.
