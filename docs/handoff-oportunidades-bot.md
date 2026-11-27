# Para el chat de n8n — 27/11/2026

Incremento posterior solicitado: [alta automática de catálogo](handoff-catalogo-n8n.md), en otro PR dependiente de D07. Nueva RPC atómica con resolución/evidencia explícitas; no crear unidades ni completar históricos. Las menciones inferiores de “no crea catálogo” describen la RPC anterior, que se conserva compatible.

Actualización posterior: #13/#14/#15 ya integrados en main `2053064`. Para el siguiente incremento funcional leer el [handoff D07](handoff-d07-n8n.md): nueva admisión antes de IA, continuidad por búsqueda, ciclos y pausa fija de 72h. Su migración todavía no está aplicada; no cambiar a esas RPC hasta revisar/aplicar el incremento autorizado. El contrato comercial de este documento se conserva.

PR #13 y #14 siguen abiertos al verificar el 27/11. El usuario ya aplicó las migraciones en Supabase de desarrollo; `00-verificar.sql` devuelve todo true y el panel fue contrastado con PostgREST real. Este chat no aplicó migraciones ni editó workflows.

1. Las dependencias de conversaciones, resumen y score (#12), `20261127123402_bot_lead_details.sql` y `20261127123630_opportunity_bot_read_model.sql` ya están disponibles en desarrollo según la verificación anterior. En otros entornos comprobar su estado antes de operar: no confundir merge con migración aplicada.
2. Tras `receive_bot_message` y extracción, llamar `save_bot_lead_details(p_conversation_id,p_message_id,p_extraction,p_attributes?,p_provider_profile_name?)` con service_role. `p_extraction` es el objeto output original. Esta RPC ya guarda el resumen en la misma transacción.
3. `p_attributes` acepta marca/modelo/anio_minimo/transmision explícitos. El extractor actual no los separa: omitirlos hasta ampliar su esquema de forma revisada. No extraerlos del resumen. Nombre de perfil sólo desde el proveedor; completa nombre vacío sin verificar identidad ni sobrescribir al equipo.
4. Conservar la petición para reintentos. applied/unchanged permiten continuar; stale descarta el turno viejo; PT409 exige conciliación por corte conflictivo/edición independiente. No forzar escrituras ni repetir extracción para cambiar el mismo corte.
5. Guardar score con `save_bot_score` y contrato de #12, versión `pelucars_score_v1_prototipo`. El panel ya prepara la lectura vigente por corte y versión, con evidencias y limitaciones. No se cambió el motor ni se aprobó D08.

La RPC nueva no crea clientes/oportunidades ni asignaciones. D07 y reparto de nuevos clientes siguen pendientes. Ventas permanece pendiente de atribución, confirmación, fecha, precio y anulación/stock. [Contrato completo y decisiones](oportunidades-integracion.md).

La ficha de QA de #14 funciona con datos completos y pendientes. OP-000063 ya devuelve nombre, USD 20.000 total, plazo de 15 días, usado descartado, financiación false, búsqueda Corolla y score 50 con tres citas. Mantener sin vínculo al catálogo: faltan atributos separados en la extracción histórica. Los seis mensajes se conservan en orden por posición. El rediseño no escribe datos ni deriva columnas del resumen; [QA y límites](qa-ficha-oportunidad.md).
