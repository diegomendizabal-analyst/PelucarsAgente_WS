# Workflows de prueba de Pelucars

## Recepción de WhatsApp y persistencia

El [workflow de recepción](recepcion-whatsapp.json) está sin publicar y tiene el procesamiento deshabilitado. Cuando se habilita para una prueba, acepta texto libre del remitente autorizado que llega al número de prueba. Requiere texto no vacío e identificador del proveedor. Guarda el cuerpo original en la oportunidad demo configurada. Los avisos de entrega y lectura siguen una rama separada.

1. **Recepción.** El trigger recibió la consulta comercial. La primera ejecución se detuvo antes del guardado porque faltaba el punto final que exigía el filtro de prueba. Antes de retomar el evento se verificó que la oportunidad seguía sin conversación, mensajes ni resumen y que el mensaje externo aún no estaba registrado.
2. **Persistencia y extracción.** El evento guardado se procesó una vez con su identidad y texto originales. El ingreso devolvió `created=true`. El extractor identificó Corolla automático modelo 2022 en adelante, presupuesto total de USD 20.000, compra dentro de 15 días, sin entrega de usado ni financiación. El guardado del resumen devolvió `applied` y lo vinculó al mensaje entrante.
3. **Cierre.** Con los datos completos y cero cupos usados, el bot reservó el cierre en el primer cupo. Lo tomó una vez, Meta aceptó un único envío y el destinatario confirmó la llegada. Una lectura posterior verificó `waiting_assignment`, `reserved_slots=1`, `sent_count=1` y dos mensajes en orden: la consulta y el cierre. El resumen coincidía con la extracción y el identificador del envío guardado coincidía con el devuelto por Meta. La oportunidad quedó sin vendedor ni notificaciones.

Después de la prueba se retiró la comparación del texto comercial para las próximas entradas. Se comprobaron los filtros con datos sintéticos. La deduplicación conserva la clave formada por proveedor, número comercial e identificador externo del mensaje. La prueba de persistencia verificó por separado que repetir el ingreso devuelve el mismo registro con `created=false`.

## Otras comprobaciones

| Workflow | Resultado |
| --- | --- |
| [Prueba de recepción](recepcion-bot.json) | Prepara el contexto, extrae los datos y propone una pregunta o un cierre según los cupos reservados. |
| [Persistencia](persistencia.json) | Dos ingresos idénticos dejaron una sola entrada en el historial. |
| [Contexto comercial](contexto-comercial.json) | El segundo turno conservó vehículo y presupuesto e incorporó plazo, usado y financiación. |
| [Reserva de cierre](reserva-cierre.json) | Repetir la reserva devolvió el mismo cierre. Quedó pendiente en un cupo, con cero envíos. |
| [Conexión WhatsApp](conexion-whatsapp.json) | El destinatario confirmó el envío aislado. Otro control detectó la caducidad del token y el envío volvió a funcionar tras actualizarlo. |
| [Verificar suscripción](verificar-suscripcion-whatsapp.json) | Las lecturas confirmaron la aplicación, el número de prueba, la suscripción a la cuenta y los permisos de gestión y mensajería. |
| [Suscribir aplicación](suscribir-app-whatsapp.json) | Se comprobó la identidad de la aplicación y se conservó la suscripción existente al agregar la de prueba. |
| [Revisión del remitente](revision-remitente-demo.json) | En la demo anterior se verificaron tres cupos reservados, un envío y cuatro mensajes visibles en el historial. El reintento aislado del guardado de resumen devolvió `unchanged` y conservó `updated_at`. |
| [Alta demo](alta-demo.json) | Se comprobaron las condiciones antes del alta. El cliente y la oportunidad de prueba quedaron sin asignación ni avisos. |

Quedan pendientes la persistencia del score y sus evidencias, y la clasificación de un error local previo a un envío en la demo anterior.

## Uso de la exportación

La plantilla de recepción usa identificadores sintéticos para los nodos y grupos del diagrama. Para importarla, vinculá las credenciales desde n8n y sustituí `proyecto-demo.supabase.co` y los marcadores `META_…` y `DEMO_…` por los valores del entorno autorizado. En la rama de estados usá el destinatario sin el signo más, tal como lo informa Meta. Conservá el único WhatsApp Trigger de la aplicación. La prueba aislada de reserva requiere los textos y posiciones reales del caso reservado. La de conexión deja el destinatario vacío.
