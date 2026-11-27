# Para el chat de n8n — 27/11/2026

Preparado en ramas/PR para revisión; **no aplicado remotamente**. No se editó ningún workflow.

1. Verificar/aplicar en el trabajo autorizado las dependencias de conversaciones, resumen y score (#12), luego `20261127123402_bot_lead_details.sql` y `20261127123630_opportunity_bot_read_model.sql`. No confundir merge con migración aplicada.
2. Tras `receive_bot_message` y extracción, llamar `save_bot_lead_details(p_conversation_id,p_message_id,p_extraction,p_attributes?,p_provider_profile_name?)` con service_role. `p_extraction` es el objeto output original. Esta RPC ya guarda el resumen en la misma transacción.
3. `p_attributes` acepta marca/modelo/anio_minimo/transmision explícitos. El extractor actual no los separa: omitirlos hasta ampliar su esquema de forma revisada. No extraerlos del resumen. Nombre de perfil sólo desde el proveedor; completa nombre vacío sin verificar identidad ni sobrescribir al equipo.
4. Conservar la petición para reintentos. applied/unchanged permiten continuar; stale descarta el turno viejo; PT409 exige conciliación por corte conflictivo/edición independiente. No forzar escrituras ni repetir extracción para cambiar el mismo corte.
5. Guardar score con `save_bot_score` y contrato de #12, versión `pelucars_score_v1_prototipo`. El panel ya prepara la lectura vigente por corte y versión, con evidencias y limitaciones. No se cambió el motor ni se aprobó D08.

La RPC nueva no crea clientes/oportunidades ni asignaciones. D07 y reparto de nuevos clientes siguen pendientes. Ventas permanece pendiente de atribución, confirmación, fecha, precio y anulación/stock. [Contrato completo y decisiones](oportunidades-integracion.md).
