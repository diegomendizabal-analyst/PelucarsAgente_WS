# Oportunidades: diagnóstico e integración — 27/11/2026

Base verificada: `origin/main` en `b090581`. GitHub confirmó los PR #11 y #12 mergeados el 27/11. Rama separada; carpeta local `wsp/` conservada. No se aplicaron migraciones ni seeds remotos, ni se editaron workflows, hosting, Meta, cuentas o asignaciones remotas.

Fuentes consultadas: código y migraciones, continuidad, decisiones, CRM, conversaciones, score y Reportes; [alcance V3 vigente en Notion](https://app.notion.com/p/422b6a1d71a48103b967c57fbd2ff129) y [modelo backend V2](https://app.notion.com/p/422b6a1d71a4813dbc32ea1a444b6733). Las referencias incluyen propuestas y cortes históricos, no acreditan por sí solas implementación. Notion también contiene R11/R12 y F01 como pendientes; este trabajo prioriza oportunidades.

## Diagnóstico antes del incremento

| Dato | Extracción/recepción | Persistencia existente | Panel anterior / brecha |
|---|---|---|---|
| Nombre y teléfono | Teléfono recibido; nombre de perfil no incluido en RPC | customers; receive_bot_message exige cliente/oportunidad existentes | Nombre/teléfono visibles; faltaba procedencia y llenado seguro del nombre |
| Origen | Conversación, proveedor, demo/whatsapp_bot | leads.source y conversations.provider | No se mostraba; WhatsApp no demuestra anuncio, referido o Google Maps (F01 pendiente) |
| Búsqueda y características | vehiculo_buscado, caracteristicas[] | lead_interests existe, sin escritura del extractor | Ficha lee intereses pero el bot no los completaba |
| Marca/modelo/año/transmisión | El extractor actual sólo entrega texto/características; no claves independientes para estos atributos | Columnas año/transmisión y vehicle_id | Faltaban marca/modelo declarados independientes del vínculo |
| Presupuesto | importe, moneda y alcance | leads admite rangos con moneda obligatoria; el bot no los guarda | Alcance ausente; desconocido no debe ser cero ni moneda inferida |
| Usado | tiene_usado, decision_entrega_usado, usado_detalle | Sólo trade_in_details | Sin distinguir indecisión, negativa y ausencia |
| Plazo/financiación | plazo_compra / necesita_financiacion nullable | Columnas existentes sin escritura del bot | Se mostraban si alguien las cargaba |
| Resumen | resumen_consulta | save_bot_lead_summary protege corte y edición independiente | Visible, pero insuficiente como fuente comercial |
| Estado/responsable/historial | Operaciones CRM | leads, asignaciones, historial automático | Implementados; no cambiar reglas D07 ni repartir nuevos clientes |
| Conversación | RPC de recepción y envío | conversations/messages con orden durable y estado de envío | Placeholder; faltaba lectura paginada |
| Score | Nodo Calcular score | PR #12: save_bot_score, evaluaciones inmutables y citas | Placeholder; lectura debe ordenar por corte y versión, no fecha de guardado |
| Ventas | No existe captura | No existe sales; vendido bloqueado en cambio genérico | Compras y KPI pendientes; requiere decisiones comerciales explícitas |

## Incremento 1: persistencia estructurada

Migración local pendiente `20261127123402_bot_lead_details.sql`. Agrega:

- `leads.budget_scope`: valor_total/dinero_a_agregar/null. `budget_max` conserva el importe declarado como límite superior; no se inventa un mínimo. Permite presupuesto parcial: importe sin moneda o moneda sin importe, sin asignar cero a NULL. No convierte monedas.
- `leads.trade_in_decision`: confirmada/descartada/indecisa/no_informada; NULL para registros históricos sin esa clasificación. `tiene_usado` se valida contra esa decisión, sin duplicar dos fuentes de verdad.
- `lead_interests.requested_brand`, `requested_model`, `characteristics[]`, junto con requested_text, year_min y transmission existentes. La búsqueda del extractor se conserva literalmente; si sólo hay características se unen como presentación y también se conservan como lista. No se interpreta el resumen.
- `customers.provider_profile_name`: procedencia del nombre con el que se completó un nombre vacío. No es identidad verificada. Un nombre del equipo se preserva; al cambiar el nombre se elimina esa procedencia. No actualiza el teléfono ni crea clientes.
- `private.bot_lead_detail_sources`: corte, petición exacta y copias aplicadas para detectar reintentos y ediciones independientes. Sin acceso desde el panel.

### Contrato para el otro chat

POST `/rest/v1/rpc/save_bot_lead_details`, sólo `service_role`:

```json
{
  "p_conversation_id": "UUID de receive_bot_message",
  "p_message_id": "UUID del entrante incluido en la extracción",
  "p_extraction": "objeto output completo de Extraer datos de la consulta",
  "p_attributes": {"marca": "Toyota", "modelo": "Corolla", "anio_minimo": 2020, "transmision": "Automática"},
  "p_provider_profile_name": "nombre de perfil recibido del proveedor, si existe"
}
```

El ejemplo describe valores; los dos UUID deben ser UUID reales y `p_extraction` un objeto, no una cadena. `p_attributes` es opcional (por defecto `{}`), acepta sólo marca/modelo/anio_minimo/transmision explícitos o NULL. El extractor vigente **no entrega estas claves por separado**: el otro chat deberá suministrarlas desde una extracción estructurada revisada, o dejarlas ausentes. No derivarlas del resumen ni inventarlas a partir del catálogo. `p_provider_profile_name` es opcional; debe venir del proveedor, no del modelo.

Respuesta tabular: `lead_id`, `source_message_id`, `outcome` (applied/unchanged/stale). Usar una petición estable al reintentar. `PT409`: contenido distinto para mismo corte o edición independiente; conciliar sin forzar. `22023`: entrada inválida. Restricciones de longitud existentes también rechazan valores excesivos sin escritura parcial.

La RPC reutiliza `save_bot_lead_summary` dentro de la misma transacción: reemplaza su llamada independiente para nuevas extracciones completas. Es compatible con un resumen idéntico ya guardado para ese corte. Un corte viejo no sobrescribe uno nuevo, incluso entre conversaciones de la misma oportunidad. Bloquea la oportunidad; todas las escrituras se confirman juntas. No sobrescribe datos comerciales preexistentes sin procedencia del bot: devuelve conflicto para conciliación explícita. No hay backfill automático.

La búsqueda anterior queda `replaced` cuando cambia; los reintentos no duplican intereses. Marca/modelo sólo se vinculan con coincidencia exacta normalizada de ambos y exactamente una ficha del mismo origen. Sin ambos atributos, con ambigüedad o sólo coincidencia del otro origen: interés sin vínculo. No crea catálogo ni unidades. **Una ficha vinculada no acredita stock ni coincidencia de año, transmisión o presupuesto**. Dinero a agregar no equivale a valor total.

Después del guardado, el otro chat puede llamar a `save_bot_score` con el contrato de [bot-score.md](bot-score.md). No cambiar su versión ni recalcular reglas aquí. Si details devuelve stale, no continuar el turno viejo. No hay cambios al envío ni al máximo de tres mensajes. D07, asignación de clientes nuevos y D08 siguen pendientes.

### Verificación ejecutada

`node --test frontend/scripts/opportunity-intake.test.mjs`: pasa en PostgreSQL WASM aislado. Verifica NULL/false/cero/indecisión, rango y precisión, reintento sin cambio de fecha, corte antiguo, conflicto de mismo corte, edición comercial/manual/resumen/interés, preservación del nombre del equipo, procedencia, conservación de intereses anteriores, modelo ambiguo/incompleto, origen demo/real, bandeja mínima y permisos tras toma/reasignación. No simula concurrencia multisesión.

`node --test frontend/scripts/database-local.test.mjs`: pasa, incluidas migraciones y regresiones existentes de identidad, inventario, CRM, recurrencia y reportes. No usa Supabase remoto.

## Incremento 2: ficha, conversación, score y unidades

Migración local pendiente `20261127123630_opportunity_bot_read_model.sql`:

- `get_current_lead_score(p_lead_id, p_rules_version)`: una evaluación por mayor posición del mensaje de corte dentro de esa versión. Devuelve total, resultado, evidencias y metadatos de corte/guardado. El panel fija explícitamente la versión de #12, sin modificar el cálculo. Lectura validada antes de renderizar; un resultado mal formado produce error, no cero.
- `lead_messages`: vista invoker de mensajes/conversaciones; el panel pagina de a 20, conserva los tres paginadores al navegar y distingue salientes pendientes, en curso, fallidos, inciertos y confirmados. Los no confirmados aparecen primero; el diálogo confirmado se ordena por posición durable descendente. No presenta mensajes reservados como enviados.
- `get_lead_unit_matches(p_lead_id,p_interest_ids)`: compara hasta 20 intereses visibles con unidades disponibles del modelo y del mismo origen. Cada unidad se evalúa entera: año mínimo/máximo, transmisión textual normalizada y presupuesto total en la misma moneda. Cuenta las que cumplen esos criterios, las que no los cumplen y las de evaluación incompleta. Una característica que falla descarta esa unidad; datos desconocidos, moneda diferente o dinero a agregar impiden confirmar presupuesto. Sin tipo de cambio ni tasación de usado. Otras características siguen requiriendo revisión humana.

La ficha muestra origen técnico por separado de procedencia comercial no identificada, nombre de perfil no verificado, presupuesto/alcance, cuatro estados del usado y financiación nullable. El vínculo de marca/modelo se distingue de la comparación de unidades. Score sin evaluación aparece Pendiente; migración ausente y error de consulta son estados separados. No usa credenciales de servicio para leer ni comparte caché entre cuentas. La bandeja de pendientes conserva las cuatro columnas autorizadas.

### Verificación ejecutada del panel

- `node --test frontend/scripts/opportunity-score.test.mjs`: pasa en PostgreSQL WASM aislado. Guardar una evaluación vieja después no cambia la vigente; versiones separadas, citas vinculadas, ausencia sin cero, rechazo de escritura por usuario, admin/responsable/ajeno/deshabilitado/anónimo y pérdida de acceso a score, citas, mensajes y conteos tras reasignación. Comparación sobre la misma unidad, retiro de stock, moneda diferente, precio ausente y dinero a agregar.
- `npm run lint`, `npm run typecheck` y `npm run build` desde frontend: pasan; build vuelve a verificar tipos. Aviso de Node MODULE_TYPELESS_PACKAGE_JSON en las pruebas TypeScript, sin fallo.
- `npm run check:opportunities`: 24 casos en Chrome sin ventana, anchos 1440/768/390/320, estados completo/vacío/cero/error/integración pendiente/cargando. Usa **componentes reales con adaptadores de lectura sintéticos**, CSS y tipografía del proyecto, en un puerto libre propio. Importes y textos largos, ausencia de desborde, foco visible y paginación mediante Enter conservando los otros paginadores. Capturas revisadas visualmente; se corrigió la grilla móvil de datos a una columna para fechas/importes legibles. Artefactos locales en `.pr-work/opportunity-ui/`, fuera de la carpeta que limpia el build.

Límites: la revisión visual aislada no prueba Auth/PostgREST ni hidratación/navegación del servidor Next conectado; no ejecuta mutaciones desde navegador. No se aplicaron migraciones para forzar esa prueba remota. El contrato SQL y RLS se prueban en PostgreSQL; queda una prueba integrada con PostgREST/Next en un entorno autorizado después de aplicar migraciones. No se hizo nueva prueba multisesión ni de carga. La pantalla ya renderizada conserva la limitación previa: debe actualizarse para reflejar una reasignación externa; las nuevas lecturas pierden acceso inmediatamente por RLS.

## Ventas: siguiente incremento condicionado

Confirmado: ventas explícitas, vinculadas con oportunidad, cliente derivado de esa oportunidad, vendedor histórico y unidad; cierre de oportunidad/unidad transaccional; reportes totales y por vendedor, preservando monedas. El estado `sold` de una oportunidad no es una venta contabilizable. No inferir ventas de esa etiqueta ni del precio de lista. No existe `sales` en main ni al terminar este incremento.

El modelo V2 marca como **propuesta** atribuir al responsable al confirmar y exige definir correcciones/anulaciones antes de habilitar. Las fórmulas y fecha comercial de Reportes también figuran como propuestas. Por eso este incremento no habilita una confirmación de venta basada en reglas no aprobadas ni agrega botones simulados.

Decisiones agrupadas para la reunión:

1. Qué hecho confirma una venta frente a reserva; unidad obligatoria o casos sin unidad.
2. Fecha comercial a contabilizar, posibilidad de retroactividad y zona horaria.
3. Precio final, monedas admitidas y tipo de cambio histórico si corresponde; usados y financiación sin inferir cobros, comisiones ni rentabilidad.
4. Vendedor atribuido, excepciones del admin y motivo/auditoría; registrado_por separado del vendedor comercial.
5. Corrección/anulación (D17): permisos, motivo, trazabilidad, efecto en stock y reportes, reventa y reapertura (D19).
6. Validación de fórmulas D18: cantidad, montos separados, ticket, tasa de cierres y mediana a venta. No sumar ARS/USD ni convertir presupuestos en ingresos.

Una vez resuelto: PR de registro de venta con idempotencia y bloqueo de oportunidad/unidad, seguido de PR de compras/reportes con filtros total/vendedor. Mantener el interés original si la venta es de una alternativa. No hace falta el módulo de actividades.
