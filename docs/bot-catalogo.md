# Alta de marca/modelo desde el bot

Incremento funcional posterior a D07, solicitado el 27/11 como parte del alcance inicial. Se prepara en un PR separado sobre `codex/d07-pausa-72h` (#17 todavía abierto al iniciar), sin incorporar #16. La autorización actual sustituye las menciones históricas de “alta de catálogo pendiente D16”. No autoriza unidades, stock, precios ni aplicación remota.

Migración local: `20261127155419_bot_catalog_intake.sql`. **No aplicada a Supabase de desarrollo.** Handoff: [handoff-catalogo-n8n.md](handoff-catalogo-n8n.md).

## Comportamiento

El bot reutiliza la ficha del mismo origen cuando marca y modelo coinciden con la normalización existente: `btrim`, colapso de espacios y minúsculas. No corrige nombres, cambia fechas, restaura archivos ni modifica el origen de una ficha existente. La unicidad incluye ambas columnas y `source`, no su concatenación.

Si falta esa ficha y la identidad del **vehículo buscado** es inequívoca y está respaldada por texto literal, crea sólo `vehicles`: marca, modelo y origen técnico derivados de la oportunidad (`demo` → `demo`, `whatsapp_bot` → `real`). El caller no puede seleccionar otro origen. Una coincidencia sólo en el otro origen no se reutiliza: se crea la ficha del origen correcto.

Una ficha archivada se conserva sin vínculo automático ni restauración; el resultado es `archived`. No se crea un duplicado para evitar su archivo. Los estados `ambiguous` e `insufficient` guardan la extracción comercial y el interés sin vínculo, sin crear catálogo. No convierten una camioneta genérica o una lista de alternativas en un modelo.

No se crean `inventory_units`, códigos de unidad, años de unidades, kilometraje, disponibilidad ni precios. Año/transmisión siguen siendo atributos de la búsqueda. La ficha de catálogo aparece con cero unidades; **existencia de marca/modelo no significa stock disponible**. No se cambia el motor del score.

## Contrato atómico

POST `/rest/v1/rpc/save_bot_lead_details_with_catalog`, sólo `service_role`, después de la admisión/resolución D07 y antes de reservar respuesta. La nueva RPC sustituye la llamada a `save_bot_lead_details` para ese turno; **no llamar primero a la anterior y después intentar completar catálogo**.

Parámetros:

| Parámetro | Contenido |
| --- | --- |
| `p_conversation_id`, `p_message_id` | Conversación y entrante devueltos por D07. |
| `p_extraction` | Objeto completo del contrato comercial vigente. |
| `p_attributes` | Marca/modelo/año mínimo/transmisión separados; mismos nombres y tipos existentes. Predeterminado `{}`. |
| `p_provider_profile_name` | Nombre del proveedor opcional; no viene del modelo ni identifica un autor humano del alta. |
| `p_catalog_resolution` | Resolución explícita. Predeterminado `{"status":"insufficient"}`: nunca autoriza crear. |

Resolución inequívoca:

```json
{
  "status": "unambiguous",
  "role": "sought_vehicle",
  "message_id": "UUID del mensaje del cliente que contiene la cita",
  "quote": "Busco Ford Ranger"
}
```

La cita debe existir exactamente en un mensaje del cliente de la misma oportunidad/línea/proveedor, con posición confirmada no posterior al corte. Puede provenir de un ciclo anterior del contexto D07. No se acepta cita del bot, de otra oportunidad, futura ni reconstruida a partir del resumen. Marca/modelo deben aparecer como palabras completas tanto en la cita como en `vehiculo_buscado`; no alcanza una subcadena dentro de otra palabra. Se validan longitud (marca 80, modelo 120), tipos y ausencia de separadores/alternativas evidentes en los nombres.

La validación SQL acredita procedencia literal y consistencia de los campos; **no clasifica semánticamente un texto libre**. El extractor debe declarar `unambiguous` sólo cuando identifica una marca/modelo singular del vehículo buscado, sin duda, negación ni confusión con un usado. No usar conocimiento del modelo para inventar marca faltante ni crear aliases/errores tipográficos como marcas nuevas. No se implementa búsqueda difusa ni equivalencia de alias. Si la normalización literal no basta para afirmar una ficha inequívoca, conservar `ambiguous`/`insufficient`.

Resoluciones sin alta:

```json
{"status":"ambiguous"}
```

```json
{"status":"insufficient"}
```

Estos estados no admiten campos adicionales afirmando una identidad. La búsqueda original y características se conservan en los campos comerciales; no se deducen del resumen. Para el ensayo Ranger, Ford/Ranger es lo buscado y Volkswagen/Amarok es usado: `role=trade_in` se rechaza y atributos Amarok contradictorios con `vehiculo_buscado=Ford Ranger` también se rechazan.

Respuesta tabular (lista de una fila): `lead_id, source_message_id, outcome, vehicle_id, catalog_outcome`.

| Resultado | Tratamiento |
| --- | --- |
| `outcome=applied`, `catalog_outcome=created` | Datos comerciales, ficha, vínculo, procedencia y auditoría confirmados juntos. |
| `applied / reused` | Mismo guardado, reutilizando ficha exacta del mismo origen sin modificarla. |
| `applied / unresolved` | Extracción guardada; interés sin vínculo, sin alta. |
| `applied / archived` | Coincidencia archivada; `vehicle_id=NULL`, sin alta, restauración ni vínculo automático. |
| `unchanged` con resultado guardado | Reintento idéntico de la nueva RPC; no escribe nada, aunque haya pasado la pausa o existan ediciones posteriores. El resultado describe aquella operación, no disponibilidad actual. |
| `outcome=stale` o `unchanged`, `catalog_outcome=not_applied` | El corte está obsoleto o ya fue guardado por la RPC anterior: no completar catálogo retroactivamente. Conservar ese resultado y seguir el contrato de cortes/reintentos. |
| `PT409` | Petición distinta para el mismo corte, turno D07 no habilitado o edición independiente. Conciliar; no cambiar UUID, datos o cita para forzar el guardado. |
| `22023` | Resolución, atributos o evidencia inválidos. Toda la transacción se revierte. |
| `42501` | Rol sin permiso. La nueva RPC no se habilita para el panel. |

La petición completa se guarda en `private.bot_catalog_requests`. Los reintentos no cambian la ficha, sus fechas, el interés ni la auditoría. Tampoco completan OP-000063 ni OP-000064 con una nueva evidencia fabricada; no hay backfill ni carga de catálogo en la migración.

## Concurrencia, atribución y permisos

El ingreso requiere un turno D07 gestionado y habilitado; un silenciado no crea ni vincula catálogo. Primero se toman los bloqueos de contacto/cliente/oportunidad; bajo bloqueo se revalida idempotencia y después la vigencia del turno. Un reintento esperando detrás de una transacción que guarda y cierra obtiene la respuesta ya confirmada, sin nueva autorización de procesamiento.

La escritura usa el índice único existente `vehicles_source_brand_model_key` como árbitro y `INSERT ... ON CONFLICT DO NOTHING`. Si otra transacción crea la ficha, la siguiente lectura la reutiliza; no se usa un update ficticio que cambie fechas o autoría. La lectura toma un bloqueo compartido que impide cambiar/archivar esa ficha durante el vínculo. Bajo aislamiento que devuelva `40001`, reintentar la transacción completa con idéntica petición, sin repetir IA.

La creación, el vínculo del interés, la copia de procedencia comercial y el evento de auditoría se confirman juntos. Un fallo posterior al insert revierte también catálogo y evento. La RPC no queda expuesta como un “crear modelo” independiente que eluda la pausa o pueda ejecutarse sin oportunidad/entrante.

`vehicles.created_by` admite NULL sólo para `origin=intake`. No se elige un administrador arbitrario ni se crean cuentas técnicas. La creación añade un evento `vehicle_created`, actor NULL con `changes.actor=bot`, mensaje de origen, cita y snapshot de la ficha. `inventory_events` sólo permite actor NULL en ese evento de creación de ficha sin unidad y con procedencia bot explícita. Las altas/ediciones administrativas mantienen su autor y controles actuales. La tabla de peticiones es privada, con RLS y sin acceso directo del panel o `service_role`.

## Validación local y transición

En `frontend`: `npm run test:bot-catalog`. PostgreSQL WASM efímero: creación/reutilización, normalización, demo/real, autoría, reintentos y fechas, usados, ambigüedad/falta de atributos, evidencia ajena/inventada, archivo, corte antiguo entre líneas, protección D07/permisos, no backfill y rollback después del insert. Todas las pruebas comprueban ausencia de unidades y eventos de stock.

Desde raíz: `python supabase/tests/bot-local.py --catalog-only`. Reutiliza el clúster privado del runner, sin aceptar URL remota. PostgreSQL 17.12 y conexiones concurrentes reales, espera `Lock` observada: bot/bot, administrador/bot, creador que revierte y reintento bloqueado detrás de guardar+cierre. Resultado: una ficha y un evento por alta efectiva; cero unidades/precios.

También se ejecutaron las regresiones pertinentes de D07, persistencia comercial, score y esquema/SQL CRM/inventario. No cambia la interfaz ni el workflow; no corresponde repetir rediseño, capturas o build. QA3114 queda en main.

Resultado efectivo del 27/11: cuatro escenarios de catálogo y siete regresiones Node/PostgreSQL WASM aprobados; suite concurrente nativa PostgreSQL 17.12 aprobada. El clúster temporal se detuvo al terminar. La nueva prueba JavaScript pasa lint. Sin aplicación remota ni prueba HTTP/WhatsApp de este incremento.

Antes de integrar/aplicar: revisar #17 y este PR en ese orden; verificar permisos/contratos HTTP después de una aplicación autorizada; adaptar el extractor y la única llamada de persistencia según el handoff. No publicar workflow, enviar WhatsApp ni completar registros existentes como parte de la revisión de este documento.
