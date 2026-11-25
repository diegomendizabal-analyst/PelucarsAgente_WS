# Workflows de Pelucars en n8n

Copias importables de los seis borradores del 25 de noviembre de 2026. La instancia de n8n guarda el trabajo en curso. Estas copias se actualizan por commit cuando cambia un flujo.

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
