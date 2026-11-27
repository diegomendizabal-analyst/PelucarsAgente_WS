# Continuidad — Reportes, 24/11/2026

## Oportunidades: actualización 27/11/2026

**Prioridad posterior al rediseño:** cerrar el ensayo funcional nuevo de #14/#15; #16 queda para después. Se verificó GitHub y se actualizó origin: #13 integrado en main ca40789, #14 y #15 abiertos sobre main. QA 3114 continúa; el usuario confirmó que cerró voluntariamente 3000. El chat de n8n prepara una nueva oportunidad demo para el caso Ranger/Amarok, USD 12.000 a agregar y score esperado 70/100; todavía falta la referencia y el resultado. Ver [pendientes concretos para integrar #14](qa-ficha-oportunidad.md#cierre-funcional-pendiente-y-ensayo-nuevo). Los cortes de PR/base descritos más abajo corresponden a la implementación anterior.

**D07 aprobada, aún no implementada:** se leyeron [alcance V4](https://app.notion.com/p/425b6a1d71a48148a19adacf591e1d6d) y [modelo V3](https://app.notion.com/p/425b6a1d71a481089b99d407f6bd64f9). Continuidad por búsqueda y pausa fija de 72 horas por contacto/número comercial desde el cierre, incluso temprano. Mensajes durante pausa se conservan sin IA, respuesta o alta automática y no la prorrogan; nuevo ciclo sólo ante mensaje elegible, sin resetear cupos históricos. Preparar implementación atómica, migración/pruebas locales con tiempo controlado y handoff después del ensayo, en PR funcional separado. No confundir las referencias históricas de D07 pendiente de decisión con este estado nuevo.

Se actualizó desde origin/main (b090581) antes de implementar. GitHub confirmó #11/#12 mergeados; se conservó wsp/ sin versionar. Primer incremento: [PR #13](https://github.com/diegomendizabal-analyst/PelucarsAgente_WS/pull/13), persistencia comercial con corte, reintentos y protección de ediciones. Segundo incremento: codex/panel-oportunidades-score, dependiente del primero, ficha estructurada, conversación paginada y score vigente por mensaje/versión.

**Estado de desarrollo verificado el 27/11**: el usuario aplicó las migraciones de score, datos comerciales y lecturas del panel e informó `00-verificar.sql` con todos los resultados true. Las consultas reales de PostgREST funcionan. Este trabajo no aplicó SQL remoto, seed, deploy ni merge, ni modificó n8n, Meta, hosting, cuentas o datos comerciales remotos.

### Rediseño de la ficha y QA de PR #14

Se volvió a ejecutar fetch de origin y a consultar GitHub: #13 y #14 abiertos, #14 basado en `codex/oportunidades-completas`; main b090581 todavía no contiene esos incrementos. Implementación aislada en `.pr-work/qa-pr14-real`, rama local `codex/ficha-oportunidad-diseno`, destinada a actualizar el mismo #14. El checkout original y `wsp/` se conservaron. Se reutiliza Next en **3114**; el servidor del usuario en **3000** no se detuvo ni reemplazó.

Ficha de prueba: http://127.0.0.1:3114/oportunidades/19f65c2c-a0d1-4e0f-8ee3-fef55f27ca13 — **OP-000063**, cuenta administradora habilitada y Datos demo visibles. Lectura real: nombre de perfil no verificado, presupuesto total USD 20.000, compra dentro de 15 días, sin usado ni financiación, score 50/100 Medio con tres evidencias y seis mensajes. El interés Corolla conserva `vehicle_id`, `requested_brand` y `requested_model` NULL: la extracción histórica no permite vincularlo al catálogo. No completar atributos leyendo el resumen.

Score compacto en el encabezado con detalle accesible; resumen y campos agrupados; gestión a la derecha y desplegable en móvil; conversación en burbujas y orden ascendente por posición confirmada, páginas anteriores con cursor y anclaje de lectura; registros sin posición separados. No se cambiaron reglas, escrituras ni permisos. Pendiente de evaluación, valores sin informar y fallos de lectura son estados distintos. Ver [validación del rediseño](qa-ficha-oportunidad.md).

Diagnóstico, contrato para n8n, pruebas y decisiones agrupadas de ventas: [oportunidades-integracion.md](oportunidades-integracion.md). D07 y asignación de nuevos clientes siguen pendientes. D08 conserva la versión del prototipo. Ventas continúa sin sales ni métricas reales: Notion marca atribución, corrección/anulación y fórmulas como decisiones/propuestas pendientes. No se habilitó un cierre ficticio ni se agregó actividades.

Los apartados siguientes documentan cortes anteriores; no sustituyen esta actualización.

## Cierre del simulacro WhatsApp · 26/11/2026

Se completaron tres turnos reales con un remitente autorizado. El historial mostró seis mensajes en orden, sin duplicados. El bot preguntó por el presupuesto, preguntó por el usado y cerró en el tercer cupo. El destinatario confirmó la recepción. La lectura final devolvió `waiting_assignment`, `reserved_slots=3` y `sent_count=3`. El resumen guardó Corolla automático desde 2022, presupuesto total de USD 20.000, compra dentro de 15 días, sin usado ni financiación. El workflow quedó sin publicar y con el procesamiento deshabilitado.

**Balance respecto del plan de hoy.** Se verificaron el envío, la conversación de tres turnos y el resumen persistido. El score, su desglose y sus evidencias siguen pendientes de integración y visualización. El [PR #12](https://github.com/diegomendizabal-analyst/PelucarsAgente_WS/pull/12) contiene la migración, el contrato y pruebas locales de guardado, reintentos, concurrencia y permisos. El resultado local corresponde a una extracción de prueba. La evaluación del simulacro en la base remota sigue pendiente.

### Por dónde retomar el 27/11

1. **Nombre y datos comerciales.** El teléfono quedó registrado y el nombre quedó vacío según la revisión del usuario. Revisar el evento ya guardado para ver si WhatsApp aportó un nombre de perfil para ese remitente. Si está disponible, proponer completar `customers.full_name` cuando esté vacío y conservar los nombres ya cargados por el equipo. Mantener el teléfono como identificador y dejar el nombre pendiente si falta. Comparar la extracción existente con los campos reales de cliente, oportunidad e interés. Mapear presupuesto total y moneda, plazo, usado y financiación, distinguiendo una negativa explícita de un dato desconocido. Probar que un reintento no duplique datos y que un mensaje anterior no pise uno posterior.
2. **Interés y catálogo.** Conservar la búsqueda original en `lead_interests.requested_text`, con año mínimo y transmisión. Buscar una ficha de marca/modelo del mismo origen. Con una coincidencia inequívoca, vincular el interés por `vehicle_id`. Si falta el modelo o hay varias coincidencias, conservar el interés sin vínculo para revisión del equipo. En el panel, comprobar si una misma unidad satisface año, transmisión y presupuesto. La relación con el catálogo es interna al CRM y no implica prometer disponibilidad ni precio por WhatsApp.
3. **Score y evidencias.** Revisar el PR #12 y la decisión D08 sobre las reglas comerciales. Tras revisar y autorizar la migración, conectar `save_bot_score` al cálculo existente en n8n. Reutilizar una extracción guardada y verificar total, desglose, versión y citas vinculadas a los mensajes del cliente. Repetir el guardado del mismo corte y comprobar `unchanged`, una sola evaluación y las mismas evidencias.
4. **Panel.** Contrastar la ficha de la oportunidad con la base: nombre y teléfono del cliente, interés y ficha de catálogo cuando corresponda, presupuesto, plazo, usado, financiación, resumen y score con su desglose y evidencias. Mostrar los valores desconocidos como pendientes. Comprobar la vista del administrador y del vendedor asignado, y que los datos privados sigan fuera de la bandeja de pendientes.
5. **Producción.** Pelucars prevé entregar su número y el acceso a su cuenta de Meta Developers. Cuando lleguen, verificar la aplicación, la cuenta de WhatsApp, el número y las suscripciones existentes antes de configurar las credenciales y coordinar una prueba autorizada. Queda pendiente también la credencial de OpenAI del cliente.

## Recepción del bot — 25/11/2026

Primera etapa implementada en rama desde `main` en `f371714`. Conversaciones y mensajes sobre oportunidades explícitas, ingreso idempotente, historial, cupos y confirmación de salientes, con permisos heredados del CRM. Las pruebas de concurrencia y permisos pasaron en PostgreSQL local. La migración revisada ya está aplicada y registrada en desarrollo. Ver [contrato para n8n, pruebas y pendientes](bot-conversaciones.md). D07 y el reparto de clientes nuevos siguen pendientes. Score y evidencias corresponden a la etapa siguiente.

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
- **OP-000060 quedó en `waiting_assignment`.** Antes de #46, la lectura #45 verificó dos reservas y cero envíos. Al terminar se deshabilitó el procesamiento y los workflows siguen sin publicar.
- **#34, cupo 1.** El nodo HTTP informó `invalid syntax` al construir la solicitud. La reserva quedó `unknown`, sin ID de Meta. Revisar cómo distinguir un error local previo al transporte de una respuesta incierta. El cuerpo se corrigió para el siguiente turno.
- **#35, cupo 2.** El nuevo intento fue rechazado por Meta con HTTP 403 y código 131005. La reserva quedó `failed`, sin ID de salida. En #37 figuraban concedidos los permisos de gestión y mensajería. La causa específica del rechazo sigue pendiente.
- **Diagnóstico del 26/11.** El control aislado #38 recibió 401 / 190 y #39 confirmó el vencimiento del token. Con la credencial actualizada, #40 verificó la app, la cuenta, el número y los permisos. Meta aceptó el envío aislado #41 y el destinatario confirmó la llegada. Ninguno de estos controles consumió cupos.
- **Prueba integrada #46.** El trigger recibió «No entrego usado» del remitente autorizado. La entrada fue nueva (`created=true`). El flujo reservó el cierre en el cupo 3, obtuvo una sola toma y lo envió una vez por WhatsApp Business Cloud. Supabase registró `sent` con el ID de Meta y el destinatario confirmó la recepción en el celular.
- **Verificación #47.** `reserved_slots=3`, `sent_count=1`. El historial muestra tres entradas del cliente y el cierre del bot en ese orden. Los cupos 1 y 2 conservan `unknown` y `failed`. Conservar los registros y evitar reenvíos. El score y las evidencias quedan pendientes.
- **Resumen de OP-000060.** La extracción de #46 incluye los tres turnos del cliente. El PR #10 incorpora la RPC que escribe en `leads.summary` y registra el mensaje de origen. El borrador del workflow la llama antes de decidir la respuesta. La suite local comprobó el resumen literal, concurrencia, permisos y reintentos. La lectura #48 había dado `summary=NULL`. Tras aplicar y registrar `20261126132000`, se verificaron la versión, la tabla y la firma. Desde el SQL Editor se llamó a `save_bot_lead_summary` con el entrante «No entrego usado» y el resumen de #46. El operador confirmó `applied`. La prueba aislada de n8n #49 reutilizó los UUID y el resumen exacto de #46. Una sola llamada del nodo devolvió `unchanged` con el ID del mensaje de origen. Las lecturas previa y posterior devolvieron el mismo texto y el mismo `leads.updated_at` (`2026-11-26T13:47:51.506248+00:00`). Ambas confirmaron `waiting_assignment`, tres cupos reservados y un envío. El flujo temporal de verificación quedó archivado.

[Inventario de workflows y resultados](../n8n/workflows/README.md)

### Reportes y CRM

> Leer continuidad, reportes, demo-temporal, decisiones y modelo vigente. Revisar Git conservando cambios locales. SQL de Reportes/rangos/separación está aplicado; frontend local y muestras cargadas. Ventas/score sólo tienen interfaz y actividades son posteriores. No resetear seed ni alterar cuentas. Demo activa muestra muestras; apagar muestra vacío. Su retiro definitivo requiere purga revisada, no solamente apagar el flag.
