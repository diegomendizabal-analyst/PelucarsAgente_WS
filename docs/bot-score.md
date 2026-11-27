# Persistencia del score del bot

Lectura preparada el 27/11: get_current_lead_score(p_lead_id, p_rules_version) devuelve cero o una fila con total, resultado, evidencias y mensaje/posición/fecha de corte. El panel solicita explícitamente pelucars_score_v1_prototipo; nunca elige una versión por orden alfabético ni una evaluación por fecha de guardado. La RPC es invoker, sólo authenticated; RLS decide por responsable actual/admin. No copia ni reconstruye retrospectivamente score de asignación/cierre. Migración 20261127123630_opportunity_bot_read_model.sql **pendiente de aplicar**. Prueba local de guardado tardío y reasignación pasa; no cambió el contrato de save_bot_score ni el workflow remoto.

La [migración para revisar](../supabase/migrations/20261126151500_bot_score_evaluations.sql) guarda una evaluación completa y sus citas en una transacción. Usa la salida del nodo **Calcular score** de la [prueba de recepción](../n8n/workflows/recepcion-bot.json). La versión se conserva como `pelucars_score_v1_prototipo`. La aprobación comercial de D08 sigue pendiente.

## Contrato para n8n

El servicio llama a `POST /rest/v1/rpc/save_bot_score` con estos parámetros:

| Parámetro | Valor |
| --- | --- |
| `p_conversation_id` | UUID de la conversación persistida |
| `p_message_id` | UUID interno del último mensaje de cliente incluido en la extracción |
| `p_evaluation` | Objeto `evaluacion_score` devuelto por el nodo existente, con su total, versión, banda, desglose por grupo, citas y limitaciones |
| `p_extraction_model` | Nombre del modelo si se conoce. Opcional, por defecto NULL |

La RPC devuelve una fila con `evaluation_id` y `outcome`. El primer guardado devuelve `applied`. Un reintento con el mismo corte, versión, resultado y modelo devuelve el mismo ID con `unchanged`. Un resultado distinto para esa misma clave devuelve `PT409` y preserva el original.

`score_evaluations` conserva el total, la versión, los criterios y pesos de esa versión y la salida original. El desglose se lee en `result → desglose`, la banda en `result → banda`. Cada contribución figura una vez en el desglose, aunque tenga varias citas. `score_evidence` vincula cada fragmento distinto por grupo al mensaje que lo respalda. El guardado sólo acepta citas literales atribuibles a un único mensaje de cliente en esa conversación, hasta el corte inclusive. Una cita ausente o ambigua devuelve `22023` y revierte la evaluación completa. El servicio reutiliza el cálculo existente; la base comprueba los grupos, los puntos permitidos, la suma y la banda.

Las evaluaciones anteriores son inmutables. Para obtener la evaluación más reciente de una oportunidad y versión, ordenar por la `history_position` del mensaje de corte, en orden descendente. Así un guardado tardío sobre un mensaje viejo conserva el historial. Una oportunidad sin evaluación sigue sin score.

Administradores y vendedor actualmente asignado pueden leer las tablas con los permisos del CRM. Sólo la credencial de servicio puede llamar a la RPC de escritura. Esta migración no actualiza asignaciones, estados, cupos ni reportes.

## Resultado de la prueba local

Se reutilizaron los campos de la extracción comercial guardada y se ejecutó el JavaScript original del nodo. El caso de Corolla automático, presupuesto total de USD 20.000 y compra dentro de 15 días dio **50/100, banda media del prototipo**. El desglose fue plazo 20, intención 0, búsqueda 15 y presupuesto 15. Se conservaron tres fragmentos del cliente. El grupo de intención quedó como no informado.

Dos escritores concurrentes obtuvieron el mismo ID. Un nuevo reintento conservó la fecha y las tres citas. Se verificaron el conflicto por contenido distinto, el rechazo de evidencia ajena o posterior, la atomicidad y los permisos.

Desde la raíz, con Node.js, Python, Psycopg 3 y los binarios de PostgreSQL disponibles:

```sh
python supabase/tests/bot-local.py --score-only
```

El comando crea y elimina un clúster local aislado con datos demo. Para la presentación, el cierre por WhatsApp y la entrega del mensaje están comprobados en la integración. El score está comprobado localmente. La aplicación de la migración y la conexión del nodo de guardado en n8n quedan para después de la revisión.
