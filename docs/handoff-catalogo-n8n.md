# Handoff n8n — alta de marca/modelo

Implementación separada posterior a D07; [contrato completo](bot-catalogo.md). Migración `20261127155419_bot_catalog_intake.sql` **local, sin aplicar remotamente**. Este trabajo no edita workflows, crea stock ni envía WhatsApp.

1. Mantener la secuencia D07: recibir/deduplicar, obtener toma exclusiva antes de IA, resolver oportunidad. `paused`, `review`, `historical`, sin toma o sin límites configurados no autorizan extracción ni alta de catálogo.
2. El extractor conserva el objeto comercial actual y atributos separados. Añadir una resolución estructurada `unambiguous`, `ambiguous` o `insufficient`. No usar el resumen como fuente de atributos. Identificar exclusivamente el vehículo buscado; usado, alternativa ofrecida, comparación, negación y varias opciones no son una identificación inequívoca.
3. Sólo para `unambiguous`: `role=sought_vehicle`, UUID de un mensaje del cliente dentro del contexto/corte y cita literal con marca/modelo. Los atributos deben aparecer también en `vehiculo_buscado`. Si falta marca o hay alias, error de escritura, duda de clasificación o alternativas sin resolver, conservar incertidumbre. No hacer una consulta IA extra sin toma/cupo para conseguir una marca.
4. Sustituir la llamada del turno a `save_bot_lead_details` por `save_bot_lead_details_with_catalog`. Enviar los mismos cinco parámetros comerciales y `p_catalog_resolution`. **Una llamada**, sin crear primero catálogo mediante SQL/API ni guardar primero los datos comerciales. La RPC decide el origen desde la oportunidad.
5. Conservar íntegra la petición para un reintento de transporte. `applied/created` o `applied/reused` devuelven `vehicle_id`; `unresolved` y `archived` no. Nunca restaurar ni cambiar de origen una ficha como fallback. La ficha nueva no acredita stock, unidad, precio ni coincidencia de año/transmisión.
6. `stale/not_applied`: no continuar el turno viejo. `unchanged/not_applied`: ese corte ya se guardó por la RPC anterior; no pedir otra extracción ni inventar un nuevo mensaje para vincularlo. `unchanged` con resultado de catálogo guardado confirma idempotencia; no repetir alta ni auditoría.
7. Tras persistencia válida, score y reserva/toma/resultado siguen los contratos existentes de D07. No modificar sus reglas. Con `PT409`/validación, conciliar el estado y la ejecución; no enviar una respuesta afirmando un alta fallida.

Fragmento de petición orientativo; usar UUID reales de la misma ejecución, nunca copiar estos textos para cargar datos de prueba en Supabase:

```json
{
  "p_conversation_id": "UUID de conversación resuelta por D07",
  "p_message_id": "UUID del entrante actual",
  "p_extraction": {"vehiculo_buscado": "Ford Ranger", "...": "resto del objeto comercial completo"},
  "p_attributes": {"marca": "Ford", "modelo": "Ranger", "anio_minimo": 2020, "transmision": "manual"},
  "p_provider_profile_name": null,
  "p_catalog_resolution": {
    "status": "unambiguous",
    "role": "sought_vehicle",
    "message_id": "UUID del mensaje citado del cliente",
    "quote": "Busco Ford Ranger"
  }
}
```

Es un fragmento explicativo, no JSON listo para ejecutar: `p_extraction` requiere todos sus campos. Para incertidumbre, enviar sólo `{"status":"ambiguous"}` o `{"status":"insufficient"}`. No usar `unambiguous` como valor predeterminado del workflow.

Pendiente de operación autorizada: integrar primero D07, revisar/aplicar ambas migraciones según su estado real, comprobar RPC con PostgREST y adaptar el workflow manteniendo procesamiento deshabilitado hasta aprobar el ensayo. Las carreras/rollback ya se prueban localmente; el recorrido HTTP/WhatsApp con entrada nueva se coordina después. No modificar los históricos OP-000063/OP-000064 para demostrar el alta.
