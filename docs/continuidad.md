# Continuidad — Reportes, 24/11/2026

## Estado de partida y alcance vigente

Rama de trabajo: `reportes-primer-incremento`, creada desde `origin/main` en `fa4be36` (PR1–PR5 integrados). Se conservaron los cambios locales al continuar. El usuario autorizó abrir una PR para revisión en GitHub y pruebas en otro chat; esta entrega se prepara como borrador, sin merge ni despliegue del frontend. Instrucciones reproducibles: [guía de revisión](revision-reportes.md).

Las referencias recibidas se incorporaron sin modificar a [alcance V3](referencias/alcance-v3-2026-11-24.md) y [modelo backend V2](referencias/modelo-backend-v2-2026-11-24.md). Sus propuestas no equivalen a estructuras implementadas. No existe AGENTS.md raíz; se leyó `frontend/AGENTS.md`, documentación local de Next y las skills React, Supabase y Postgres.

**Cambio confirmado:** Reportes entra ahora y es el inicio del administrador. Oportunidades permanece como inicio del vendedor. Actividades manuales, llamadas, reuniones, notas de seguimiento, agenda y contadores de recontacto pasan a una versión posterior. Se conserva el historial automático de estados y asignaciones.

## Entrega local

Corrección posterior a PR #6: nueva migración **local, no aplicada** `20261124153608_vehicle_catalog_source_uniqueness.sql` para unicidad de catálogo por origen, marca/modelo normalizados. Reproducción y regresión local verificadas. Revisión visual/responsive y límites de roles: [revisión de PR #6](revision-visual-pr6.md). La prohibición actual de aplicar migraciones remotas sigue vigente.

Revisión visual posterior del 24/11: se compactaron Reportes y filtros; estados con etiqueta/cifra juntas, definiciones desplegables, ventas/score agrupados sin ceros ficticios, mayor contraste y eliminación de ayudas repetitivas/banda demo. Rangos sobre una barra con dos extremos y campos exactos. Dólar como control compacto en barra superior, detalle desplegable y botón Actualizar que consulta nuevamente al proveedor. El interruptor demo recarga tras guardar la cookie y muestra “Cambiando…”. El fallo informado no se reprodujo en una sesión limpia de localhost:3000; se agregó esta recarga para asegurar actualización completa. Confirmación posterior: calculadora informativa con elección Compra/Venta autorizada e implementada; ver detalle abajo.

- Pantalla `/reportes`, detalle paginado `/reportes/detalle`, navegación e inicio por rol. Oportunidades se encuentra en `/oportunidades`.
- Filtros desde/hasta y vendedor/Todos (incluye deshabilitados y administradores), automáticos y sin botón Aplicar ni recarga completa. Últimos 30 días inclusivos, consultas al primer asignado, eventos al receptor y cartera al responsable actual.
- SQL agregado y detalle con control admin habilitado, RLS del invocador, fechas de Buenos Aires y separación por `leads.source`. Sin totales derivados de listas paginadas.
- Consultas, clientes, asignaciones, reasignaciones, mediana de primera asignación, cartera, pendientes, espera de stock, demanda y pérdidas globales conectados a Supabase con RPC habilitada y muestras cargadas.
- Ventas, importes ARS/USD, ticket, tasa de éxito, tiempo hasta venta y score: interfaz con “No disponible — pendiente de integración”. Las métricas no están terminadas.
- Pendientes adicionales autorizados: BackLink reconocible, interés sin recuadro anidado, paginación oculta cuando no hace falta, “Resumen de la consulta” y oportunidades por vehículo (propias para vendedor, todas para admin, intereses activos).
- Precio y año con deslizadores e ingreso exacto sincronizado, extremos inclusivos sobre la misma unidad. Presupuesto ARS/USD incluye equivalentes de ambas monedas usando **Oficial/Venta**, sin modificar precios originales. Migración `20261124145350_inventory_budget_conversion.sql` aplicada a Supabase tras autorización explícita adicional del usuario. Ver [inventario-presupuesto.md](inventario-presupuesto.md). Cambiar moneda limpia el rango.
- Interruptor global **Datos demo**, encendido inicialmente, alterna muestras/vacío. Función temporal del equipo controlada desde servidor; no selector permanente para el cliente. Procedimiento y retiro futuro: [demo-temporal.md](demo-temporal.md).
- DolarAPI oficial compra/venta con fecha y fallo explícito. Decisión provisional a conversar con cliente, sin conversión de precios.

Estado por ID, fórmulas, bugs y pruebas: [reportes.md](reportes.md). Modelo vigente: [modelo-de-datos.md](modelo-de-datos.md).

Verificación: 20 pruebas Node pasan al preparar la PR, incluida la suite PostgreSQL aislada con permisos, fechas, más de mil consultas, separación de fuentes, rangos, conversión e idempotencia de carga. Build/tipos y lint pasan. Recorrido final de navegador y evidencia en [reportes.md](reportes.md); sin guardar cambios comerciales ni alterar cuentas. Bugs corregidos: UUID determinísticos válidos en PostgreSQL rechazados por validación RFC del frontend (ahora formato GUID), enlaces de intereses a otro conjunto y barra superior demasiado ajustada en tablet.

## Límites operativos

La exclusión inicial de migraciones remotas fue sustituida por autorización explícita posterior: **«Sí, actualizar y cargar la demo»**. Se aplicaron `20261124125922_admin_reports.sql`, `20261124132709_inventory_year_ranges.sql` y `20261124132919_demo_data_isolation.sql`. No se reinició el seed, borraron datos ni alteraron cuentas; no se incorporaron actividades, bot ni módulo de ventas.

Carga aditiva: 24 consultas/clientes nuevos, 4 modelos y 9 unidades; total observado 31 consultas demo. Huellas de nueve tablas preexistentes coinciden antes/después. Los 3 modelos anteriores conservaron `source=real` por defecto; revisar su procedencia antes de producción, sin borrar por inferencia. Configuración local: `PELUCARS_DEMO_TOOLS=true`, `DOLAR_API_CASA=oficial` (archivo ignorado por Git).

Las pruebas SQL usan PostgreSQL WASM en memoria con identidades ficticias locales, no las cuentas de demo. Se conservan las muestras persistentes remotas y sus registros existentes.

## Próximos pasos

Pendiente de diseño solicitado durante la revisión de PR #6: repensar la vista de **todos los Clientes para el administrador**. Acordar organización y navegación antes de implementar; esta entrega conserva la vista actual y sólo cambia el filtrado manual por automático en Clientes y Oportunidades.

1. Revisar frontend y publicar dentro del flujo acordado. Antes de ingresar datos reales, preparar purga revisada de muestras y retirar herramienta temporal; apagar el flag no elimina registros. Revisar inventario anterior sin clasificación fiable. No hay purga ejecutada ahora.
2. Capturar responsable histórico del cierre antes de reportar pérdidas individuales. No atribuir al admin que cambió el estado ni rellenar con el responsable actual.
3. Implementar ventas como módulo independiente tras cerrar corrección/anulación (D17); conectar sus métricas por vendedor de cierre y moneda. No marcar stock vendido cambiando una etiqueta.
4. Implementar bot y score en incrementos siguientes tras acordar D07/D08, disponibilidad/capacidad y cola. No elegir bandas ni convertir ausencias en cero.
5. Avisos por ingreso de stock: incluidos en el producto, pendientes de D20 (compatibilidad, destinatario admin, reingresos y separación demo/real). No se implementaron por falta de definición.
6. Siguen pendientes alternativas comerciales, autoactualización de bandeja, decisión sobre correo al asignado, reapertura y revisión de cachés tras reasignación. Las actividades no son requisito previo.
7. Antes de producción: registro público de Auth bloqueado para configurar, protección de contraseñas filtradas y contactos históricos. No alterar esas cuentas/configuraciones dentro de este incremento.

Widget implementado con DolarAPI oficial y calculadora informativa ARS ↔ USD autorizada después de la revisión visual. Compra/Venta se elige explícitamente; muestra tasa usada y no persiste cambios. Pruebas de ambas direcciones, importes inválidos/cero/vacío y panel en tres anchos pasan, junto con lint y build/tipos. Cotización definitiva y uso comercial pendientes del cliente. Alta manual y carga externa siguen pausadas. El resto del pulido visual y manual de marca no quedan completados por esta entrega.

## Para retomar

### WhatsApp · Punto de partida para el 26 de noviembre de 2026

- La recepción real quedó confirmada después de suscribir la app a la cuenta de WhatsApp de prueba (#26–#27). En Supabase se comprobaron el ingreso sin duplicados, el historial, el contexto entre turnos y las reservas idempotentes (#19–#21).
- **OP-000060 está pausada.** La lectura #36 confirmó dos entradas del cliente, dos cupos reservados, cero envíos confirmados y estado `collecting`. El procesamiento volvió a quedar deshabilitado. Los workflows siguen sin publicar.
- **#34, cupo 1.** El nodo HTTP informó `invalid syntax` al construir la solicitud. La reserva quedó `unknown`, sin ID de Meta. Revisar cómo distinguir un error local previo al transporte de una respuesta incierta. El cuerpo se corrigió para el siguiente turno.
- **#35, cupo 2.** El nuevo intento fue rechazado por Meta con HTTP 403 y código 131005. La reserva quedó `failed`, sin ID de salida. En #37 figuraban concedidos los permisos de gestión y mensajería. La causa específica del rechazo sigue pendiente.
- **Primera comprobación de mañana.** Probar una sola vez el envío aislado que funcionó en #23 al destinatario autorizado, fuera de OP-000060. Comparar con el HTTP integrado la credencial y app, el Phone Number ID, el formato del destinatario, la versión de Graph, el cuerpo y el resultado de Meta. Registrar el ID de salida o el error sin exponer el token.
- Conservar la conversación, los mensajes y ambos cupos. No reenviar automáticamente las reservas anteriores. Quedan pendientes el guardado del resumen, score y evidencias.

[Inventario de workflows y resultados](../n8n/workflows/README.md)

### Reportes y CRM

> Leer continuidad, reportes, demo-temporal, decisiones y modelo vigente. Revisar Git conservando cambios locales. SQL de Reportes/rangos/separación está aplicado; frontend local y muestras cargadas. Ventas/score sólo tienen interfaz y actividades son posteriores. No resetear seed ni alterar cuentas. Demo activa muestra muestras; apagar muestra vacío. Su retiro definitivo requiere purga revisada, no solamente apagar el flag.
