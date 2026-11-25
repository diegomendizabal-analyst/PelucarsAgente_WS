# Workflows de prueba de Pelucars

Cierre del 25 de noviembre de 2026. Los flujos se conservan en n8n sin publicar. Los números con almohadilla identifican ejecuciones ya realizadas.

| Workflow | Propósito y resultado observado | Pendiente |
| --- | --- | --- |
| [Pelucars — Prueba de recepción](recepcion-bot.json) | Prepara contexto, extrae datos y decide si reservar una pregunta o el cierre. Las etapas se comprobaron en las pruebas separadas de contexto y reserva. | Persistir resumen, score y evidencias. |
| [Pelucars — Prueba manual de persistencia](persistencia.json) | Registró dos veces la misma entrada. La segunda devolvió el mismo mensaje con `created=false`. El historial conservó una entrada (#19). | Ninguno para esta prueba. |
| [Pelucars — Prueba de contexto comercial](contexto-comercial.json) | El segundo turno conservó vehículo y presupuesto e incorporó plazo, usado y financiación (#20). | Persistencia de los resultados de extracción. |
| [Pelucars — Prueba de reserva de cierre](reserva-cierre.json) | Dos llamadas devolvieron el mismo cierre. Quedó pendiente en un único cupo, con cero envíos (#21). | Ninguno para la reserva idempotente. |
| [Pelucars — Prueba de conexión WhatsApp](conexion-whatsapp.json) | Envío manual por el nodo WhatsApp Business Cloud. Meta aceptó el texto en #23 y se confirmó la llegada al celular. | Usarlo una sola vez como control al retomar el diagnóstico. |
| [Pelucars — Verificar suscripción de WhatsApp](verificar-suscripcion-whatsapp.json) | Consulta el número, las apps suscritas y los permisos. Identificó la suscripción faltante (#25). Los permisos de gestión y mensajería figuraban concedidos en #37. | La causa específica de 131005 sigue abierta. |
| [Pelucars — Suscribir app de prueba a WhatsApp](suscribir-app-whatsapp.json) | Verificó la app del token, la suscribió a la cuenta de prueba y comprobó que la suscripción anterior se conservó (#26). | Suscripción ya realizada. |
| [Pelucars — Recepción WhatsApp de prueba](recepcion-whatsapp.json) | El trigger recibió un texto real tras suscribir la app a la cuenta (#27). Esta exportación conserva esa etapa de recepción y separa mensajes de estados. | El recorrido integrado se revisa por separado. |

Los JSON contienen el diseño para importar. Vinculá las credenciales en n8n y sustituí `proyecto-demo.supabase.co` y los marcadores `META_…` y `DEMO_…` por valores del entorno autorizado. La prueba de reserva requiere completar en «Parámetros acordados» los dos textos, sus posiciones reales, los identificadores y el cierre acordado. La prueba de conexión deja vacío el destinatario. Conservá el único WhatsApp Trigger de la aplicación.
