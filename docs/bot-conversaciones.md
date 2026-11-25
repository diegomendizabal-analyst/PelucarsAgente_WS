# Persistencia de la recepción del bot

La migración `20261125132536_bot_conversations_messages.sql` agrega conversaciones por oportunidad y mensajes de texto por conversación. El primer ingreso crea la conversación y el mensaje en una transacción. El workflow debe aportar un UUID de conversación estable y una oportunidad existente elegida explícitamente. El teléfono en formato E.164 y el origen deben coincidir con el cliente y la oportunidad. D07 sigue pendiente para el enrutamiento de conversaciones reales. En la demo se usa un UUID fijo, un lead de origen `demo` y un espacio de identificadores de proveedor de prueba.

## Contrato para n8n

Cada operación corresponde a un POST a `/rest/v1/rpc/<nombre>`, con un objeto JSON cuyas claves son los nombres exactos de los parámetros. Usar la credencial técnica de Supabase configurada en n8n. Las operaciones de escritura requieren `service_role`. El contenido del mensaje se conserva tal como se recibe.

| Operación | Parámetros | Resultado |
|---|---|---|
| `receive_bot_message` | `p_conversation_id`, `p_lead_id` (UUID), `p_source` (`demo` o `whatsapp_bot`), `p_phone_e164`, `p_provider`, `p_business_phone_id`, `p_provider_message_id`, `p_body` (texto) | Una fila con `conversation_id`, `message_id`, `history_position` y `created`. Un reintento idéntico devuelve los mismos identificadores con `created=false`. |
| `bot_message_history` | `p_conversation_id`, opcionales `p_before` (bigint), `p_after` (bigint, inicial 0), `p_limit` (entero, predeterminado 100, entre 1 y 500) | Filas en orden ascendente con `message_id`, `history_position`, `sender_kind` (`customer` o `bot`), `body` y `occurred_at`. Los dos límites son exclusivos. |
| `get_bot_conversation` | `p_conversation_id` | Una fila con `conversation_id`, `lead_id`, `bot_state`, `reserved_slots` (0–3) y `sent_count` (confirmados). Ambas lecturas devuelven una lista vacía si el registro carece de visibilidad. |
| `reserve_bot_reply` | `p_conversation_id`, `p_reply_to` (UUID del entrante), `p_body` | Registro saliente con su `id`, `bot_slot` y `send_state`. Una respuesta lógica por entrante. Repetir con el mismo texto devuelve la reserva original, incluso tras cerrar la conversación. |
| `claim_bot_reply` | `p_conversation_id`, `p_message_id` (UUID del saliente) | Una fila con `message_id`, `send_state` y `claimed`. Sólo `claimed=true` autoriza comenzar un intento de envío. Cambia `pending` a `sending` bajo bloqueo. |
| `record_bot_reply_result` | `p_conversation_id`, `p_message_id`, `p_state`, opcional `p_provider_message_id` | Registro saliente actualizado. Para `sent`, indicar el ID confirmado por el proveedor. Para `failed` o `unknown`, omitirlo. Repetir el mismo resultado devuelve el registro existente. |
| `set_bot_conversation_state` | `p_conversation_id`, `p_expected`, `p_state` | Texto con el estado confirmado. Si ya está en el destino, el reintento devuelve ese estado. |

Los resultados tabulares se consumen como listas. Las operaciones que devuelven el registro saliente exponen las columnas de `messages`: `id`, `conversation_id`, `provider`, `business_phone_id`, `provider_message_id`, `sender_kind`, `body`, `created_at`, `sent_at`, `history_position`, `send_state`, `bot_slot` y `reply_to`. Para leer un único registro compuesto por HTTP se puede solicitar la representación singular de PostgREST con `Accept: application/vnd.pgrst.object+json`. La prueba cubre las funciones SQL, no una llamada HTTP al proyecto.

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
3. Un `created=false` permite retomar una operación interrumpida después de la escritura. Recuperar la decisión/reserva existente por `reply_to` antes de iniciar efectos externos. Frente a dos ejecuciones, la primera reserva fija el texto de respuesta. Un segundo texto distinto requiere consultar el registro original.
4. Recibir un texto tras detener el bot conserva el historial. El estado impide nuevas reservas. La integración futura deberá tratar por separado los eventos sin texto, los acuses de entrega y los mensajes sin identidad externa estable.

### Cupos y resultados

El control del límite usa `reserved_slots`. Cada reserva ocupa un cupo, incluido el cierre. `sent_count` cuenta exclusivamente salientes con resultado confirmado. Una falla, un reintento o un mensaje entrante adicional conservan el cupo original. La reserva y la confirmación se serializan por conversación. Las llamadas al proveedor quedan fuera de la transacción.

El estado inicial es `collecting`. Puede pasar a `waiting_assignment`, `handed_off` o `stopped`. Desde `waiting_assignment` puede pasar a `handed_off` o `stopped`. Sólo `collecting` admite nuevas reservas. Un cierre ya reservado puede tomarse en `waiting_assignment`. Después de detener o derivar, se bloquean nuevas tomas y todavía se pueden registrar resultados de intentos iniciados.

Un intento confirmado por el proveedor pasa de `sending` a `sent`. Un rechazo definitivo pasa a `failed`. Ante un timeout de resultado incierto usar `unknown` y conciliar con el proveedor antes de marcar `sent` o `failed`. Si el proceso cae después de tomar el envío, queda en `sending` hasta conciliar. Repetir una toma devuelve `claimed=false`. Esta etapa no reenvía automáticamente intentos fallidos ni promete entrega exactamente una vez.

Una cancelación de transacción o un fallo transitorio de conexión admite reintento con las mismas claves. Los conflictos de identidad, contenido, estado o límite devuelven SQLSTATE `22023`. En ese caso, se revisa la entrada o se recupera el estado actual. Un identificador requerido inexistente en las operaciones de salida/estado puede devolver `P0002`. Un ID de proveedor ya utilizado por otra salida produce `23505`. Un rol sin privilegios de ejecución recibe `42501`.

## Acceso y asignación

La lectura del panel usa RLS a través de la oportunidad. Un administrador habilitado ve las conversaciones y un vendedor habilitado ve las de sus oportunidades actuales. La reasignación cambia el acceso al historial existente. Los usuarios del panel sólo tienen lectura. La bandeja de espera conserva su proyección operativa.

La [migración de recurrencia](../supabase/migrations/20261120153034_crm_recurrence_and_notifications.sql) sólo conserva al responsable habilitado de la última oportunidad del cliente, incluso si está ocupado. Para un cliente nuevo, con vendedores disponibles, la oportunidad queda en espera. La toma voluntaria y la asignación administrativa siguen en las RPC del CRM. Abrir una conversación no crea oportunidades, asignaciones ni avisos. Las decisiones sobre repartir clientes nuevos y sobre la ventana D07 siguen pendientes.

## Verificación local

Requiere Python 3, Psycopg 3 (`psycopg[binary]==3.2.13` en el entorno de prueba), y PostgreSQL con `initdb` y `pg_ctl` en PATH. Desde la raíz, como usuario sin privilegios de sistema:

```sh
python supabase/tests/bot-local.py
```

El programa crea un clúster temporal con contraseña aleatoria, escucha sólo en loopback, comprueba el directorio de datos y lo elimina al terminar. Aplica las migraciones en orden, reproduce las regresiones de identidad/CRM/recurrencia y prueba el contrato con una conversación demo explícita. Simula los roles y las identidades del panel dentro del clúster. La prueba de concurrencia verifica que la segunda conexión espere el bloqueo de la primera, tanto en el ingreso duplicado como en la toma de un envío y en la disputa del último cupo.

Validado en PostgreSQL 17.12. También pasó la suite existente `frontend/scripts/database-local.test.mjs` sobre PostgreSQL WASM. Quedan pendientes el enrutamiento real (D07), score y evidencias, integración de n8n y transporte de WhatsApp. La migración se entrega sin aplicar a Supabase remoto.
