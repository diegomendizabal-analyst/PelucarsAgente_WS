# Pelucars modelo de datos para backend V2

Actualizado el 24 de noviembre de 2026. Modelo alineado con **Alcance y futuro V3**: Reportes administrativo entra en la entrega actual, con ventas, totales y filtro por vendedor; actividades manuales y recontactos pasan a una versión posterior.

Esta V2 distingue el esquema existente en main de las ampliaciones pendientes. Hay **11 tablas de aplicación en 8 migraciones**. Conversaciones, score, ofertas y ventas todavía no están implementados. Reportes se construye sobre datos operativos y su historial; no requiere una tabla que guarde manualmente los KPI.

Corte de código: fa4be36ae90fecd6ae66f30e4ed0df943261a3de, con PR1–PR5 integrados. “Existente” indica código versionado, no comprobación del estado de una base remota. Este documento no ejecuta migraciones ni modifica datos.

# Conceptos y relaciones

| Concepto | Significado |
| --- | --- |
| Cliente | Persona identificada por teléfono; puede tener varias búsquedas. |
| Oportunidad | Búsqueda comercial con responsable, estado, intereses e historial propios. |
| Vehículo de catálogo | Marca/modelo, aunque no haya unidades disponibles. |
| Unidad de inventario | Auto físico concreto, con año, versión, precio y estado. |
| Interés | Lo buscado originalmente; no se reemplaza porque compre una alternativa. |
| Oferta | Alternativa presentada y su respuesta; pendiente de implementar. |
| Venta | Operación confirmada sobre una unidad, con importe y vendedor histórico; pendiente. |
| Evaluación de score | Puntaje completo calculado con reglas de una versión; pendiente. |
| Evidencia | Señal y fragmento del cliente que explica ese puntaje; pendiente. |
| Evento de historial | Asignación o cambio de estado generado por el sistema; ya existe. |
| Actividad | Llamada, reunión, nota o recontacto cargado por el empleado; versión posterior. |

Una Toyota Hilux sin unidades tiene stock disponible cero y precio sin informar. No crear una unidad ficticia. Año, versión, transmisión y precio pertenecen a unidades; preferencias y rangos deseados, al interés.

Relaciones actuales:

- profiles → leads, asignaciones y auditorías.
- customers → leads → lead_interests → vehicles → inventory_units.
- leads → lead_assignments, lead_status_history y lead_notifications.
- vehicles/inventory_units → inventory_events.

Ampliaciones del alcance actual:

- leads → conversations → messages.
- leads → score_evaluations → score_evidence → messages.
- leads → lead_offers y sales → inventory_units.
- lead_assignments y lead_status_history → evaluación vigente en el evento.

No crear tablas de zonas, sucursales, fotografías o actividades en este incremento. La bandeja de pendientes es una consulta sobre oportunidades sin asignar.

# Convenciones y diferencias respecto de V1

UUID para identidades; eventos con timestamptz; visualización en America/Buenos_Aires. Excepción actual: inventory_units.received_at es date. Valores desconocidos se guardan como NULL. Importes numeric(14,2) y moneda ARS/USD; no convertir ni sumar monedas diferentes sin una política explícita.

Estados comerciales: new_inquiry, follow_up, awaiting_stock, lost, sold. En espera de stock está confirmado; mantiene abierta la oportunidad. Sold existe como código pero no puede activarse desde el cambio genérico de estado hasta implementar ventas.

Estados de unidad: available, sold, withdrawn. Retirar o archivar conserva historial. La venta debe ser una operación validada, no un cambio de etiqueta.

| Tema | V2 y código vigente |
| --- | --- |
| Correo del vendedor | Auth guarda correo de acceso; `profiles.contact_email` guarda contacto. No son un único campo. |
| Identidad normalizada de modelo | Índice único sobre marca/modelo normalizados, más search_name generado; no existe normalized_key. |
| Creador del modelo | vehicles.created_by es obligatorio actualmente. La creación desde bot necesita una migración y operación técnica. |
| Atención y ocupación | attention_state y fechas de inicio/liberación todavía no existen. No darlas por implementadas ni deducir disponibilidad solo del estado comercial. |
| Historial de estado | Actualmente comercial; no tiene status_field ni referencia de score. |
| Asignaciones | assignee_id obligatorio y modos intake, manual_claim, admin_assignment, reassignment. |
| Auditorías y avisos | user_admin_events, inventory_events y lead_notifications son parte del esquema real. |
| Reportes | Incluidos ahora, con ventas y filtro por vendedor. |
| Actividades | Diferidas; no hay tabla actual que deba borrarse. |

# Esquema existente

Los campos siguientes describen las migraciones actuales, incluyendo sus alteraciones posteriores. PK indica clave primaria; FK, relación con otra tabla. Los campos opcionales se indican con NULL.

## profiles y user_admin_events

| Tabla | Campos principales |
| --- | --- |
| profiles | id uuid PK/FK auth.users; full_name text requerido; role text admin/seller; contact_phone text NULL; contact_email text NULL; is_enabled boolean; accepts_assignments boolean; created_at y updated_at timestamptz. |
| user_admin_events | id uuid PK; subject_user_id y actor_id uuid FK profiles; action text; changed_fields jsonb; occurred_at timestamptz. |

profiles separa habilitación de cuenta y disponibilidad para asignación. Una cuenta deshabilitada no puede tener accepts_assignments activo. El alta/edición de vendedores exige teléfono y correo de contacto; el constraint añadido con NOT VALID admite registros históricos todavía incompletos, que deben revisarse. No hay contraseñas en profiles.

El rol se modifica mediante operaciones privilegiadas; el panel crea vendedores, no administradores arbitrarios. Las dos cuentas admin definitivas se provisionan mediante alta controlada.

user_admin_events registra bootstrap, created, updated, enabled y disabled. Solo admin lo consulta. No persistir secretos en changed_fields.

## vehicles, inventory_units e inventory_events

| Tabla | Campos actuales |
| --- | --- |
| vehicles | id uuid PK; brand/model text requeridos; search_name text generado; origin admin/intake; needs_review boolean; created_by uuid FK profiles NOT NULL; archived_at timestamptz NULL; created_at/updated_at. |
| inventory_units | id uuid PK; vehicle_id uuid FK; internal_code text; model_year smallint NULL; version/transmission text NULL; transmission_kind generado; mileage_km integer NULL; listed_price numeric(14,2) NULL; currency text NULL; status text; received_at date NULL; created_at/updated_at. |
| inventory_events | id uuid PK; vehicle_id uuid FK; unit_id uuid FK NULL; actor_id uuid FK profiles requerido; action text; changes jsonb; occurred_at timestamptz. |

Unicidad de marca/modelo por índice que normaliza mayúsculas y espacios. El catálogo no guarda precio, moneda ni un booleano stock editable. available_count deriva de unidades available. El archivo del modelo está bloqueado cuando tiene unidades disponibles.

internal_code se genera con secuencia PEL; unicidad normalizada. model_year entre 1000 y 9999; kilometraje no negativo. Precio positivo si está informado; precio y moneda deben estar ambos presentes o ambos ausentes. transmission_kind normaliza manual/automatic/other para filtros.

Los filtros combinados evalúan características sobre una misma unidad: no aceptar año de una unidad y precio de otra para cumplir una búsqueda.

inventory_events guarda vehicle_created, vehicle_updated, vehicle_archived, vehicle_restored, unit_created y unit_updated. Es auditoría técnica de admin; no implica pantalla de historial de precios.

**Ampliación necesaria para el bot:** origin=intake por sí solo no permite crear automáticamente una ficha. Propuesta: permitir created_by NULL exclusivamente para origen técnico intake, mantenerlo requerido para origen admin y adaptar la auditoría para registrar actor técnico/origen sin atribuirlo falsamente a un dueño. La operación técnica debe autenticarse en servidor, normalizar y reutilizar modelos, marcar needs_review y no aceptar actores arbitrarios del cliente. No conceder ese permiso a vendedores. El diseño exacto de auditoría técnica debe cerrarse en la migración del bot.

## customers y leads

| Tabla | Campos actuales |
| --- | --- |
| customers | id uuid PK; full_name text NULL; phone_e164 text requerido UNIQUE; created_at/updated_at. |
| leads | id uuid PK; reference_number integer identity UNIQUE; customer_id uuid FK; assigned_to uuid FK profiles NULL; source text whatsapp_bot/demo; commercial_status text; summary text NULL; budget_min/budget_max numeric(14,2) NULL; budget_currency text NULL; financing_needed boolean NULL; trade_in_details y purchase_timeframe text NULL; waiting_since y closed_at timestamptz NULL; loss_reason text NULL; created_at/updated_at. |

customers no tiene email. El teléfono se valida en formato internacional; nombre puede faltar. Una persona puede tener varias oportunidades, incluso abiertas. La referencia OP es presentación; las operaciones usan UUID.

summary es resumen privado de la necesidad, con máximo 6000 caracteres. No sustituye una tabla de actividades. Datos de financiación, usado, presupuesto y plazo deben reflejar declaraciones, sin inferir valores desconocidos.

Restricciones: presupuesto no negativo y mínimo ≤ máximo; moneda requerida cuando hay importe. Sin responsable exige waiting_since y con responsable lo deja NULL. closed_at existe si y solo si el estado es lost/sold; loss_reason se exige para lost y es NULL en los otros estados.

No hay score editable en leads, ni atención/disponibilidad completa. La proyección de score se añadirá desde evaluaciones.

source distingue datos reales de integración y datos demo. No marcar todo como real por el nombre del cliente. Los reportes de ventas, intereses y score heredan ese filtro desde leads; customers e inventario no tienen su propio marcador demo.

## lead_interests

id uuid PK; lead_id uuid FK requerido; vehicle_id uuid FK NULL; requested_text text requerido; year_min/year_max smallint NULL; requested_version/transmission text NULL; is_primary boolean; status active/replaced; created_at/updated_at.

Un índice único parcial permite como máximo un interés primario activo por oportunidad. Los años deben formar un rango válido. Conservar búsqueda genérica sin inventar modelo. Cuando hay marca/modelo confiables, relacionar el catálogo.

La estructura permite mantener intereses anteriores como replaced. Comprar otra unidad no debe reemplazar el interés original: se registrará en ofertas y venta.

## lead_assignments

id uuid PK; lead_id uuid FK; previous_assignee_id uuid FK NULL; assignee_id uuid FK requerido; actor_id uuid FK NULL; actor_name/previous_assignee_name text NULL; assignee_name text requerido; mode text; reason text NULL; occurred_at timestamptz.

Modos actuales: intake, manual_claim, admin_assignment, reassignment. Los nombres históricos se guardan para interpretar eventos aunque cambie el perfil. actor_id es quien ejecuta; assignee_id es quien recibe. La reasignación administra un lead abierto y registra el motivo.

El trigger de recurrencia busca el responsable de la oportunidad más reciente del cliente y lo conserva si está habilitado. No revisa accepts_assignments ni reparte clientes nuevos. Si no hay responsable o está deshabilitado, deja en cola; no busca indefinidamente un responsable anterior.

La autorización vigente depende de leads.assigned_to, no de haber figurado antes en lead_assignments. La referencia histórica de score se agrega en una ampliación; hoy no existe.

## lead_status_history

id uuid PK; lead_id uuid FK; old_value text NULL; new_value text; actor_id uuid FK NULL; actor_name text NULL; source intake/user; reason text NULL; changed_at timestamptz.

Representa cambios de estado comercial. source indica ingreso o acción de usuario. actor_id no necesariamente es el vendedor al que se atribuye el resultado: un admin puede cerrar una operación ajena.

Hoy no tiene status_field, score_evaluation_id ni responsable histórico explícito del cierre. Esos datos no deben suponerse presentes al programar reportes.

## lead_notifications

id uuid PK; lead_id uuid FK; assignment_id uuid FK UNIQUE; recipient_id uuid FK profiles; created_at timestamptz; read_at timestamptz NULL.

Notificación interna asociada a una asignación. La toma propia no genera aviso redundante. Lectura limitada al destinatario habilitado que sigue siendo responsable; no es un buzón global del admin. Reasignar invalida la exposición de avisos anteriores.

read_at indica lectura del aviso, no contacto con el cliente. No usarlo para KPI de respuesta, reunión o recontacto. La campana hace sondeo; no prueba que la bandeja sea Realtime.

# Consultas y operaciones existentes

| Elemento | Función actual |
| --- | --- |
| vehicle_catalog | Modelo con total de unidades y cantidad disponible. |
| customer_directory | Cantidad de consultas e ingreso más reciente dentro del permiso de lectura. |
| lead_timeline | Unión de asignaciones y cambios de estado; no contiene actividades. |
| list_pending_leads | Proyección mínima: id, reference_number, waiting_since, assignment_state. |
| claim_lead | Toma atómica; verifica usuario habilitado y oportunidad libre, bloquea fila y registra historial. |
| Asignación administrativa | Asigna/reasigna abiertas a usuario habilitado y valida versión esperada. |
| Cambio de estado | Permite estados operativos y pérdida con motivo; rechaza cierre sold y modificaciones de cerradas. |
| Notificaciones | Consulta y marca de lectura autorizadas. |

Las vistas existentes usan security_invoker. Las tablas del CRM tienen RLS; los usuarios autenticados no reciben permisos generales de escritura. Las operaciones validadas usan funciones y controles en servidor/base.

La toma no tiene tope definitivo: la demo permite varias. Falta completar asignación automática inicial, liberación y gestión de capacidad. Concurrencia de cola y capacidad debe serializarse cuando se implemente; una lectura de “libre” sin bloqueo no es suficiente.

El historial inicial se genera mediante triggers. La integración del bot debe coordinarse con ellos para no duplicar asignaciones, estados o avisos.

# Avisos por ingreso de stock incluidos y pendientes

Incorporados al alcance actual el 24/11/2026. Al ingresar una unidad disponible, detectar oportunidades En espera de stock con intereses activos relacionados y generar un aviso interno navegable. La coincidencia se presenta como candidata, no como compatibilidad garantizada. Los criterios de modelo, año, versión, presupuesto y datos desconocidos se definen en D20 del alcance.

## Extensión de datos propuesta

Crear una tabla `stock_alerts` para estos avisos: id uuid PK; inventory_event_id uuid FK inventory_events; inventory_unit_id uuid FK inventory_units; lead_id uuid FK leads; recipient_id uuid FK profiles; match_details jsonb; created_at timestamptz; read_at timestamptz NULL.

UNIQUE(inventory_event_id, lead_id, recipient_id) evita duplicados al procesar nuevamente un mismo ingreso. Validar que evento y unidad correspondan entre sí. match_details conserva los criterios de coincidencia aplicados sin inventar atributos faltantes.

Esta es una propuesta de migración, no una tabla existente. Se separa de lead_notifications porque esa tabla exige assignment_id único y representa avisos de asignación. La campana puede combinar ambos tipos conservando su origen, enlaces y lectura individual.

## Generación y permisos

Propuesta: generar el aviso al crear una unidad disponible o ante una transición real a disponible aprobada como reingreso. Editar precio/descripción sin cambiar disponibilidad no genera otro ingreso. Confirmar en D20 el comportamiento de reingresos.

Guardar el evento y los avisos de forma transaccional o procesar el evento mediante trabajo durable e idempotente; no depender de que alguien abra la ficha del vehículo. Consultar oportunidades actualmente en awaiting_stock, intereses activos y conjunto real/demo correspondiente. Una coincidencia no crea otra oportunidad ni cambia el estado de la existente.

Destinatario propuesto: responsable actual habilitado. Definir con gestión si el admin recibe además avisos o atiende los casos sin responsable habilitado. Aplicar RLS por destinatario y acceso vigente a la oportunidad; una reasignación revoca la lectura al vendedor anterior. El admin conserva acceso al detalle comercial autorizado, sin que eso implique notificar automáticamente a todos los administradores.

Al abrir el aviso, revalidar la oportunidad y disponibilidad de la unidad. Si ya se vendió o retiró, indicarlo; el aviso histórico no asegura stock vigente. No enviar WhatsApp ni correo al cliente como efecto de este aviso. Leerlo no cuenta como contacto comercial.

Pruebas de aceptación: ingreso relacionado genera un aviso; reintento no lo duplica; cambio de precio no dispara otro ingreso; un vendedor no ve oportunidades ajenas; unidad agotada se identifica al abrir; reasignación revoca acceso anterior; datos demo no generan avisos para oportunidades reales.

# Ventas y alternativas incluidas y pendientes

## lead_offers

Propuesta: id uuid PK; lead_id uuid FK; vehicle_id uuid FK requerido; inventory_unit_id uuid FK NULL; offered_by uuid FK profiles; response pending/accepted/rejected; response_note text NULL; offered_at timestamptz; responded_at timestamptz NULL.

Oferta estructurada, independiente de reuniones o llamadas. Si especifica una unidad, debe pertenecer al modelo ofrecido. Una respuesta aceptada no equivale a venta.

## sales

| Campo propuesto | Tipo y regla |
| --- | --- |
| id | uuid PK |
| lead_id | uuid FK leads UNIQUE para el flujo inicial de una venta por oportunidad |
| inventory_unit_id | uuid FK inventory_units UNIQUE para una venta por unidad |
| offer_id | uuid FK lead_offers NULL |
| seller_id | uuid FK profiles requerido; vendedor al que se atribuye el cierre |
| recorded_by | uuid FK profiles requerido; usuario que confirma |
| amount | numeric(14,2) positivo; precio final |
| currency | text ARS/USD requerido |
| sold_at | timestamptz; fecha comercial del cierre |
| created_at | timestamptz; fecha de registro |
| operation_key | text UNIQUE; propuesta para reintentos idempotentes |

No duplicar customer_id: se obtiene desde lead. No usar listed_price como importe final sin confirmación. seller_id y recorded_by pueden diferir cuando un admin registra. Propuesta inicial: atribuir al responsable de la oportunidad al confirmar; cualquier excepción elegida por un admin debe validarse y registrar motivo. La atribución no debe cambiar por una reasignación posterior.

Confirmación transaccional: verificar responsable/admin; bloquear lead y unidad; comprobar lead abierto y unidad disponible; validar oferta si existe; insertar sales; marcar unidad y oportunidad sold; fijar closed_at; agregar historial y auditoría de inventario. El evento de inventario debe identificar la venta, mediante referencia o payload validado. Repetir la misma operación devuelve la venta existente; un conflicto real no deja medio cierre.

Si offer_id existe, debe pertenecer al lead y corresponder a la unidad/modelo vendido con respuesta aceptada. Conservar interés original y alternativas rechazadas.

La fecha sold_at requiere una política explícita sobre carga retroactiva: no anterior a la creación de la oportunidad dentro de este flujo, salvo proceso de migración aprobado. No confundir fecha de carga con fecha comercial.

**Correcciones/anulaciones:** definir operación de admin, motivo, auditoría y tratamiento de stock/reportes antes de habilitarla. El diseño inicial de unicidad contempla una única venta confirmada. Si se aprueba anulación/reventa, adaptar a ventas con estado y unicidad parcial de confirmadas, conservando las anuladas. No implementar esa ampliación implícitamente ni permitir que un cambio libre de estado “devuelva” stock.

## Snapshot del resultado comercial

Agregar a lead_status_history como propuesta:

- score_evaluation_id uuid FK NULL: evaluación conocida al evento.
- responsible_id uuid FK profiles NULL y responsible_name text NULL: responsable comercial en ese momento, separado del actor.
- Para sold, responsible_id debe coincidir con sales.seller_id; para lost, guardar al responsable del cierre.

Agregar score_evaluation_id uuid FK NULL a lead_assignments. Las referencias deben pertenecer al mismo lead.

Datos históricos sin snapshot no se rellenan con el score actual. El responsable histórico solo se reconstruye si la secuencia de asignaciones permite demostrarlo; si no, queda Sin atribución. Mantener NULL y mostrar cobertura. Estas adiciones permiten reportes históricos sin el módulo de actividades.

# Bot y score incluidos y pendientes

## conversations

Propuesta: id uuid PK; lead_id uuid FK; provider text; business_phone_id text; channel text; started_at timestamptz; ended_at timestamptz NULL; bot_state collecting/waiting_assignment/handed_off/stopped; bot_messages_count smallint entre 0 y 3; bot_stop_reason text NULL; handoff_at timestamptz NULL; handed_off_to uuid FK profiles NULL.

Una recepción inicial tiene un máximo de tres respuestas lógicas, incluido el cierre. La finalización describe el bot, no el resultado de la venta ni que el vendedor haya contactado.

bot_stop_reason se completa por la automatización con un motivo controlado, por ejemplo information_collected, message_limit o technical_failure. No exige carga manual del vendedor.

La ventana de siete días y su punto de cómputo siguen pendientes. No crear conversation/lead por cada mensaje ni reutilizar automáticamente toda consulta anterior.

## messages

Propuesta: id uuid PK; conversation_id uuid FK; provider_message_id text NULL; provider/business_phone_id text; direction inbound/outbound; sender_kind customer/bot; message_type text; body text NULL; sent_at/received_at timestamptz NULL; delivery_status text NULL; outbound_dedup_key text NULL UNIQUE; created_at timestamptz.

Unicidad parcial de provider, business_phone_id y provider_message_id cuando esté informado. Un acuse de entrega actualiza el mensaje existente. No crea una nueva oportunidad ni consume otra respuesta del bot.

sender_kind no incluye vendedor: sus mensajes privados no se capturan. message_type distingue eventos de texto/audio/imagen, pero no compromete transcripción ni análisis de medios.

Propuesta de registro durable de envío sobre messages: send_state queued/sending/sent/failed/unknown, attempt_count, next_attempt_at, last_error_code y bot_slot de 1 a 3 para salientes. UNIQUE(conversation_id, bot_slot) y reserva dentro de una transacción. El contador incluye cupos reservados; no se reinicia por reintento ni por mensaje del cliente.

La automatización toma un envío reservado, registra resultado y reconcilia fallos. No mantener una transacción SQL abierta durante una llamada externa. Si el proveedor aceptó el envío pero no llegó respuesta, marcar resultado incierto y reconciliar antes de reintentar: una clave local no garantiza envío exactamente una vez en un proveedor que no soporte idempotencia. Los intentos del mismo mensaje no reservan un nuevo cupo.

Este diseño durable puede implementarse como outbox separado si el motor lo necesita; no crear ambas estructuras con responsabilidades duplicadas.

## score_evaluations

Propuesta: id uuid PK; lead_id uuid FK; score smallint 0–100; rules_version text; rules_snapshot jsonb; evaluated_at timestamptz; evaluated_through_message_id uuid FK messages NULL; extraction_model text NULL.

Una fila es el puntaje completo de un momento. Las reglas viven en código/configuración versionada; rules_snapshot conserva criterios, pesos y límites efectivamente usados. La IA extrae datos/señales y la lógica controlada calcula el total. El mensaje de corte debe pertenecer al lead evaluado.

La última evaluación válida alimenta la ficha. Evaluaciones previas son inmutables. No sumar una evaluación a la anterior ni permitir editar score manualmente desde frontend.

## score_evidence

Propuesta: id uuid PK; evaluation_id uuid FK; message_id uuid FK; signal_code text; quoted_text text; points_applied smallint.

Cada evidencia explica una señal aplicada: por ejemplo, intención de compra próxima y el fragmento que la respalda. El mensaje debe ser del cliente y corresponder al mismo lead. Verificar negaciones y no inventar fragmentos.

UNIQUE(evaluation_id, signal_code) para reglas que puntúan una vez. Si se necesitan múltiples fragmentos por señal, separar evidencia documental de contribución para no sumar puntos dos veces.

**Diferencia práctica:** evaluación = score total 45 bajo reglas v1; evidencias = compra próxima +20 y visita +25. Una evaluación posterior de 60 reemplaza la lectura actual, no produce 105.

Guardar evaluación y evidencias en una transacción. Al asignar/cerrar, enlazar la evaluación conocida en ese momento. Si la asignación precede al cálculo, el snapshot queda NULL: no rellenarlo luego fingiendo que el vendedor ya conocía el score.

## Operación de ingreso

1. Autenticar el origen del webhook y deduplicar mensajes/eventos.
2. Buscar/crear cliente por teléfono normalizado; resolver recepción existente o nueva búsqueda según regla aprobada.
3. Persistir oportunidad y mensaje; aprovechar los triggers existentes sin duplicar historial.
4. Extraer interés y campos conocidos. Reutilizar catálogo o crear ficha técnica autorizada si hay marca/modelo suficientes; para búsqueda genérica, vehicle_id NULL.
5. Calcular y persistir score/evidencias con reglas versionadas.
6. Aplicar recurrencia o reparto/cola según las reglas aprobadas.
7. Reservar respuesta y enviar desde proceso durable, respetando tres mensajes; registrar cierre del bot.
8. Mostrar datos al responsable/admin y continuar contacto privado.

La extracción por IA también necesita control de reintentos: una nueva ejecución sobre el mismo corte de mensajes y reglas no debe producir duplicados semánticos. Usar una clave de evaluación idempotente o restricción equivalente.

No mezclar source=demo con envíos reales. El seed actual solo cubre CRM; no debe gatillar WhatsApp ni correo. Audio no soportado, fallos de proveedor y extracción incompleta deben tener un comportamiento explícito dentro del límite acordado.

# Modelo de reporting

## Alcance y arquitectura

Reportes se calcula en backend/PostgreSQL sobre datos operativos. No crear una tabla reports con valores editables. Empezar con consultas agregadas o RPC; materialización/cache solo cuando mediciones de volumen lo justifiquen.

Operaciones propuestas, todavía inexistentes: get_admin_report y list_admin_report_details. Parámetros validados: período, zona horaria controlada, responsable o Todos/Sin asignar según bloque, conjunto Reales/Demo y código de métrica permitido. Respuesta con filtros aplicados, generated_at, disponibilidad de cada fuente, numeradores/denominadores y cobertura.

Comprobar admin habilitado tanto en servidor como en la función de reporting. RLS de oportunidades permite al vendedor leer lo propio, pero **eso no autoriza la pantalla ni RPC administrativa**, incluso para agregados propios. Evitar funciones SECURITY DEFINER sin comprobación de identidad, search_path fijo y permisos EXECUTE restringidos.

El frontend no debe descargar todos los leads para agregarlos localmente: paginación o límites de API darían totales falsos. Agregar en base, paginar únicamente el detalle y controlar joins que multiplican oportunidades.

## Contrato de métricas y atribución

| Bloque | Filtro de fecha | Atribución por vendedor | Regla clave |
| --- | --- | --- | --- |
| Consultas/clientes de la cohorte | leads.created_at en período | Primer assignee del historial al corte; Sin asignar si no existe | count(distinct lead_id) y count(distinct customer_id) |
| Oportunidades recibidas | lead_assignments.occurred_at en período | assignee_id del evento | Distinguir primera asignación y reasignación; deduplicar por vendedor/lead |
| Cartera y estados abiertos | Situación actual al consultar | leads.assigned_to actual | No simular una foto histórica aplicando solo created_at |
| Pendientes | Situación actual, todas las antigüedades | Sin asignar | closed_at NULL y assigned_to NULL |
| Tiempo de primera asignación | Cohorte de creación; primera asignación hasta el corte | Primer asignado | Mediana de primera asignación menos creación; publicar cobertura y no asignadas |
| Ventas y montos | sales.sold_at en período | sales.seller_id | recorded_by no atribuye la venta |
| Pérdidas y motivos | Evento de cierre perdido en período | responsible_id del cierre | No usar actor_id cuando cerró un admin |
| Tasa de éxito de cierres | Fechas de cierre dentro del período | Vendedor de venta/responsable de pérdida | Ventas/(ventas+pérdidas); si denominador 0, Sin datos |
| Tiempo hasta venta | Ventas del período | sales.seller_id | Mediana de sold_at menos lead.created_at |
| Score actual de una cohorte | Leads creados en período, evaluación al corte | Primer asignado de esa cohorte | Una evaluación por lead; sin evaluar separado |
| Resultado por score al asignar | Cohorte creada en período | Primer asignado, con score de esa asignación | Mostrar abiertas, vendidas, perdidas y Sin score; no atribuye venta final a ese primer vendedor |
| Demanda vigente por modelo | Situación actual o cohorte, según bloque rotulado | Responsable actual para cartera | Intereses activos, count(distinct lead_id); awaiting_stock para espera vigente |

Usar intervalos [inicio, fin) en UTC derivados de fechas locales, incluyendo el día final mediante su siguiente medianoche local. Evitar límites 23:59:59 que pierden fracciones de segundo. Las consultas de una misma respuesta deben compartir snapshot consistente; generated_at no debe usarse para prometer reconstrucción histórica que no se calcula.

Con Todos, contar entidades únicas; no sumar porcentajes ni promediar medianas por vendedor. Un cliente puede aparecer en varios vendedores, y una oportunidad puede recibirse por dos responsables durante el período. Explicar que esos subtotales no siempre son aditivos.

La tasa de éxito de cierres no es conversión de consultas nuevas del mes. Un eventual reporte de conversión de cohorte debe usar las oportunidades de esa cohorte y mostrar cuántas siguen abiertas.

Separar ARS y USD en sumas y promedios. No hay costos, margen, pagos ni documentación fiscal en este modelo: monto vendido no representa ganancia o cobranza.

La demanda por modelo puede repetir una oportunidad en varias categorías; deduplicar dentro de cada modelo. Excluir ventas/perdidas del bloque de espera vigente. Modelo coincidente no acredita una unidad compatible.

## Fuentes pendientes y datos históricos

La disponibilidad debe ser explícita: fuente conectada sin registros → cero/Sin datos; fuente aún no implementada → No disponible; consulta fallida → error visible. Ningún placeholder de ventas o score debe producir un cero ficticio.

Filtrar por leads.source y propagar el criterio a sus relaciones. No inferir demo por nombres ni contar clientes demo en un total real. Incluir perfiles deshabilitados en filtros históricos. Si un admin actuó como responsable/vendedor, permitir identificarlo para que el total sea explicable.

No reconstruir retrospectivamente el score de asignación desde la evaluación más reciente. Tampoco cambiar ventas pasadas al modificar assigned_to. Para registros anteriores a la captura del responsable de cierre, verificar historial o presentar Sin atribución.

Las bandas de score y la comparación entre versiones requieren definición. No mezclar reglas diferentes como si 80 significara necesariamente lo mismo; mostrar versión o agrupar por ella.

La pantalla puede construirse antes de sales y conectar sus tarjetas después. Se considera completa una métrica cuando su fuente, fórmula, permisos, filtros y detalle están validados; crear la tarjeta por sí solo no completa el KPI.

# Seguridad y operaciones pendientes

| Acción o consulta | Vendedor habilitado | Admin habilitado |
| --- | --- | --- |
| Catálogo y unidades | Lectura | ABM autorizado |
| Bandeja pendiente | Referencia OP, espera y Sin asignar | Detalle global autorizado |
| Detalle, chat y score | Solo oportunidades actuales propias | Todas |
| Historial de cliente y compras | Solo relaciones autorizadas | Completo |
| Oportunidades por vehículo | Solo propias, antes de contar y listar | Todas |
| Tomar pendiente | Operación atómica según política | Operación autorizada |
| Reasignar | Sin actualización libre de assigned_to | Operación con motivo/historial |
| Confirmar venta | Solo oportunidad propia y unidad disponible | Puede registrar conservando atribución comercial |
| Reportes y sus consultas agregadas | Sin acceso | Totales y filtro por vendedor |
| Registrar actividades | No disponible en esta entrega | No disponible en esta entrega |

La misma restricción aplica a API, búsquedas, contadores y cualquier canal Realtime futuro. La ficha del vehículo no puede filtrar oportunidades de otros mostrando primero un total global al vendedor.

Crear políticas RLS de nuevas tablas a través de lead autorizado. Evidencias deben validar tanto evaluación como mensaje. Credenciales técnicas se mantienen fuera del navegador; un secreto de servicio no sustituye validar entrada y operaciones del bot.

Al deshabilitar o reasignar, comprobar sesiones previas, consultas posteriores y datos cacheados. La implementación actual tiene controles de lectura; falta verificar el ciclo completo de limpieza visual ante cambios mientras el usuario mantiene la ficha abierta.

# Actividades diferidas y efecto en el modelo

No crear activities, formularios de llamadas/reuniones/notas, programación, recordatorios ni contadores de recontacto en este incremento. El diseño anterior queda como referencia futura, no como migración pendiente de esta entrega.

Se conservan customers, historial de oportunidades, asignaciones, cambios de estado, resumen de recepción y futuras compras registradas. Esos datos no necesitan que el empleado registre una actividad.

Cuando se incorpore el módulo futuro, una actividad completada de contacto podrá contar como intento y su resultado distinguir contacto efectivo. Una nota, programación, apertura de ficha o notificación leída no prueban contacto. Hasta entonces no prometer estos KPI ni sustituirlos por aproximaciones.

La llegada de una Hilux debe generar un aviso interno para las oportunidades En espera de stock relacionadas, según los criterios aprobados. El vendedor revisa la unidad y contacta por su teléfono. El aviso no requiere actividades: en esta entrega no queda un registro manual del llamado; sí puede cambiar En espera de stock a En seguimiento cuando corresponda.

# Migraciones y orden de implementación

## Migraciones existentes

1. 20261119144830_identity.sql
2. 20261119154713_seller_contact_details.sql
3. 20261119162242_vehicle_inventory.sql
4. 20261120121950_inventory_codes_and_filters.sql
5. 20261120132113_inventory_price_filters.sql
6. 20261120141656_customers_and_opportunities.sql
7. 20261120150439_crm_demo_source.sql
8. 20261120153034_crm_recurrence_and_notifications.sql

No reescribir migraciones aplicadas ni volver a ejecutarlas a ciegas. Añadir cambios incrementales después de revisar el estado del entorno correspondiente.

## Paquetes siguientes

| Paquete | Cambios | Dependencias |
| --- | --- | --- |
| Reportes base | Consultas administrativas, filtros, metadatos y pantalla de inicio | Tablas CRM existentes; validar fórmulas |
| Ventas | sales, lead_offers, cierre atómico, historial de compras y atribución de resultado | Política de correcciones y permisos |
| Bot y score | conversations, messages/envíos durables, score_evaluations, score_evidence | Proveedor, preguntas, score y nueva búsqueda |
| Snapshots | Referencias de score en asignaciones/cierres y responsable histórico en cierre | Tablas de score; pueden empezar NULL |
| Catálogo desde bot | Creador/auditoría técnica y operación normalizada | Regla de modelos ambiguos |
| Asignación completa | Capacidad/disponibilidad y reparto de nuevas consultas | D01/D02/D03/D09 |
| Reportes completos | Conectar ventas y score; validación total/por vendedor | Sus fuentes implementadas |

Ventana de trabajo actual: Reportes y bot. El orden de ventas respecto de la pantalla es flexible; no implica excluir ventas del producto. Si ventas se implementa antes que score, su transacción funciona sin esa referencia y la migración posterior la añade nullable.

Índices existentes relevantes: unicidad de teléfono/modelo/código; leads por cliente reciente, asignado y espera; intereses por lead/modelo y primario activo; asignaciones y estados por lead/fecha; unidades por modelo/estado.

Índices a evaluar con las nuevas consultas: leads(source,created_at), asignaciones por assignee_id/occurred_at, sales(sold_at,seller_id), conversaciones por lead/started_at, mensajes por conversación/fecha, evaluaciones por lead/evaluated_at, evidencias por evaluation_id y unicidades de mensajes/envíos/ventas. Ajustarlos con planes de ejecución; no añadir índices duplicados por seguir una lista.

Las referencias de oferta/venta y evidencia/mensaje requieren validación de pertenencia al mismo lead/modelo mediante FK compuestas u operaciones transaccionales. El borrado físico no debe romper historial; usar RESTRICT, deshabilitación y archivado.

# Validación requerida

Estas comprobaciones son criterios para las próximas implementaciones, no pruebas ejecutadas por actualizar este documento.

- [ ]  Admin entra a Reportes; vendedor a Oportunidades y recibe rechazo al consultar Reportes por URL/RPC.
- [ ]  Filtros de vendedor, fechas y Reales/Demo se aplican a todas las tarjetas y detalles.
- [ ]  Vendedor deshabilitado sigue apareciendo en resultados históricos y no recibe nuevas asignaciones.
- [ ]  Reasignación no cambia vendedor histórico de venta ni score de primera asignación.
- [ ]  Conteos no se multiplican al unir varios intereses, asignaciones o evidencias.
- [ ]  Primera asignación excluye reasignaciones del tiempo inicial; no asignados aparecen en cobertura.
- [ ]  Pendientes antiguos siguen en la tarjeta actual aunque el período seleccionado sea corto.
- [ ]  Límites de fecha local, cero, NULL, división por cero y fuente pendiente producen estados correctos.
- [ ]  ARS y USD permanecen separados; importe final no se reemplaza por precio de catálogo.
- [ ]  Dos solicitudes sobre la misma unidad producen una sola venta, sin cierre parcial.
- [ ]  Venta alternativa conserva búsqueda original y solo descuenta la unidad vendida.
- [ ]  Evidencia y evaluación no aceptan mensajes de otra oportunidad ni fragmentos inventados.
- [ ]  Webhook duplicado no duplica cliente, mensaje, lead, evaluación ni respuesta lógica.
- [ ]  Mensajes concurrentes y reintentos no reservan más de tres respuestas del bot.
- [ ]  Fallo incierto de envío se reconcilia sin reenvío ciego.
- [ ]  Modelo inexistente se crea una vez bajo concurrencia; búsqueda genérica no crea catálogo ficticio.
- [ ]  Score/conversación de pendientes o ajenos no aparecen en API, catálogo, clientes ni eventos.
- [ ]  Avisos leídos y cambios de estado no incrementan un contador de contactos.
- [ ]  Seed demo permanece aislado y no dispara proveedores reales.

El seed actual documenta 5 clientes ficticios, 7 oportunidades e intereses, historiales y avisos; no contiene un recorrido completo de venta/bot/score. Extender datos de prueba cuando se implemente cada módulo, preservando cuentas, inventario y registros ajenos a la muestra. No reiniciar el seed automáticamente al iniciar una tarea.

Las pruebas reportadas en PR3–PR5 no cubren módulos aún inexistentes ni equivalen a una validación de producción.

# Decisiones y fuentes

Bloqueantes del bot: disponibilidad/liberación/capacidad, política de cola al liberarse un vendedor, cuestionario y score, y regla de nueva búsqueda/siete días. Bloqueantes de ventas: atribución comercial y tratamiento de correcciones/anulaciones. Reportes necesita validar las fórmulas propuestas y distinguir período de situación actual.

Catálogo/importación/API siguen pendientes de reunión. La separación modelo/unidad, el nombre En espera de stock, la reasignación administrativa y el paso de actividades a futuro ya están definidos. No reabrir esas decisiones como si fueran dudas nuevas.

Fuentes:

- [Código revisado](https://github.com/diegomendizabal-analyst/PelucarsAgente_WS/tree/fa4be36ae90fecd6ae66f30e4ed0df943261a3de).
- [Migraciones reales](https://github.com/diegomendizabal-analyst/PelucarsAgente_WS/tree/fa4be36ae90fecd6ae66f30e4ed0df943261a3de/supabase/migrations).
- [CRM y límites actuales](https://github.com/diegomendizabal-analyst/PelucarsAgente_WS/blob/fa4be36ae90fecd6ae66f30e4ed0df943261a3de/docs/crm.md).
- [Continuidad anterior que debe actualizarse](https://github.com/diegomendizabal-analyst/PelucarsAgente_WS/blob/fa4be36ae90fecd6ae66f30e4ed0df943261a3de/docs/continuidad.md).
- Modelo backend V1 y Alcance V2 adjuntos, corregidos por las decisiones del 24/11/2026 y el código integrado.

Esta V2 es una guía incremental: conservar lo implementado, añadir lo pendiente mediante migraciones nuevas y no construir actividades como parte del próximo incremento.