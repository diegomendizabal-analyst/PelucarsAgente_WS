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
8. **Suscripción de Pelucars (#26).** Meta identificó el token con la app **Pelucars - Desarrollo** (`1135214522724943`). Un único POST suscribió la app a la cuenta `1171044792167045`. El GET posterior mostró tanto **Pelucars - Desarrollo** como **WA DevX Webhook Events 1P App** (`2202427980234937`). El callback se conservó. Queda pendiente probar la recepción desde el celular.

<details>
<summary>Copias iniciales e instrucciones de importación</summary>

Copias importables de los seis borradores del 25 de noviembre de 2026. La instancia de n8n guarda el trabajo en curso. Corresponden a la versión guardada en esa fecha.

| Archivo | Uso |
| --- | --- |
| [recepcion-bot.json](recepcion-bot.json) | Prueba manual del bot sobre una consulta demo |
| [persistencia.json](persistencia.json) | Verificación de ingreso idempotente, historial y contadores |
| [contexto-comercial.json](contexto-comercial.json) | Extracción sobre dos turnos comerciales |
| [reserva-cierre.json](reserva-cierre.json) | Reserva idempotente de un cierre demo |
| [conexion-whatsapp.json](conexion-whatsapp.json) | Envío manual de un texto al destinatario autorizado que se configure |
| [recepcion-whatsapp.json](recepcion-whatsapp.json) | Recepción del evento `messages` y separación de mensajes y estados del número de prueba |

## Importación en n8n

Importá el JSON como workflow nuevo. Las copias están inactivas y omiten vínculos de credenciales, identificadores de webhook, datos fijados e historial de ejecuciones. El destino del envío de prueba está vacío. Al importar, revisá las credenciales seleccionadas y completá el destinatario autorizado si vas a probar el envío.

Las pruebas de persistencia, contexto, reserva y recepción del bot conservan la URL del proyecto Supabase y sus referencias demo. Verificá el entorno y los registros antes de ejecutar. Según el flujo, necesitan credenciales Supabase API y del modelo del extractor.

Para recibir WhatsApp, vinculá en el trigger la credencial WhatsApp OAuth de la app de Meta. Comprobá primero en la app si el objeto WhatsApp Business Account ya tiene una URL de callback y si está suscrito a `messages`. La escucha de prueba también usa el webhook de la app. El flujo filtra por Phone Number ID `1526007707255136`. La rama de mensajes muestra ID, remitente, Phone Number ID y texto. La rama de estados muestra el ID del mensaje, el Phone Number ID y el estado informado por Meta.

</details>
