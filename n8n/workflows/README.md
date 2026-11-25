# Pruebas del bot de Pelucars

Los flujos se mantienen en n8n. En este informe anotamos qué se probó y qué resultado se obtuvo.

## 25 de noviembre de 2026

1. **Recepción del bot.** Se preparó el flujo de prueba que lee el historial, analiza la consulta y decide si corresponde reservar una respuesta. Las etapas se probaron por separado con datos demo.
2. **Persistencia (#19).** Se registró dos veces el mismo mensaje de OP-000030. El primer ingreso lo creó y el segundo recuperó el mismo registro. Quedó un solo mensaje en el historial, con cero reservas y cero envíos.
3. **Contexto comercial (#20).** Después de dos mensajes, el bot conservó el Corolla automático y el presupuesto total de USD 20.000. Incorporó el plazo de 15 días, que el cliente no entrega usado y que no necesita financiación.
4. **Reserva de cierre (#21).** Se pidió dos veces la misma reserva. Ambas llamadas devolvieron el mismo cierre pendiente en el cupo 1. La conversación quedó esperando asignación, con una reserva y cero envíos. El historial siguió mostrando solo los dos mensajes del cliente.
5. **Envío por WhatsApp (#22 y #23).** Meta rechazó el primer intento por destinatario no autorizado. Con el número corregido, Meta aceptó el texto y Augusto confirmó que llegó a su celular.
6. **Recepción por WhatsApp (#24).** El evento simulado llegó al trigger con el Phone Number ID de ejemplo `123456123`. El flujo filtra por el número de prueba `1526007707255136`. Augusto confirmó que el campo `messages` figura suscrito y que su mensaje real no llegó durante una nueva escucha.
7. **Suscripción de WhatsApp (#25).** Meta confirmó que la cuenta `1171044792167045` contiene el número de prueba `1526007707255136` y que la app **Pelucars - Desarrollo** tiene el ID `1135214522724943`. La consulta de aplicaciones suscritas devolvió únicamente **WA DevX Webhook Events 1P App** (`2202427980234937`). Pelucars - Desarrollo no figuraba. Las tres consultas devolvieron HTTP 200 y fueron de solo lectura.
8. **Suscripción de Pelucars (#26).** Meta identificó el token con la app **Pelucars - Desarrollo** (`1135214522724943`). Un único POST suscribió la app a la cuenta `1171044792167045`. El GET posterior mostró tanto **Pelucars - Desarrollo** como **WA DevX Webhook Events 1P App** (`2202427980234937`). El callback se conservó.
9. **Recepción real confirmada (#27).** En una escucha manual, el WhatsApp Trigger recibió un mensaje de texto enviado desde un celular al número de prueba. La causa de la falla anterior era que faltaba suscribir **Pelucars - Desarrollo** a la cuenta de WhatsApp Business. El campo `messages` ya estaba suscrito y el evento simulado llegaba. Tras agregar la suscripción de la app, llegó el mensaje real. La ejecución #27 solo ejecutó el trigger.
10. **Preparación de la integración.** La consulta de solo lectura #30 no encontró cliente ni oportunidades para ninguna de las dos representaciones del remitente autorizado. Los tres identificadores propuestos estaban libres. Para esta prueba se propone crear un cliente y una oportunidad demo en espera, sin responsable. El primer texto autorizado crearía la conversación y su mensaje en una transacción. La oportunidad genera su historial inicial. Con el resultado observado no corresponde una asignación ni un aviso. Antes del alta se debe volver a comprobar el teléfono y los antecedentes del cliente para detectar cambios.
11. **Recorrido preparado, pendiente de aprobación.** El único WhatsApp Trigger filtra el número comercial y el remitente autorizados. Los estados de entrega y lectura terminan en una rama separada. Para un texto, el flujo guarda el ingreso por ID de Meta, recupera la reserva original si existe y, cuando corresponde decidir, lee el historial anterior por páginas y anexa el texto actual una vez. Usa el extractor probado y los cupos reservados. El tercer cupo exige cierre. Ante `PT409` relee la reserva y el estado antes de recalcular. Solo una toma confirmada permite enviar el texto reservado. La aceptación de Meta con ID queda como enviada, el rechazo definitivo como fallido y el resultado incierto queda para conciliación. El procesamiento está deshabilitado y el workflow sigue sin publicar. No se ejecutó esta integración. Queda pendiente persistir resumen, score y evidencias.

<details>
<summary>Copias iniciales e instrucciones de importación</summary>

Copias importables de los seis workflows de prueba. La exportación de recepción WhatsApp incluye el borrador de integración. La instancia de n8n guarda el trabajo en curso. Corresponden a la versión guardada en esa fecha.

| Archivo | Uso |
| --- | --- |
| [recepcion-bot.json](recepcion-bot.json) | Prueba manual del bot sobre una consulta demo |
| [persistencia.json](persistencia.json) | Verificación de ingreso idempotente, historial y contadores |
| [contexto-comercial.json](contexto-comercial.json) | Extracción sobre dos turnos comerciales |
| [reserva-cierre.json](reserva-cierre.json) | Reserva idempotente de un cierre demo |
| [conexion-whatsapp.json](conexion-whatsapp.json) | Envío manual de un texto al destinatario autorizado que se configure |
| [recepcion-whatsapp.json](recepcion-whatsapp.json) | Recepción e integración demo con persistencia y envío, deshabilitada hasta aprobación |

## Importación en n8n

Importá el JSON como workflow nuevo. Las copias están inactivas y omiten vínculos de credenciales, identificadores de webhook, datos fijados e historial de ejecuciones. El destino del envío de prueba está vacío. Al importar, revisá las credenciales seleccionadas y completá el destinatario autorizado si vas a probar el envío.

Las pruebas de persistencia, contexto, reserva y recepción del bot conservan la URL del proyecto Supabase y sus referencias demo. Verificá el entorno y los registros antes de ejecutar. Según el flujo, necesitan credenciales Supabase API y del modelo del extractor.

Para recibir WhatsApp, vinculá en el trigger la credencial WhatsApp OAuth de la app de Meta. Comprobá primero en la app si el objeto WhatsApp Business Account ya tiene una URL de callback y si está suscrito a `messages`. La escucha de prueba también usa el webhook de la app. El flujo filtra por Phone Number ID `1526007707255136`. La rama de mensajes muestra ID, remitente, Phone Number ID y texto. La rama de estados muestra el ID del mensaje, el Phone Number ID y el estado informado por Meta.

La exportación de recepción usa `DEMO_REMITENTE_META`, `DEMO_DESTINATARIO_META`, `DEMO_OPORTUNIDAD_UUID` y `DEMO_CONVERSACION_UUID` como marcadores. Al importar, configurá los valores de la prueba autorizada y vinculá las credenciales en n8n. El borrador en el editor ya tiene los valores propuestos. La habilitación de la demo se controla en el nodo «Habilitar integración demo».

</details>
