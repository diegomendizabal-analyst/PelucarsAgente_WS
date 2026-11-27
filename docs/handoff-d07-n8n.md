# Handoff D07 para n8n

Contrato revisable: [bot-d07.md](bot-d07.md). Migración local `20261127153553_bot_contact_cycles_72h.sql`, **sin aplicar remotamente**. No se modificaron workflows. Sustituye el uso de UUID fijos de oportunidad/conversación para recepción general; no mezclar con el trabajo visual #16.

## Secuencia obligatoria

1. Normalizar E.164 y tomar proveedor, número comercial, ID externo estable y texto del evento. `source` viene de configuración confiable del workflow (`demo` o `whatsapp_bot`), nunca del texto/IA. No invocar IA para decidir si está en pausa.
2. `receive_bot_contact_message` guarda y deduplica. `paused`, `review` o `historical`: terminar. Ninguna extracción, score, respuesta o alta. Un duplicado nunca es permiso para repetir trabajo costoso.
3. `list_bot_contact_queue(receipt_id)` permite encontrar el pendiente más antiguo. Intentar `claim_bot_contact_message`. Sólo `claimed=true` autoriza el pipeline. Con `busy`, dejarlo guardado; el worker dueño puede drenar al terminar. Con límites ausentes/excedidos, detener procesamiento y conservar el recibo. No programar un temporizador de reactivación ni renovar la pausa.
4. Tras la toma, consultar cliente/oportunidades del teléfono **filtrando source**, resolver continuidad/intención comercial con un único procesamiento acotado. Aportar `same_search`, `new_search`, `additional_purchase`, `noncommercial` o `uncertain`. Cambiar marca/modelo en una búsqueda no es compra adicional. Si existen varias búsquedas abiertas, elegir ID con evidencia suficiente o dejar `uncertain`; no asumir la última.
5. `resolve_bot_contact_message` devuelve IDs definitivos. Guardar esta petición/resultado en la ejecución para reintentos idénticos. Si `noncommercial`/`review`, terminar; no se creó cliente/oportunidad ni permiso de respuesta. Un `PT409` exige relectura/conciliación, no crear otro UUID y reintentar a ciegas.
6. Para `resolved`, leer el entrante por `message_id`, obtener su posición y paginar `bot_opportunity_history` con corte exclusivo fijo. Incluir actuales y silenciados anteriores sólo como contexto de la misma oportunidad, sin duplicar el actual. Los mensajes sin posición confirmada y las respuestas fallidas/inciertas no son diálogo entregado.
7. Extraer campos, guardar mediante `save_bot_lead_details`; después calcular con las reglas existentes y guardar `save_bot_score`. Conservar la petición exacta para reintentos. Los wrappers rechazan trabajo tardío de un turno no vigente. No cambiar reglas ni inventar atributos para conseguir una vinculación de catálogo.
8. Leer **`get_bot_contact_turn`**. Usar `reserved_slots` de ese ciclo en `reserve_bot_reply`. Con 2 sólo cierre; `closing` incluso en 1 inicia la pausa de 72h inmediatamente. No llamar luego `set_bot_conversation_state` para cerrar. Si no corresponde responder, `complete_bot_contact_turn` libera el turno resuelto sin reactivar ni borrar nada.
9. Para la reserva, `claim_bot_reply`: sólo `claimed=true` permite el intento externo. Registrar `sent` con ID confirmado, `failed` o `unknown` según evidencia. No reenviar automáticamente; falla/incertidumbre conserva cupo y pausa. No interpretar `sent` como entregado/leído.
10. Tras terminar, se puede drenar la cola del mismo contacto con una nueva toma por recibo, bajo los mismos límites. No volver a clasificar recibos `processing`, `resolved`, `paused` o históricos. Si se perdió una respuesta HTTP después de una toma, recuperar la ejecución/resultado existente; no obtener otra autorización de IA por timeout.

Ejemplo de ingreso (identificadores ilustrativos; no ejecutar contra desarrollo para cargar datos):

```json
{
  "p_source": "demo",
  "p_phone_e164": "+12025550123",
  "p_provider": "demo",
  "p_business_phone_id": "linea-de-prueba",
  "p_provider_message_id": "id-estable-del-evento",
  "p_body": "Texto literal recibido"
}
```

## Preparación antes de habilitar

- Migración revisada y aplicada por el operador autorizado. Verificar firmas y permisos con PostgREST; no asumir aplicación por merge.
- Conciliar históricos marcados `needs_review`, múltiples ciclos activos antiguos y workers/envíos en tránsito. No completar timestamps ni resetear cupos para pasar controles.
- Acordar los límites de ventana/contacto/línea y configurarlos en la tabla privada; no hay defaults de producción. Mantener límites de tokens, salida, reintentos y presupuesto del proveedor/n8n. El contador SQL limita pipelines, no el costo base de cada webhook ni el precio de IA.
- Mantener el procesamiento deshabilitado hasta revisar la adaptación. Alta manual, agenda y notificaciones nuevas no son requisitos de este cambio.

## Ensayo remoto pendiente, a coordinar después de aplicar

Comprobar por RPC HTTP y panel: primera consulta comercial y otra no comercial; misma búsqueda y cambio de preferencia; cierre temprano y resultado de envío; entrada durante pausa conservada sin llamadas de IA; duplicados sin consumo extra; nueva entrada elegible que crea otro ciclo sin reset histórico. No usar sleeps de 72h ni un reloj configurable remoto para simular límites: esos extremos se acreditan en PostgreSQL local con tiempo controlado. La verificación operativa remota debe respetar el tiempo real o un plan de prueba aprobado por separado.

No se solicita publicar, enviar WhatsApp, alterar datos existentes ni ejecutar migraciones como parte de leer este handoff.
