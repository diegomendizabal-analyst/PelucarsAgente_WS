# D07: continuidad por búsqueda y pausa de 72 horas

Estado: implementación local para revisión en un PR funcional separado, basada en `origin/main` `2053064` (#13/#14/#15 integrados). **Migración no aplicada remotamente; workflow no modificado ni habilitado.** QA 3114 permanece en main. #16 sigue reservado para diseño.

Se leyeron completas la [decisión aprobada, alcance V4](https://app.notion.com/p/425b6a1d71a48148a19adacf591e1d6d) y la [especificación backend V3](https://app.notion.com/p/425b6a1d71a481089b99d407f6bd64f9). La aprobación del responsable del proyecto sustituye la propuesta histórica de siete días; no se atribuye aprobación comercial a Pelucars.

## Invariantes y alcance

- Primera consulta comercial válida: identificar cliente por E.164 y crear cliente/oportunidad sólo cuando corresponda. Un saludo, agradecimiento o duda sobre una compra anterior no crea una oportunidad.
- La misma búsqueda abierta conserva la oportunidad, aunque transcurran días. `new_search` también conserva una única oportunidad abierta; cambiar Corolla por Civic no equivale a compra adicional. `save_bot_lead_details` sigue reemplazando el interés activo y conservando el anterior.
- `additional_purchase` expresa una compra independiente explícita. Puede crear otra oportunidad cuando el contacto está habilitado, **compartiendo los cupos del ciclo activo**. Durante la pausa sólo se guarda. Una nueva búsqueda tras Vendida/Perdida crea otra oportunidad sin modificar la cerrada.
- Ciclo y pausa se identifican por `(source, phone_e164, business_phone_id)`. `source` mantiene aislamiento demo/real. El proveedor forma parte de la deduplicación, pero cambiar proveedor u oportunidad no cambia la pausa.
- Reservar `closing` cierra el ciclo y fija `closed_at` con reloj PostgreSQL y `pause_until=closed_at+72 hours`, en la misma transacción. Incluso un cierre en cupo 1 consume ese cupo y bloquea preguntas posteriores. Un rollback revierte reserva y pausa juntos.
- `pending`, `sending`, `failed`, `unknown` y `sent` no cambian el instante de cierre. Un reintento idéntico recupera la reserva; no extiende la pausa. Un fallo de transporte no reabre el ciclo ni libera cupos. No se afirma entrega o lectura.
- Durante la pausa: conservar entrantes en el historial para revisión, sin IA, extracción, score, respuesta ni alta automática. No prorrogar la pausa. Las entradas en cola cuando se confirma el cierre también quedan silenciadas.
- Exactamente al cumplirse las 72 horas un **nuevo mensaje** puede iniciar otro ciclo persistido. No hay cron, temporizador, envío proactivo ni reprocesamiento automático de los mensajes silenciados. Los ciclos, reservas y envíos anteriores permanecen intactos.
- No se agregan actividades, alta manual, captura del chat privado, controles de reactivación ni clases nuevas de avisos. Las nuevas oportunidades conservan los triggers actuales de recurrencia, asignación e historial; una asignación resultante conserva sus avisos existentes.

## Modelo y atomicidad

La migración `20261127153553_bot_contact_cycles_72h.sql` agrega cuatro tablas privadas con RLS, sin acceso de anon/authenticated/service_role a sus filas:

| Tabla | Responsabilidad |
| --- | --- |
| `bot_contacts` | Pausa, ciclo actual, turno exclusivo y bloqueo de conciliación por contacto/línea/origen. |
| `bot_cycles` | Inicio/cierre persistidos y referencia a la reserva de cierre. No guarda contadores reiniciables. |
| `bot_receipts` | Ingreso durable previo a clasificación, identidad externa única, posición, toma de procesamiento y resolución idempotente. |
| `bot_processing_limits` | Límites técnicos explícitos por línea/origen; sin valores de producción inventados. |

`conversations.bot_cycle_id` y `messages.bot_cycle_id` vinculan el historial. Un ciclo puede comprender varias conversaciones/oportunidades; el índice único `(bot_cycle_id,bot_slot)` y el conteo bajo bloqueo comparten el máximo de tres reservas. La unicidad anterior por conversación se conserva. Una nueva oportunidad durante un ciclo nunca otorga otros tres cupos.

Orden de bloqueo: configuración de límite (sólo toma), contacto, recibo, cliente y oportunidad/conversación según operación. La resolución toma el cliente antes de buscar/crear oportunidad; dos líneas simultáneas no duplican la primera búsqueda abierta. La persistencia comercial toma contacto/cliente antes de entrar en la implementación existente. No se mantiene una transacción SQL abierta mientras trabaja IA o WhatsApp.

La toma durable permite **un solo turno sin terminar por contacto**. Dos workers del mismo recibo no obtienen dos autorizaciones. La clasificación no es una función SQL: el workflow debe aportar una decisión explícita validada, sin hacer clasificación por IA antes de obtener la toma. Ambigüedad entre oportunidades abiertas exige `p_lead_id`; no se escoge arbitrariamente la más reciente.

Si un worker cae después de obtener la toma, el recibo sigue `processing` o `resolved`. Un duplicado no vuelve a autorizar IA. Conciliar usando el resultado ya guardado de la ejecución; no hay vencimiento de lease ni reintento costoso automático. Esto es un estado operativo de integración, no un control manual de reactivación comercial.

## RPC y resultados

POST `/rest/v1/rpc/<nombre>`, JSON con estos nombres exactos, credencial técnica `service_role` sólo en servidor/n8n. Resultados tabulares son listas. Ninguna RPC admite reloj, fecha de cierre o duración aportados por el caller.

| RPC | Parámetros | Resultado / regla |
| --- | --- | --- |
| `receive_bot_contact_message` | `p_source`, `p_phone_e164`, `p_provider`, `p_business_phone_id`, `p_provider_message_id`, `p_body` | `receipt_id, created, disposition, pause_until`. Guarda antes de procesar; no crea cliente ni oportunidad. |
| `claim_bot_contact_message` | `p_receipt_id` | `claimed, reason, receipt_id, body, pause_until`. **Sólo `claimed=true` autoriza el trabajo costoso de ese turno.** |
| `resolve_bot_contact_message` | `p_receipt_id`, `p_decision`, `p_lead_id` opcional | `outcome, lead_id, conversation_id, message_id, cycle_id`. Resuelve/crea oportunidad, ciclo y mensaje atómicamente. Repetición idéntica conserva todo; otra decisión devuelve `PT409`. |
| `get_bot_contact_turn` | `p_receipt_id` | Estado, IDs, `reserved_slots`, `sent_count`, cierre y pausa. Contadores del ciclo del recibo, incluso si éste ya es histórico. |
| `complete_bot_contact_turn` | `p_receipt_id` | Libera el turno ya resuelto cuando termina **sin respuesta**. No reabre ciclos ni borra cupos. |
| `list_bot_contact_queue` | `p_receipt_id`, `p_limit` opcional (20, máximo 100) | IDs/posiciones pendientes de ese contacto, antiguos primero. No devuelve silenciados. |
| `bot_opportunity_history` | `p_conversation_id`, `p_before`, `p_after` opcional (0), `p_limit` opcional (100, máximo 500) | Contexto de la misma oportunidad/línea/proveedor, entre ciclos, posiciones exclusivas y orden ascendente. |

`disposition`: `pending`, `processing`, `resolved`, `paused`, `review`, `noncommercial`. Un ID del proveedor anterior a la migración devuelve `historical, created=false` y no habilita procesamiento. Cambiar texto/contacto bajo la misma clave externa es `22023`; se revierte todo el ingreso conflictivo.

`claim.reason`: `claimed`; estado ya alcanzado; `busy`; `earlier_pending`; `limits_not_configured`; `processing_limit`. En todos salvo `claimed`, no invocar IA, extractor, score ni reserva. La falta de límites no equivale a permiso ilimitado.

Decisiones de resolución:

| `p_decision` | Semántica |
| --- | --- |
| `same_search` | Oportunidad abierta explícita o única; error si no existe o está cerrada. |
| `new_search` | Continuar búsqueda abierta única/indicada; crear primera oportunidad si no hay abierta, o nueva si la indicada está cerrada. |
| `additional_purchase` | Otra compra independiente; nueva oportunidad, mismo ciclo/cupos si todavía está abierto. |
| `noncommercial` | No crear cliente/oportunidad/ciclo ni responder; guardar en contexto existente si lo hay. |
| `uncertain` | Conservar para revisión, sin alta ni respuesta; no adivinar una compra nueva. |

La decisión aporta la intención, no atributos comerciales inventados. `p_lead_id` debe pertenecer al mismo teléfono/origen. No derivar campos del resumen en el panel.

## Contratos existentes y contexto

Después de resolver, guardar datos comerciales y score con las RPC existentes. Las implementaciones originales quedan privadas; los wrappers bloquean nuevas escrituras de un turno silenciado, terminado o de otro ciclo. Repeticiones de peticiones ya persistidas conservan el contrato `unchanged`/conflicto, sin requerir IA nuevamente. Las ediciones independientes y cortes antiguos siguen protegidos.

La reserva mantiene su firma y toma el contador de **`get_bot_contact_turn`**, no el total parcial de una conversación. El tercer cupo sólo acepta cierre. Reservar respuesta termina la toma de procesamiento; reservar cierre además silencia los pendientes. `claim_bot_reply` sigue siendo la única autorización de envío; un cierre pendiente de un ciclo anterior no se toma después de iniciar otro. Un envío ya tomado puede terminar su conciliación mediante `record_bot_reply_result`.

`get_bot_conversation` conserva su contrato histórico por conversación y sirve para inspección; no usarlo como presupuesto D07. El ingreso antiguo `receive_bot_message` rechaza contactos D07 y recepción real; sólo conserva compatibilidad para demos explícitas todavía no gestionadas. Se revocan las escrituras directas de conversaciones/mensajes para el servicio: usar RPC. No introducir un fallback al flujo viejo.

Los silenciados conservan ID, cuerpo, fecha y posición de ingreso. Cuando existe contexto se incorporan a `messages`, visibles en la ficha con sus permisos actuales. Entradas no comerciales de un contacto sin oportunidad permanecen en el buzón privado; no crean fichas ni bandejas nuevas.

Para el nuevo turno, obtener su `history_position` desde `messages` y paginar `bot_opportunity_history` con ese `p_before` fijo. Agregar el mensaje actual una sola vez. No mover, copiar ni renumerar los anteriores. Las citas del score pueden referirse al contexto literal anterior de esa misma oportunidad/línea/proveedor; la validación conserva unicidad, corte y reglas/puntos/versiones sin cambios. Otra compra no entra en el contexto. Una cita repetida/ambigua se rechaza.

## Límites técnicos y habilitación

No se insertan filas en `bot_processing_limits`. Antes de activar, acordar y configurar explícitamente `window_seconds`, `max_contact_claims` y `max_line_claims` por origen/línea. La toma consume capacidad aunque después haya fallo o decisión no comercial. Deduplicados/silenciados no consumen capacidad. La ventana usa tiempo de base; las tomas de una línea se serializan para que el límite global no tenga carreras.

Esto limita cantidad de pipelines admitidos, **no mide pesos/dólares ni garantiza el costo de eventos n8n**. El handoff exige además límites de tokens/salida, reintentos y presupuesto del proveedor/n8n antes de habilitar recepción general. No se consideran aprobados umbrales de prueba. No programar un poll para reintentar IA al vencer una ventana: drenar pendientes sólo por un evento nuevo o terminación de turno.

## Aplicación y transición revisables

1. Mantener el workflow sin procesar/publicar. Revisar esta migración y el handoff antes de aplicar; este PR no hace aplicación remota.
2. Verificar histórico: conversaciones detenidas sin reserva `closing`, múltiples conversaciones sin cierre para el mismo contacto/línea, y workers/envíos aún en tránsito. La migración conserva el histórico, crea un ciclo por conversación previa y deriva cierre sólo del `created_at` de la reserva. Nunca de `sent_at`, fecha actual o un cero inventado.
3. Casos sin evidencia de cierre o con múltiples ciclos sin cerrar quedan `needs_review`; no autorizar IA por inferencia. Conciliar el histórico en una operación separada revisada. No es necesario completarlo para crear este PR.
4. Migración transaccional: cualquier fallo revierte el cambio de esquema. Una reversión tras recibir datos D07 requiere plan específico; no borrar recibos/ciclos ni reactivar el viejo flujo como rollback.
5. Preparar cambio de workflow y límites revisados; validar HTTP en desarrollo después de autorización de aplicación. Conservar modo deshabilitado hasta aprobar un ensayo nuevo coordinado.

## Validación local

`npm run test:bot-pause` en `frontend`: PostgreSQL WASM aislado, sin red. El reloj se reemplaza únicamente dentro de la base efímera de prueba. Cubre límites antes/exacto/después de 72h, primer ingreso, continuidad y preferencias, otra compra sin reset, silencio y cola, fallos de envío, reintentos, contexto/evidencias, permisos, límites y transición histórica.

`python supabase/tests/bot-local.py --d07-only`: PostgreSQL nativo temporal con contraseña aleatoria y loopback; no recibe URL de conexión. El runner comprueba la ruta del clúster y lo detiene/elimina. Prueba conexiones realmente concurrentes, observa espera `Lock` en `pg_stat_activity`, y comprueba ingreso/toma/resolución duplicados, rollback, cierre contra entrante, reactivación exacta y primera búsqueda entre líneas.

Regresiones pertinentes: persistencia comercial/score, mensajes/cursores, esquema y SQL CRM/Reportes; y runner nativo de conversaciones. No hay cambios de interfaz que justifiquen repetir capturas o build. QA 3114 sigue con los datos reales previamente validados en main; estas muestras se crean sólo dentro de bases efímeras.

Pendiente de integración: aplicar sólo con autorización, configurar límites, adaptar n8n al contrato y hacer ensayo HTTP/WhatsApp coordinado. Las pruebas SQL locales no acreditan ese recorrido remoto.

Resultado efectivo del 27/11: **12 pruebas Node/PostgreSQL WASM aprobadas** (4 D07 y 8 regresiones de persistencia, lectura/paginación y SQL existente). **PostgreSQL nativo 17.12 aprobado**: suite D07 concurrente, incluida competencia por el límite global de procesamiento; y runner existente de identidad/CRM/recurrencia, ingreso, cupos/cierre, historial, resumen y RLS. Clústeres temporales detenidos al terminar. Se corrigieron en el runner las opciones de socket y comparación de rutas para Windows; no se reemplazaron servicios del usuario. Docker no estaba disponible y se usó un binario PostgreSQL local aislado. No se repitió build/QA visual al no cambiar la interfaz.
