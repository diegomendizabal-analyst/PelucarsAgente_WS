# Clientes y oportunidades — primera etapa conectada

Actualización 24/11: Reportes es el inicio del admin y la bandeja se trasladó a `/oportunidades`. La ficha de vehículo lista oportunidades con intereses activos, propias para vendedor y todas para admin, con RLS antes de contar/paginar. Resumen de la consulta reemplaza el rótulo Nota. Actividades, agenda y contadores de recontacto son posteriores; se conserva el historial automático. Compras y score mantienen su integración pendiente. Estado y validaciones actuales en [reportes.md](reportes.md); los apartados siguientes describen la entrega CRM anterior.

Rama `backend-clientes-oportunidades`, iniciada desde `main` tras el merge del PR #4. Migración `20261120141656_customers_and_opportunities.sql`, aplicada en Supabase el 20/11/2026. El ingreso de consultas sigue pendiente. Posteriormente se autorizó una carga explícita de [datos de prueba persistentes](pruebas-crm.md), separada de las migraciones y del alta manual desde la interfaz.

## Alcance implementado

- `customers`: nombre opcional, teléfono E.164 único y fechas. Un cliente puede tener varias oportunidades; no tiene responsable global.
- `leads`: cliente, responsable actual, origen `whatsapp_bot` o `demo`, estado comercial, resumen, presupuesto y moneda, financiación, usado ofrecido, plazo, espera, cierre y motivo de pérdida. El estado de atención/capacidad del vendedor todavía no se automatiza.
- `lead_interests`: texto original, modelo opcional, características e intereses anteriores. Sólo un interés principal activo por oportunidad.
- `lead_assignments` y `lead_status_history`: eventos de ingreso, toma, asignación/reasignación y cambio de estado. Conservan nombres de participantes como referencia histórica; el acceso se decide siempre por el responsable actual.
- `customer_directory` y `lead_timeline`: vistas con seguridad del invocador. Los agregados e historiales respetan RLS.

No se crearon tablas de conversaciones, mensajes, score, actividades, ofertas ni ventas en este incremento. Tampoco se incorporaron alta manual de clientes/consultas, webhook o flujos de n8n. La recepción del bot deberá crear cliente/oportunidad con operaciones técnicas validadas; no hay una API pública de ingreso ni permisos de inserción para las cuentas del panel.

## Permisos y operaciones

El vendedor habilitado ve solamente oportunidades que tiene asignadas y clientes con alguna oportunidad propia. Si comparte cliente con otro vendedor, el historial y los contadores excluyen consultas ajenas. Administradores ven el conjunto completo. Las tablas no admiten escrituras directas de `authenticated` y carecen de lectura anónima.

`list_pending_leads` devuelve `id` (UUID técnico para la acción), `reference_number` (identificador visible `OP-000123`), `waiting_since` y `assignment_state` (`Sin asignar`). Siguen siendo tres datos visibles: referencia, ingreso/espera y Sin asignar. No recibe nombre, teléfono, interés, estado comercial, score ni resumen. La cola se ordena por ingreso y un identificador de desempate, sin filtros de intención. La referencia es única y estable, usa una secuencia con posibles saltos y no se reinicia al borrar las muestras.

La migración `20261120153034_crm_recurrence_and_notifications.sql` incorpora continuidad al insertar una consulta sin responsable: bloquea el cliente y toma al responsable actual de la consulta más reciente (`created_at DESC, id DESC`) si sigue habilitado, sin considerar `accepts_assignments`. Si no hay histórico, está sin asignar o su responsable está deshabilitado, permanece en espera. No distribuye clientes nuevos ni decide cuándo una conversación debe generar otra consulta. Las asignaciones explícitas se conservan.

`lead_notifications` registra el evento de asignación y su destinatario. RLS exige cuenta habilitada, destinatario autenticado y responsable actual de la oportunidad, incluso para administradores. La reasignación cierra avisos previos y registra el nuevo; una toma propia no genera un aviso extra. `read_lead_notification` marca únicamente un aviso propio vigente y devuelve la ficha autorizada. La campana consulta `/api/notificaciones` cada 45 segundos con pestaña visible, al recuperar foco y al navegar; no bloquea el render de la pantalla. Presenta hasta 10 pendientes con contador total y acceso a Mis oportunidades. No hay email, WhatsApp ni push del navegador.

`claim_lead` bloquea la oportunidad, revalida al actor habilitado, comprueba que sigue abierta y sin responsable, asigna y registra el evento en una transacción. Se permite **toma voluntaria sin tope provisional para la demo**, según confirmación del usuario el 20/11. No consulta ni cambia `accepts_assignments`. El límite definitivo y la disponibilidad quedan pendientes para producción. El detalle se abre después de confirmar la toma; un segundo intento sobre una oportunidad ya tomada se rechaza.

`assign_lead` es exclusivo de administradores. Admite responsables habilitados, vendedores o administradores. Reasignar exige motivo y una versión `updated_at` vigente. El anterior pierde acceso por RLS y el nuevo obtiene el historial existente. No existe devolución a la bandeja desde esta interfaz.

`set_lead_status` permite al responsable actual/admin cambiar entre Nueva consulta, En seguimiento, En espera de stock y Perdido. Perdido exige motivo y fecha de cierre. En espera de stock no cierra la consulta. Vendido requiere el futuro módulo de ventas y no puede elegirse aquí. Oportunidades cerradas no se reabren ni reasignan mediante estas operaciones hasta definir las reglas correspondientes. Los cambios no modifican disponibilidad del vendedor ni stock.

Las implementaciones privilegiadas se encuentran en `private`, con `search_path` vacío, validación del actor y concesiones explícitas; las RPC públicas son wrappers invoker. No se usa una clave secreta en las acciones del panel.

## Recorrido visual

- `/oportunidades`: **En espera**, **Mis oportunidades** y, para admin, **Todas las oportunidades**. El vendedor recibe la proyección mínima; el admin puede abrir el detalle de pendientes y asignar un responsable. Los listados se paginan de a 20.
- `/oportunidades/[id]`: datos de cliente/necesidad, interés, gestión, historial cronológico de estados/asignaciones. Conversación, score y actividades muestran su estado pendiente de integración, sin inventar valores.
- `/clientes`: búsqueda por nombre o teléfono dentro del alcance autorizado.
- `/clientes/[id]`: consultas accesibles del mismo cliente. Recontactos/compras quedan señalados como siguientes etapas, no como contadores en cero.
- Las antiguas vistas previas redirigen a los listados reales. Las URLs de ejemplos ya no entregan fichas ficticias. Los archivos de muestras anteriores permanecen fuera del recorrido activo.

Las consultas no comparten caché de datos entre usuarios. Las acciones invalidan las rutas del panel y los enlaces de detalle evitan precarga. Hay botón **Actualizar**; aún no hay suscripción en tiempo real ni actualización automática de una pestaña que permanece abierta mientras otro administrador reasigna. La base impide nuevas lecturas/escrituras del responsable anterior desde que se confirma la reasignación; una pantalla que ya se había renderizado debe actualizarse para reflejarla.

## Verificación

- Lint, chequeo de tipos y build. Pruebas de validación de estados y asignaciones con `npm run test:crm`.
- `TestCrmRecurrence`: selección del responsable más reciente aunque esté ocupado, excepción por deshabilitación, referencias únicas, aviso al destinatario, lectura y pérdida de acceso tras reasignar; rollback completo.
- `TestCrmSeed`: reinicio e idempotencia dentro de una transacción revertida, con comprobación de inventario y perfiles intactos. El reinicio persistente se ejecuta sólo mediante `ResetCrmDemo`.
- `scripts/supabase-admin.ps1 -Action TestCrm`: pruebas SQL con rollback de proyección exacta, RLS, permisos por oportunidad, contadores, toma sin tope demo, doble toma, estados, rechazo de escritura directa, concurrencia optimista, reasignación y deshabilitación. No quedan clientes, consultas ni identidades de prueba. La exclusión de tomas simultáneas usa bloqueo de fila; no se ejecutó una prueba de carga con conexiones concurrentes.
- `npm run check:ui -- http://127.0.0.1:3101 --crm`: revisión del acceso admin, navegación, búsqueda/filtros, filas y fichas existentes en escritorio/móvil. No modifica cuentas ni registros. Las mutaciones se validan por SQL; el recorrido visual usa las muestras persistentes cuando están cargadas.
- Advisors conserva únicamente la observación previa de protección de contraseñas filtradas en Auth.

Antes de integrar el bot deben cerrarse preguntas/score, cuándo se genera una consulta recurrente (D07) y asignación de clientes nuevos. La selección del responsable recurrente quedó definida e implementada. El widget de cotización mantiene su definición pendiente con el cliente.
