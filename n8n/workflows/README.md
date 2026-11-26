# Workflows de prueba de Pelucars

Actualizado el 26 de noviembre de 2026. Los flujos se conservan en n8n sin publicar. Los números con almohadilla identifican ejecuciones ya realizadas.

| Workflow | Propósito y resultado observado | Pendiente |
| --- | --- | --- |
| [Pelucars — Prueba de recepción](recepcion-bot.json) | Prepara contexto, extrae datos y decide si reservar una pregunta o el cierre. Las etapas se comprobaron en las pruebas separadas de contexto y reserva. | Persistir resumen, score y evidencias. |
| [Pelucars — Prueba manual de persistencia](persistencia.json) | Registró dos veces la misma entrada. La segunda devolvió el mismo mensaje con `created=false`. El historial conservó una entrada (#19). | Ninguno para esta prueba. |
| [Pelucars — Prueba de contexto comercial](contexto-comercial.json) | El segundo turno conservó vehículo y presupuesto e incorporó plazo, usado y financiación (#20). | Persistencia de los resultados de extracción. |
| [Pelucars — Prueba de reserva de cierre](reserva-cierre.json) | Dos llamadas devolvieron el mismo cierre. Quedó pendiente en un único cupo, con cero envíos (#21). | Ninguno para la reserva idempotente. |
| [Pelucars — Prueba de conexión WhatsApp](conexion-whatsapp.json) | Envío manual por el nodo WhatsApp Business Cloud. Meta aceptó el texto en #23. En #38 el mismo envío se intentó una sola vez y devolvió HTTP 401, `OAuthException` 190 (`Authentication Error`), sin ID de mensaje. | Contar con un token vigente antes de comparar el transporte. |
| [Pelucars — Verificar suscripción de WhatsApp](verificar-suscripcion-whatsapp.json) | Consulta el número, las apps suscritas y los permisos. Identificó la suscripción faltante (#25). Los permisos de gestión y mensajería figuraban concedidos en #37. En #39 las cuatro lecturas devolvieron HTTP 401, código 190, subcódigo 463. Meta indicó que la sesión venció el 25/11 a las 14:00 de Argentina. | Verificar con un token vigente el acceso actual a la cuenta y al número. El rechazo 403 / 131005 de #35 ocurrió antes del vencimiento y sigue abierto. |
| [Pelucars — Suscribir app de prueba a WhatsApp](suscribir-app-whatsapp.json) | Verificó la app del token, la suscribió a la cuenta de prueba y comprobó que la suscripción anterior se conservó (#26). | Suscripción ya realizada. |
| [Pelucars — Recepción WhatsApp de prueba](recepcion-whatsapp.json) | El mismo trigger recibió textos reales. La integración guardó dos entradas y reservó dos preguntas (#34 y #35). El procesamiento está deshabilitado. | Verificar el envío integrado y revisar la clasificación de #34. |
| [Pelucars — Revisión de remitente demo](revision-remitente-demo.json) | Consultó el remitente y sus oportunidades antes del alta (#30 y #31). La lectura final comprobó el historial operativo y los contadores (#36). | Conservar los registros y los dos cupos. |
| [Pelucars — Alta de prueba autorizada](alta-demo.json) | Creó el cliente y OP-000060 después de repetir las comprobaciones. La oportunidad quedó sin vendedor, asignaciones ni avisos (#33). | Alta completada. Conservar OP-000060 en pausa. |

Los JSON contienen el diseño para importar. Vinculá las credenciales en n8n y sustituí `proyecto-demo.supabase.co` y los marcadores `META_…` y `DEMO_…` por valores del entorno autorizado. La prueba de reserva requiere completar en «Parámetros acordados» los dos textos, sus posiciones reales, los identificadores y el cierre acordado. La prueba de conexión deja vacío el destinatario. Conservá el único WhatsApp Trigger de la aplicación.
