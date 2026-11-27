# Validación remota de D07 — 27/11/2026

Resultado: el recorrido ensayado coincide entre Next real en QA3114, PostgREST de desarrollo y las ejecuciones guardadas de n8n. No se detectó un bloqueo funcional en OP-000066 ni en el ingreso silenciado de OP-000065. Este control no envió mensajes, llamó a modelos, ejecutó workflows, aplicó SQL remoto ni modificó datos comerciales, cuentas, asignaciones o notificaciones.

El operador aplicó/configuró desarrollo y el chat de n8n realizó el ensayo antes de este contraste. Se consultaron ejecuciones existentes; no se reprodujeron. Las afirmaciones sobre otros entornos o casos no ensayados quedan fuera de esta validación.

## Fichas navegables y fuentes

- [OP-000066 en QA3114](http://localhost:3114/oportunidades/987d12e0-2080-4419-b25f-e70579e8b0ed).
- [OP-000065 en QA3114](http://localhost:3114/oportunidades/5b139398-b9a2-4d36-a95c-8065ea31aecb).
- PostgREST leído con sesión administrativa existente: `leads`, `lead_interests`, `lead_messages`, `messages`, `conversations`, `score_evaluations`, `get_current_lead_score`, `get_bot_conversation`.
- Ejecuciones n8n del workflow de recepción: 118, 119 y 120 (tres turnos de OP-000066); 122 (mensaje durante pausa de OP-000065). Lecturas guardadas 117 y 123 del workflow de revisión aportan contadores antes/después del mensaje silenciado.

## OP-000066

| Dato | Resultado persistido y visible |
| --- | --- |
| Identificación | El nombre coincide con `customers.full_name`; el panel advierte que procede del perfil de WhatsApp y no es identidad verificada. |
| Búsqueda vigente | Honda Civic, automático, desde 2019. |
| Continuidad | Las ejecuciones 118/119/120 resuelven la misma oportunidad, conversación y ciclo. La búsqueda manual original permanece como interés reemplazado. |
| Presupuesto | USD 18.000, `valor_total`; no dinero a agregar. |
| Usado | Entrega confirmada de Volkswagen Gol 2015; no se confunde con el Civic buscado. |
| Plazo / financiación | Dentro de los próximos 20 días; financiación `false`, visible como «No solicita financiación». |
| Intención y resumen | Visita expresada en el mensaje, recogida en el resumen y en el score. Resumen visible idéntico al guardado. |
| Score | 80/100 Alto. Plazo 20 + intención 30 + búsqueda 15 + presupuesto 15. Versión `pelucars_score_v1_prototipo`, sin cambios de reglas. |
| Evidencias | Cinco citas exactas: plazo, visita, presupuesto y dos de búsqueda (original/corrección). Todas pertenecen a mensajes reales del cliente y respetan el corte de posición 30. Evaluación sin limitaciones declaradas. |
| Conversación | Seis mensajes únicos, tres entrantes y tres del bot, posiciones confirmadas 26–31 en orden ascendente. El DOM coincide por ID, texto y posición con PostgREST. |
| Cupos / envíos | Slots 1, 2 y 3; tercero `closing`. `reserved_slots=3`, `sent_count=3`, `waiting_assignment`. Los tres salientes tienen `send_state=sent`, `sent_at` e ID del proveedor. |

Los resultados guardados de n8n muestran aceptación de Meta y registro `sent` en cada turno. Eso acredita envío aceptado/registrado, no lectura ni entrega al dispositivo. La confirmación de recepción del participante está documentada por el chat de n8n en `n8n/workflows/ensayo-d07.md` de #19; este control no la sustituyó por una inferencia a partir de la existencia de la oportunidad.

El catálogo permanece sin vínculo (`vehicle_id=null`) y no se crearon fichas/unidades ni se completaron datos. El alta de catálogo de #18 es otro incremento. Hay un interés histórico adicional por la variación literal «automático» → «automática» entre extracciones: existe un único interés activo y el valor comercial es consistente. Es una observación de normalización de la extracción, no una segunda compra ni un fallo de continuidad D07; no se corrigieron registros para ocultarla.

## OP-000065: ingreso durante pausa

La ejecución 122, iniciada el 27/11 a las 16:56:40 UTC, guardó un recibo nuevo (`created=true`) con `disposition=paused`. El mensaje coincide por ID de recibo/mensaje y texto con el séptimo elemento de la conversación visible. Las posiciones son 20–25 y 32: el salto corresponde a la secuencia global, no a mensajes perdidos de esta oportunidad.

- Antes: lectura 117 (16:48 UTC), seis mensajes de la oportunidad, tres reservas y tres envíos.
- Después: lectura 123 (16:57 UTC) y PostgREST actual, siete mensajes, tres reservas y tres envíos; sigue `waiting_assignment`. El adicional es del cliente, sin reserva ni respuesta nueva.
- El ingreso devolvió `pause_until=2026-11-30T15:45:39.336471Z`. Coincide exactamente con el cierre original del 27/11 a las `15:45:39.336471Z` más 72 horas, no con el momento del nuevo mensaje. En Argentina vence el **30/11 a las 12:45:39**. No hay prórroga por el ingreso.
- Se inspeccionó el conjunto completo de nodos ejecutados en 122: termina por la rama no pendiente. No ejecutó toma de turno, clasificación, extractor, guardado comercial/score, reserva, toma de envío ni nodo WhatsApp saliente. El registro `paused` acredita silencio D07; no se deduce sólo del filtro del remitente.
- La ficha conserva score 80 y sus cinco evidencias anteriores; tres evaluaciones guardadas, sin una cuarta provocada por el mensaje silenciado.

## Comprobaciones efectivas y artefactos

Se reutilizó el control focalizado de QA: login administrativo real, redirección a login sin sesión, comparación de nombre/resumen/campos/intereses, apertura y cierre del detalle del score, comparación de puntos/motivos/citas con PostgREST, integridad y orden de todos los mensajes, ausencia de errores de lectura y de desbordamiento horizontal a 1440 px. Ambas fichas pasaron. El selector del script local se ajustó para comparar también atributos cuando varios intereses históricos comparten `requested_text`; no fue un cambio del producto.

Se agregó una lectura focalizada de los slots, fechas e IDs de proveedor para no confundir oportunidad creada con envío confirmado. Se revisó la captura del detalle abierto de OP-000066. Artefactos locales ignorados bajo `.pr-work/`: `pr14-functional-66/results.json`, `pr14-functional-65/results.json`, sus `ficha.png`/`score-evidencias.png`, `d07-trial-readproof.json` y `d07-n8n-readproof.json`. Los volcados privados de PostgREST y capturas no se suben al repositorio.

No se repitieron suites SQL, build ni pruebas visuales completas de escritorio/móvil: sólo cambió documentación. Las pruebas locales D07 y de concurrencia ya acreditadas siguen en [bot-d07.md](bot-d07.md#validación-local). Este control usó administrador; no acredita una sesión nueva de vendedor habilitado/asignado ni cambia permisos para obtenerla.

## Estado de integración y pendientes concretos

1. **#17:** abierto y listo para revisión. Se detectó y resolvió el conflicto de `docs/decisiones.md` con main tras #20, conservando D07 y los acuerdos D08/D16/D20. Falta revisión e integración por el responsable; no queda un fallo funcional observado en este ensayo. La evidencia local de SQL no se volvió a ejecutar por cambios documentales.
2. **#19:** abierto como borrador, basado en `codex/d07-pausa-72h`. Falta terminar su revisión y retirarlo de borrador; integrar primero #17 y comprobar/retargetear luego la base a main. Su descripción todavía decía ensayo/migración pendientes y se actualiza con este contraste. No se modificó el workflow ni su exportación.
3. **Cobertura no remota de este ensayo:** saludo no comercial aislado, cierre temprano bajo D07, repetición del mismo ID de proveedor y reactivación por un nuevo mensaje tras 72h. Están cubiertos por pruebas locales previas, pero no se presentan como ensayados remotamente. No se repiten WhatsApps ni se adelanta el reloj para completar esta lista.
4. **Habilitación general:** no queda autorizada por este ensayo. El workflow se releyó apagado (`habilitada=false`), `active=false` y sin versión publicada. Antes de otro entorno/recepción general, conservar la revisión de migración, conciliación histórica y límites/presupuesto propios indicados en el handoff. Los límites demo no son defaults de producción.

Al consultar GitHub no había revisiones ni hilos de revisión en #17/#19; la API de estados de commit no devolvió estados publicados (no se declara CI aprobada). Checkout principal y QA actualizados desde `origin/main` a `de3b770`; sólo cambiaron documentos respecto de `2053064`, con árbol `frontend/` idéntico. QA mantiene el proceso Next 30572 en 3114, sin reinicio. `wsp/` y los cambios locales se conservaron. No se avanzó #16 ni se mergearon PR/desplegaron cambios.
