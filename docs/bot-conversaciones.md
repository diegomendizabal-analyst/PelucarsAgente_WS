# Persistencia de la recepción del bot

Incremento D07 después de integrar #13/#14/#15: [contrato de ciclos y pausa](bot-d07.md) y [handoff n8n](handoff-d07-n8n.md). Migración aplicada por el operador en desarrollo y ensayo remoto contrastado en [QA D07](qa-d07.md); #17/#19 pendientes de integrar. Para contactos gestionados por D07 se sustituye el ingreso explícito por admisión/toma/resolución y el presupuesto se consulta por ciclo, no por conversación. El resto de este documento describe el contrato previo y sus pruebas históricas; no interpretar sus menciones de “D07 pendiente” como una decisión funcional sin aprobar.

Actualización local 27/11: para nuevas extracciones completas, usar save_bot_lead_details según [contrato de oportunidades](oportunidades-integracion.md); llama internamente a save_bot_lead_summary y agrega datos comerciales/interés atómicamente. La RPC anterior sigue disponible. El panel obtiene mensajes con estado de envío desde lead_messages con RLS y paginación de 20. Ambas migraciones nuevas están **pendientes de aplicar**; no se modificó el workflow remoto.

La migración `20261125132536_bot_conversations_messages.sql` agrega conversaciones por oportunidad y mensajes de texto por conversación. El primer ingreso crea la conversación y el mensaje en una transacción. El workflow debe aportar un UUID de conversación estable y una oportunidad existente elegida explícitamente. El teléfono en formato E.164 y el origen deben coincidir con el cliente y la oportunidad. D07 sigue pendiente para el enrutamiento de conversaciones reales. En la demo se usa un UUID fijo, un lead de origen `demo` y un espacio de identificadores de proveedor de prueba.

## Contrato para n8n

Cada operación corresponde a un POST a `/rest/v1/rpc/<nombre>`, con un objeto JSON cuyas claves son los nombres exactos de los parámetros. Usar la credencial técnica de Supabase configurada en n8n. Las operaciones de escritura requieren `service_role`. El contenido del mensaje se conserva tal como se recibe.

| Operación | Parámetros | Resultado |
|---|---|---|
| `receive_bot_message` | `p_conversation_id`, `p_lead_id` (UUID), `p_source` (`demo` o `whatsapp_bot`), `p_phone_e164`, `p_provider`, `p_business_phone_id`, `p_provider_message_id`, `p_body` (texto) | Una fila con `conversation_id`, `message_id`, `history_position` y `created`. Un reintento idéntico devuelve los mismos identificadores con `created=false`. |
| `bot_message_history` | `p_conversation_id`, opcionales `p_before` (bigint), `p_after` (bigint, inicial 0), `p_limit` (entero, predeterminado 100, entre 1 y 500) | Filas en orden ascendente con `message_id`, `history_position`, `sender_kind` (`customer` o `bot`), `body` y `occurred_at`. Los dos límites son exclusivos. |
| `get_bot_conversation` | `p_conversation_id` | Una fila con `conversation_id`, `lead_id`, `bot_state`, `reserved_slots` (0–3) y `sent_count` (confirmados). Ambas lecturas devuelven una lista vacía si el registro carece de visibilidad. |
| `save_bot_lead_summary` | `p_conversation_id`, `p_message_id` (UUID del entrante), `p_summary` (texto de `output.resumen_consulta`, 1–6000 caracteres) | Una fila con `lead_id`, `source_message_id` y `outcome` (`applied`, `unchanged` o `stale`). Sólo `service_role`. |
| `reserve_bot_reply` | `p_conversation_id`, `p_reply_to` (UUID del entrante), `p_body` (texto), `p_reply_kind` (`question` o `closing`), `p_expected_reserved_slots` (entero 0–3) | Registro saliente con `id`, `bot_slot`, `reply_kind` y `send_state`. Una reserva nueva nace en `pending`. Un reintento con el mismo entrante, tipo y texto devuelve el mismo registro en su estado actual. |
| `claim_bot_reply` | `p_conversation_id`, `p_message_id` (UUID del saliente) | Una fila con `message_id`, `send_state` y `claimed`. Sólo `claimed=true` autoriza comenzar un intento de envío. Cambia `pending` a `sending` bajo bloqueo. |
| `record_bot_reply_result` | `p_conversation_id`, `p_message_id`, `p_state`, opcional `p_provider_message_id` | Registro saliente actualizado. Para `sent`, indicar el ID confirmado por el proveedor. Para `failed` o `unknown`, omitirlo. Repetir el mismo resultado devuelve el registro existente. |
| `set_bot_conversation_state` | `p_conversation_id`, `p_expected`, `p_state` | Texto con el estado confirmado. Si ya está en el destino, el reintento devuelve ese estado. |

Los resultados tabulares se consumen como listas. Las operaciones que devuelven el registro saliente exponen las columnas de `messages`: `id`, `conversation_id`, `provider`, `business_phone_id`, `provider_message_id`, `sender_kind`, `body`, `created_at`, `sent_at`, `history_position`, `send_state`, `bot_slot`, `reply_kind` y `reply_to`. Para leer un único registro compuesto por HTTP se puede solicitar la representación singular de PostgREST con `Accept: application/vnd.pgrst.object+json`. Las pruebas locales cubren las funciones SQL. Las pruebas manuales de desarrollo comprobaron el contrato HTTP desde n8n.

### Entrada y lectura del contexto

Ejemplo de cuerpo para `receive_bot_message`, usando las identidades de la prueba local:

```json
{
  "p_conversation_id": "00000000-0000-4000-8000-000000000006",
  "p_lead_id": "00000000-0000-4000-8000-000000000005",
  "p_source": "demo",
  "p_phone_e164": "+12025550123",
  "p_provider": "demo",
  "p_business_phone_id": "demo-line",
  "p_provider_message_id": "ext-1",
  "p_body": "Hola"
}
```

1. Conservar la clave externa (proveedor, número comercial e ID del mensaje) a través de las reentregas. Un cambio de texto o de conversación bajo la misma clave es un conflicto. Se revierte toda la operación, incluida una conversación que se hubiera intentado crear. Un mismo ID de otro proveedor o número comercial puede identificar otro mensaje.
2. Usar la `history_position` devuelta como `p_before` y paginar con la última posición como `p_after`. Conservar ese corte en todas las páginas y anexar el entrante actual una sola vez. La posición expresa el orden durable en la base y puede tener saltos. Un saliente entra en el historial en la posición de su confirmación. Los mensajes pendientes, fallidos o inciertos siguen visibles como registros operativos.
3. Un `created=false` permite retomar una operación interrumpida después de la escritura. Recuperar la decisión/reserva existente por `reply_to` antes de iniciar efectos externos. Frente a dos ejecuciones, la primera reserva fija el texto y el tipo de respuesta. Si difieren en una llamada posterior, recuperar el registro original.
4. Recibir un texto tras detener el bot conserva el historial. El estado impide nuevas reservas. La integración futura deberá tratar por separado los eventos sin texto, los acuses de entrega y los mensajes sin identidad externa estable.

### Resumen de la oportunidad

Después de extraer los datos, enviar el resumen literal junto con los UUID devueltos por `receive_bot_message`. La RPC deriva la oportunidad de la conversación y comprueba que el mensaje pertenece al cliente y a esa conversación. La respuesta identifica la oportunidad y el mensaje del resumen vigente.

- `applied` guarda el texto en `leads.summary` y su procedencia en la misma transacción. La posición global de historial del entrante ordena los resúmenes incluso entre conversaciones de la misma oportunidad.
- `unchanged` confirma un reintento idéntico. Conserva la procedencia y `leads.updated_at`. Si se pierde la respuesta HTTP, repetir sólo esta RPC con el mismo texto y los mismos UUID.
- `stale` indica que ya se aplicó un mensaje posterior. El workflow pasa al siguiente entrante sin reservar ni enviar para el turno antiguo.
- `PT409` exige revisar un texto diferente para el mismo mensaje o un resumen preexistente/editado fuera del bot. La transacción conserva la información guardada. `22023` identifica texto inválido, un saliente o un mensaje ajeno a la conversación.

La tabla privada conserva el texto aplicado para detectar ediciones independientes. Las lecturas de la ficha mantienen las políticas de `leads` y la bandeja de pendientes conserva su proyección. No hay backfill al aplicar la migración.

Para recuperar una extracción ya hecha, usar exclusivamente `POST /rest/v1/rpc/save_bot_lead_summary`. Tomar ambos UUID de «Mensaje registrado» y el texto de «Extraer datos de la consulta» en la misma ejecución. En #46 se comprobó que «Preparar contexto» contenía los dos turnos previos y el entrante actual. El cierre saliente se produjo después. La prueba local reproduce los tres turnos con identidades de demo y el resumen exacto de esa extracción. Para verificar en el entorno compartido, aplicar primero la migración revisada y leer la ficha antes y después de la llamada.

### Cupos y resultados

1. Leer `get_bot_conversation`. Si está en `collecting`, usar su `reserved_slots` para decidir y pasar **ese mismo valor** en `p_expected_reserved_slots`. Con 0 o 1 cupos se admite una pregunta o un cierre temprano. Con 2 sólo se admite un cierre. `sent_count` sirve para conocer los envíos confirmados.
2. Llamar a `reserve_bot_reply` con el UUID del entrante, el texto y el tipo decidido. La RPC bloquea la conversación. Si ya hay una reserva para ese entrante con el mismo tipo y texto, devuelve su ID y estado actuales aunque el contador haya avanzado o el bot haya cerrado. Si difieren el tipo o el texto, devuelve `22023`.
3. Para una reserva nueva, la RPC comprueba bajo el mismo bloqueo el contador esperado y el estado `collecting`. Si cambió cualquiera, devuelve el código **`PT409`** sin insertar un mensaje ni ocupar un cupo. Volver a leer la conversación. Si sigue en `collecting`, recalcular la decisión y el texto antes de reintentar. Si pasó a otro estado, terminar la decisión para ese entrante. Una pregunta basada en un contador vigente de 2 devuelve `22023`.
4. Reservar `closing` persiste el tipo de mensaje y pasa la conversación a `waiting_assignment` en la **misma transacción**, incluso en el primer cupo. El llamador omite una segunda llamada a `set_bot_conversation_state` para cerrar la recepción. Un rollback revierte ambos cambios. Reservar el cierre deja `sent_count` intacto.

Por ejemplo, si dos preguntas parten de `reserved_slots=1`, una obtiene el cupo 2 y la otra recibe `PT409`. Al releer 2, la segunda ejecución puede reservar el cierre en el cupo 3. Si se perdió la respuesta HTTP de una reserva, repetir primero **los parámetros originales** permite recuperar el registro ya creado.

Desde `waiting_assignment` se puede tomar el cierre para enviarlo. Una pregunta anterior que quedó pendiente conserva su cupo, pero `claim_bot_reply` devuelve `claimed=false`. Un envío tomado antes del cierre puede estar en tránsito y todavía admite el registro de su resultado. Cada cupo sigue ocupado aunque el envío falle. Desde `collecting` también se puede detener o derivar la conversación. Desde `waiting_assignment` se puede pasar a `stopped` o `handed_off`. Ambos estados bloquean nuevas tomas.

Un intento confirmado por el proveedor pasa de `sending` a `sent`. Un rechazo definitivo pasa a `failed`. Ante un timeout de resultado incierto usar `unknown` y conciliar con el proveedor antes de marcar `sent` o `failed`. Si el proceso cae después de tomar el envío, queda en `sending` hasta conciliar. Repetir una toma devuelve `claimed=false`. Esta etapa no reenvía automáticamente intentos fallidos ni promete entrega exactamente una vez.

Una cancelación de transacción o un fallo transitorio de conexión admite reintento con las mismas claves. Además del conflicto de decisión `PT409` descrito arriba, los parámetros inválidos, cambios de identidad o contenido y transiciones inválidas devuelven SQLSTATE `22023`. En ese caso, se revisa la entrada o se recupera el estado actual. Un identificador requerido inexistente en las operaciones de salida/estado puede devolver `P0002`. Un ID de proveedor ya utilizado por otra salida produce `23505`. Un rol sin privilegios de ejecución recibe `42501`.

## Acceso y asignación

La lectura del panel usa RLS a través de la oportunidad. Un administrador habilitado ve las conversaciones y un vendedor habilitado ve las de sus oportunidades actuales. La reasignación cambia el acceso al historial existente. Los usuarios del panel sólo tienen lectura. La bandeja de espera conserva su proyección operativa.

La [migración de recurrencia](../supabase/migrations/20261120153034_crm_recurrence_and_notifications.sql) sólo conserva al responsable habilitado de la última oportunidad del cliente, incluso si está ocupado. Para un cliente nuevo, con vendedores disponibles, la oportunidad queda en espera. La toma voluntaria y la asignación administrativa siguen en las RPC del CRM. Abrir una conversación no crea oportunidades, asignaciones ni avisos. Las decisiones sobre repartir clientes nuevos y sobre la ventana D07 siguen pendientes.

## Verificación local

Requiere Python 3, Psycopg 3 (`psycopg[binary]==3.2.13` en el entorno de prueba), y PostgreSQL con `initdb` y `pg_ctl` en PATH. Desde la raíz, como usuario sin privilegios de sistema:

```sh
python supabase/tests/bot-local.py
```

El programa crea un clúster temporal con contraseña aleatoria, escucha sólo en loopback, comprueba el directorio de datos y lo elimina al terminar. Aplica las migraciones en orden, reproduce las regresiones de identidad/CRM/recurrencia y prueba el contrato con una conversación demo explícita. Simula los roles y las identidades del panel dentro del clúster. La prueba de concurrencia verifica que la segunda conexión espere el bloqueo de la primera, tanto en el ingreso duplicado como en la toma de un envío y en las disputas por cupos y cierres. Se verifican dos preguntas con un solo cupo usado, el recálculo del tercer cupo como cierre, la competencia entre un cierre temprano y una pregunta, el rollback del cierre y los reintentos idempotentes con contador vencido.

Validado en PostgreSQL 17.12. También pasó la suite existente `frontend/scripts/database-local.test.mjs` sobre PostgreSQL WASM. La migración revisada se aplicó en la base de desarrollo y quedó registrada en el historial de Supabase. Continúan pendientes el enrutamiento real (D07), la persistencia del resumen, score y evidencias y la confirmación del envío de WhatsApp integrado.
