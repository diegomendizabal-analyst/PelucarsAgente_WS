# Workflows de prueba de Pelucars

Actualizado el 26 de noviembre de 2026. Los flujos se conservan en n8n sin publicar. Los números con almohadilla identifican ejecuciones ya realizadas.

| Workflow | Propósito y resultado observado | Pendiente |
| --- | --- | --- |
| [Pelucars — Prueba de recepción](recepcion-bot.json) | Prepara contexto, extrae datos y decide si reservar una pregunta o el cierre. Las etapas se comprobaron en las pruebas separadas de contexto y reserva. | Persistir resumen, score y evidencias. |
| [Pelucars — Prueba manual de persistencia](persistencia.json) | Registró dos veces la misma entrada. La segunda devolvió el mismo mensaje con `created=false`. El historial conservó una entrada (#19). | Ninguno para esta prueba. |
| [Pelucars — Prueba de contexto comercial](contexto-comercial.json) | El segundo turno conservó vehículo y presupuesto e incorporó plazo, usado y financiación (#20). | Persistencia de los resultados de extracción. |
| [Pelucars — Prueba de reserva de cierre](reserva-cierre.json) | Dos llamadas devolvieron el mismo cierre. Quedó pendiente en un único cupo, con cero envíos (#21). | Ninguno para la reserva idempotente. |
| [Pelucars — Prueba de conexión WhatsApp](conexion-whatsapp.json) | El nodo WhatsApp Business Cloud entregó el texto en #23 y, con la credencial actualizada, en #41. El destinatario confirmó ambas llegadas. En #38 Meta había rechazado el token con 401 / 190. | Control aislado completado. |
| [Pelucars — Verificar suscripción de WhatsApp](verificar-suscripcion-whatsapp.json) | Detectó la suscripción faltante en #25 y el token vencido en #39 (190/463). En #40 las cuatro consultas devolvieron 200. Se verificaron la app asociada al token, el número en la cuenta, la suscripción y los permisos de gestión y mensajería. | Diagnóstico de lectura completado. |
| [Pelucars — Suscribir app de prueba a WhatsApp](suscribir-app-whatsapp.json) | Verificó la app del token, la suscribió a la cuenta de prueba y comprobó que la suscripción anterior se conservó (#26). | Suscripción ya realizada. |
| [Pelucars — Recepción WhatsApp de prueba](recepcion-whatsapp.json) | En #46 guardó «No entrego usado», reservó el cierre en el cupo 3 y lo tomó y envió una sola vez. Se registró el ID de Meta y el destinatario confirmó la llegada. | Procesamiento deshabilitado. Revisar la clasificación histórica del cupo 1 (#34). |
| [Pelucars — Revisión de remitente demo](revision-remitente-demo.json) | Verificó el remitente antes del alta. La lectura #47 confirmó `waiting_assignment`, tres cupos reservados, un envío y cuatro mensajes visibles en el historial. | Conservar las tres reservas y sus estados. |
| [Pelucars — Alta de prueba autorizada](alta-demo.json) | Creó el cliente y OP-000060 después de repetir las comprobaciones. La oportunidad quedó sin vendedor, asignaciones ni avisos (#33). | Alta completada. Conservar OP-000060 en pausa. |

Los JSON contienen el diseño para importar. Vinculá las credenciales en n8n y sustituí `proyecto-demo.supabase.co` y los marcadores `META_…` y `DEMO_…` por valores del entorno autorizado. La prueba de reserva requiere completar en «Parámetros acordados» los dos textos, sus posiciones reales, los identificadores y el cierre acordado. La prueba de conexión deja vacío el destinatario. Conservá el único WhatsApp Trigger de la aplicación.
