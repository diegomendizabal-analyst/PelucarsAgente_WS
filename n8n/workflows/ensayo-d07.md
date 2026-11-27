# Ensayo de recepción D07

El workflow **Pelucars — Recepción WhatsApp de prueba** conserva su único trigger, la línea de prueba, el remitente histórico autorizado sólo para silencio y el origen fijo `demo`. El borrador y la exportación tienen el procesamiento apagado. La exportación usa marcadores de configuración, sin credenciales, historial de ejecución ni identificadores del entorno.

**Qué cambia.** Se guardan los textos y los pies de foto, video o documento, en orden dentro de cada lote y con el ID original del proveedor. Se conserva la redacción literal, incluidos espacios, saltos, emojis y correcciones. Las notificaciones de estado van por separado. Audio, stickers y archivos sin texto quedan fuera del contrato actual. Para una recepción continua hace falta habilitar el trigger de forma coordinada; una escucha manual puede terminar entre dos mensajes.

Supabase deduplica el ingreso. Sólo un recibo pendiente tomado con `claimed=true` pasa a clasificación. La cola entrega el pendiente más antiguo del mismo contacto. El texto usado siempre es el de la toma; el nombre de perfil sólo se utiliza si corresponde al mismo evento. Pausa, revisión, histórico o toma denegada terminan ese camino. Ningún temporizador reintenta trabajo.

La clasificación consulta las oportunidades abiertas del teléfono y origen autorizados. Una compra adicional requiere una declaración explícita. Con varias abiertas se exige una referencia distintiva; una decisión ambigua termina en revisión. Sólo una resolución comercial devuelve los IDs usados por el extractor, el guardado comercial, el score y la reserva. El historial se pagina con corte exclusivo anterior al entrante. Un conflicto en la resolución relee el turno y detiene la ejecución para conciliar con la petición guardada.

Se decide con `get_bot_contact_turn.reserved_slots`. El cupo 3 sólo admite cierre. Reservar el cierre, incluso en el cupo 1, inicia la pausa en la misma transacción. Ante un conflicto de reserva se busca la respuesta ya guardada. Si el contador avanzó, se recalcula sin volver a IA. Una reserva distinta o un conflicto sin avance requieren conciliación. Sólo una toma de envío positiva permite el intento externo. Un resultado incierto conserva el cupo y requiere revisión; la aceptación de Meta y la llegada al celular se verifican por separado.

## Retiro del remitente temporal después del ensayo

Por pedido del usuario, se retiró el remitente familiar de las rutas de entrada y de notificaciones de estado, incluida su representación alternativa. La consulta auxiliar de elegibilidad también dejó de incluirlo. El remitente histórico conserva su control de silencio; no queda una ruta comercial habilitada para el participante retirado. El procesamiento permanece apagado y el workflow sin publicar. No se borraron mensajes, oportunidades ni evidencias del ensayo.

La exportación refleja esa retirada. Se comprobó con datos ficticios que las dos variantes retiradas no producen salida del filtro de mensajes ni del de estados. La prueba de regresión del lote mixto se actualizó para exigir esa exclusión; no se repitió el ensayo remoto ni se invocó IA. La lista de destinatarios de prueba de Meta se administra por separado: su eliminación allí queda pendiente de realizar/verificar desde Meta Developers.

Los pasos siguientes describen la preparación y ejecución histórica. Para otro ensayo comercial será necesario autorizar explícitamente otro remitente; no reponer el temporal retirado al importar.

## Antes del ensayo

1. Revisar y aplicar, con autorización, `supabase/migrations/20261127153553_bot_contact_cycles_72h.sql` del PR #17. Confirmar el historial de migraciones, firmas, permisos y exposición de las RPC a la credencial técnica. Revisar contactos en `needs_review`, búsquedas abiertas, envíos en tránsito y efectos de recurrencia/asignación. La nueva recepción puede crear una oportunidad mediante los triggers existentes.
2. Propuesta sólo para la línea de prueba y `source=demo`: `window_seconds=900`, `max_contact_claims=6`, `max_line_claims=12` en `private.bot_processing_limits`. Falta aprobar y cargar la fila. Seis tomas permiten tres turnos comerciales, una consulta no comercial y margen para dos casos más. Duplicados ya procesados y mensajes en pausa no consumen tomas. Acordar también el presupuesto de IA y ejecuciones del servicio antes de habilitar.
3. El borrador fija cero reintentos del modelo, hasta 350 tokens de salida para clasificación y 2.400 para extracción. Más de diez búsquedas abiertas o más de 8.000 caracteres en el entrante pasan a revisión. Si historial más entrante supera 32.000 caracteres, el flujo completa el turno sin extraer, guardar score ni responder. No se trunca el diálogo para fabricar una respuesta. Estos son límites de ensayo.
4. Usar el nuevo remitente autorizado para el intercambio y el remitente histórico para verificar el silencio. La ruta acepta las dos representaciones autorizadas del teléfono argentino y mantiene una sola identidad de contacto por remitente. La respuesta toma su destino de la ruta autorizada para ese turno. El remitente histórico carece de ruta de salida: si un entrante nuevo no vuelve como `paused`, detener el ensayo y revisar el resultado del ingreso. Un silencio por filtro no acredita D07. Verificar un único recibo `paused` y contadores sin cambios. Un cierre histórico reciente del mismo remitente y línea puede imponer pausa al migrar. Si corresponde, esperar las 72 horas reales o acordar otro remitente de prueba limpio; conservar el historial y los cupos. Verificar escucha activa antes de cada turno manual y detenerla al terminar.

## Intercambio propuesto

| Turno | Ejemplo orientativo, admite redacción libre | Comprobación |
| --- | --- | --- |
| 1 | «Buenas! ando mirando un Civic manual, 2019 para arriba» | Un recibo y una toma. Ante búsqueda inequívoca, pregunta de presupuesto en cupo 1. |
| 2 | «18 mil dólares en total. Bah, automático mejor» | Misma oportunidad y ciclo, reemplazo de transmisión, pregunta por usado en cupo 2. |
| 3 | «Dejo mi Gol 2015. Dentro de 20 días, sin financiar. ¿Puedo ir a verlo?» | El Gol queda como usado. Cierre en cupo 3 y pausa hasta 72 horas desde la reserva. |
| 4 | «Ah, y si tenés uno gris avisame» | En pausa se conserva el entrante. Fechas, tomas, score y reservas permanecen iguales. Ninguna respuesta. |

Comparar estados y contadores antes y después de cada turno, la ficha, las citas y los resultados reales del envío. Reproducir un evento guardado con **el mismo ID** para verificar deduplicación; un nuevo WhatsApp de igual texto tiene otro ID. Validar por separado un saludo aislado y un cierre temprano con datos completos en contactos/ciclos elegibles. Un nuevo mensaje tras las 72 horas debe abrir un ciclo elegible manteniendo el anterior. Un mensaje silenciado jamás se usa como disparador diferido. No adelantar el reloj remoto. Tras el ensayo, apagar procesamiento y dejar el workflow sin publicar.

**Validación de este cambio.** `node --test n8n/workflows/recepcion-d07.test.mjs` comprueba en local el cableado y las decisiones con ejemplos ficticios. Las pruebas no llaman a n8n, Supabase, Meta ni IA. El 27 de noviembre de 2026 se verificó además el intercambio real en modo manual, usando la migración y los límites demo configurados.

## Resultado del ensayo manual

1. La búsqueda del Civic manual de 2019 en adelante produjo la pregunta de presupuesto en el cupo 1. Score de 15 puntos.
2. El segundo mensaje corrigió la transmisión a automática y agregó USD 18.000 de presupuesto total. Se conservaron la oportunidad, el modelo y el año mínimo. La pregunta por el usado ocupó el cupo 2. Score de 30 puntos.
3. El tercer mensaje identificó el Gol 2015 como usado, compra en 20 días, sin financiación y con intención de visita. Se guardó el score de 80 puntos con sus evidencias: plazo 20, intención 30, búsqueda 15 y presupuesto 15. Meta aceptó el cierre en el cupo 3 y el participante confirmó la recepción. La ficha quedó en `waiting_assignment` con tres entrantes, tres respuestas y tres envíos confirmados.
4. El remitente histórico envió una consulta nueva durante su pausa. El ingreso devolvió `created=true` y `paused`; el vencimiento siguió siendo el que ya tenía. Una lectura posterior encontró un entrante adicional en su conversación y las mismas tres reservas y tres envíos confirmados. El workflow terminó antes de tomar el turno, llamar a IA, guardar score o intentar un envío.

Al terminar se verificó el procesamiento apagado y el workflow sin publicar. La reactivación por un mensaje nuevo tras 72 horas y la repetición remota del mismo ID de proveedor quedaron fuera de este intercambio.

[Contrato de integración](../../docs/handoff-d07-n8n.md) · [Semántica, transacciones y pruebas SQL](../../docs/bot-d07.md)
