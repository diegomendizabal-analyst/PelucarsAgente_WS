# Decisiones vigentes — Pelucars

Actualización posterior al ensayo del 27/11: #13/#14/#15 integrados. D07 aprobada por el responsable del proyecto en alcance V4/backend V3, implementada en #17 y adaptada en #19. La pausa fija de 72 horas sustituye la propuesta de siete días. El operador aplicó la migración en desarrollo y el ensayo remoto pasó; [contraste independiente de QA/PostgREST y ejecuciones](qa-d07.md). Workflow nuevamente apagado y sin publicar. Este control sólo leyó datos; no aplicó SQL ni envió mensajes. D08 conserva los pendientes comerciales de score indicados más abajo; no se cambiaron sus reglas.
Actualizado el 24/11/2026. Fuentes vigentes: [alcance V3](referencias/alcance-v3-2026-11-24.md) y [modelo backend V2](referencias/modelo-backend-v2-2026-11-24.md), conservados tal como se recibieron. Las decisiones confirmadas en esta sesión prevalecen sobre sus propuestas. El estado de implementación de Reportes está en [reportes.md](reportes.md).

El [registro anterior](historico/decisiones-2026-11-18.md) es histórico: sus identificadores D01–D19 no equivalen a los del alcance V2. El [modelo vigente](modelo-de-datos.md) sustituye el diseño inicial.

## Acuerdos posteriores del 27/11 — D16, D20 y D08 parcial

Ver [registro completo para Codex y n8n](acuerdos-catalogo-stock-preguntas.md). Aprobados por el responsable del proyecto; no se atribuye aprobación comercial a Pelucars. D16 permite interpretar modelos y errores y crear fichas faltantes sin unidades/precio; D20 mantiene estado manual y aviso único por oportunidad/unidad a responsable y administrador; D08 fija el orden de preguntas, sin aprobar nuevos pesos del score. Implementación ampliada pendiente. Las referencias anteriores de este documento conservan su fecha de corte.

## Confirmado

- Una sucursal; V1 no necesita zonas ni sucursales en el modelo.
- Supabase Auth para correo/contraseña, perfiles y roles admin/seller. Dos administradores individuales previstos, sin límite definido de vendedores.
- Demo inicial: un administrador y un vendedor, con correos de prueba aprobados. Los vendedores se crean desde el sistema; no hay registro público.
- Contacto del vendedor: teléfono internacional y correo de contacto obligatorios desde ahora en alta y edición, incluida la demo (confirmado el 19/11). Correo de contacto separado del de acceso, personal o laboral, sin exigencia de casilla corporativa. Las cuentas anteriores conservan sus datos; deben completarse al editar. No cambiar sus accesos ni rellenar valores ficticios.
- Administradores ven todo. Vendedores acceden al detalle sólo de sus oportunidades actuales; el permiso se aplica a mensajes, score, evidencia, relaciones y contadores.
- D05 confirmado el 20/11: en la bandeja de espera, el vendedor ve únicamente identificador de consulta, fecha/hora de ingreso y tiempo de espera, e indicación operativa **Sin asignar**. Se ofrece la acción **Tomar oportunidad**. El nombre del cliente y el detalle se habilitan después de asignarse, sólo para su responsable y administradores.
- La bandeja del vendedor no revela teléfono, vehículo/interés, stock relacionado, presupuesto, financiación, urgencia, score, conversación, evidencias, resumen ni historial de compras. Tampoco muestra estados comerciales como **En espera de stock**. La restricción alcanza respuestas de servidor, búsquedas, filtros, ordenamientos y eventos; no basta con ocultar columnas. Administradores mantienen el acceso completo. Implementada en la primera etapa de [clientes y oportunidades](crm.md).
- Toma voluntaria: **sin tope provisional para la demo**, confirmado por el usuario el 20/11. No define el límite de producción ni modifica disponibilidad/asignación automática. La toma y el historial son atómicos; una oportunidad ya tomada no se puede volver a tomar.
- Recurrencia (D04, confirmado el 20/11): usar al responsable actual de la consulta más reciente, ordenada por ingreso y UUID como desempate, incluso si está ocupado. Si está deshabilitado o la consulta más reciente no tiene responsable, volver a la bandeja; no buscar un responsable más antiguo. Implementado al insertar una nueva consulta sin asignación explícita. D07 conserva este comportamiento al resolver una nueva oportunidad y agrega continuidad por búsqueda/ciclos, sin reparto nuevo.
- Avisos internos de asignación implementados el 20/11: campana para el destinatario actual, revisión cada 45 segundos con pestaña visible y al recuperar foco, marcado como leído al abrir. Incluye recurrencia y reasignación; la toma propia no genera aviso redundante. No envía correo ni WhatsApp.
- Asignación manual y reasignación administrativa incluidas (D11). El responsable nuevo obtiene el detalle existente; el anterior pierde acceso (D06).
- El vendedor toma el teléfono del panel y contacta desde su teléfono particular (D09). No se promete traslado técnico ni captura del chat privado.
- Actividades manuales, llamadas, reuniones, notas de seguimiento, agenda y contadores de recontacto pasan a una versión posterior (24/11, sustituye D10). Se conserva el historial automático de estados y asignaciones.
- Reportes exclusivo de admin, como inicio del admin; Oportunidades como inicio del vendedor. Ventas y score siguen incluidos en el producto, sin implementar sus módulos en este incremento.
- D18 parcialmente cerrado el 24/11: consultas al primer asignado, asignaciones al receptor y cartera al responsable actual. Período inicial de 30 días inclusivos. Datos reales por defecto en entrega; durante la demo rige la decisión posterior de muestras inicialmente visibles. Fórmulas en reportes.md. Bandas de score, venta/corrección y pérdidas individuales no se dan por resueltas.
- Ampliación del 24/11: filtros automáticos, sliders precio/año con ingreso exacto e interruptor global temporal muestras/vacío, inicialmente encendido. Herramienta del equipo; el cliente no conservará muestras ni selector. Retirar datos demo por completo al cerrar la demo, con purga revisada pendiente. Sin mezcla con reales. Ver [demo-temporal.md](demo-temporal.md).
- Autorización posterior expresa «Sí, actualizar y cargar la demo»: aplicadas tres migraciones de Reportes/rangos/origen y carga adicional sin resetear seed ni alterar registros/cuentas existentes. Sustituye la prohibición inicial de despliegue SQL sólo para este incremento.
- Pendientes adicionales autorizados el 24/11: enlaces Volver reconocibles, interés sin recuadro anidado, paginado innecesario oculto, rótulo Resumen de la consulta y oportunidades por vehículo con acceso por responsable/admin.
- Cinco estados: Nueva consulta, En seguimiento, Vendido, Perdido y En espera de stock. Este último nombre ya está definido (D14).
- Ventas registradas explícitamente por responsable/admin, con actualización transaccional de la unidad vendida. El administrador gestiona inventario (D17).
- El catálogo reside en Supabase. Acuerdo posterior del 27/11 (D16): el bot puede asociar y crear fichas de marca/modelo sin unidades, stock ni precio; implementación ampliada pendiente. Esto no habilita cotizaciones, recomendaciones ni promesas de disponibilidad por WhatsApp.
- Separación confirmada el 19/11: ficha por marca/modelo; versión, año, precio y características en cada unidad física. El stock disponible se calcula por unidades, no se edita como cantidad. Datos desconocidos opcionales.
- Revisión del 20/11: el código interno de unidad se genera en la base (`PEL-<número>`) y no se ingresa ni se modifica en los formularios. Los códigos existentes se conservan. La secuencia puede tener saltos; no representa cantidad de stock. La referencia del sistema externo será independiente y sigue pendiente de definición.
- Búsqueda del 20/11: marca/modelo al escribir con pausa de 300 ms; stock, catálogo, año y transmisión al cambiar. Año/transmisión y, cuando se pide, disponibilidad deben coincidir en la misma unidad. No se cruzan características de autos diferentes. La búsqueda se realiza en la base antes de paginar.
- Rango de precios: mínimo/máximo inclusivos y opcionales, se exige ARS o USD para límites. El 24/11 el usuario amplió la búsqueda a **presupuesto en ambas monedas** y confirmó usar siempre **Venta oficial por ahora**. ARS incluye precios ARS y equivalentes USD; USD incluye precios USD y equivalentes ARS. Mismo filtro de año/transmisión/stock por unidad, antes de paginar. Precio original intacto, equivalente y tasa visibles; sin cotización se informa fallo, sin resultados parciales silenciosos. Sustituye el filtro del 20/11 limitado a moneda original. Desconocidos no cuentan como cero. Ver [inventario-presupuesto.md](inventario-presupuesto.md).
- Primera implementación de inventario: admin crea/edita y da de baja/restaura fichas sin unidades disponibles; retira o vuelve a disponer unidades. Vendedor consulta. Marcar vendido requiere el futuro módulo comercial y no está habilitado en inventario.
- Se conserva el interés original aunque la venta sea de una alternativa. La llegada de stock no reabre ni contacta automáticamente.
- Fotografías y chat privado del vendedor fuera del alcance actual. Reportes administrativo entra ahora; sustituye la exclusión anterior de dashboards.

## Primera implementación autorizada

### Widget USD/ARS implementado; referencia provisional

El usuario eligió **DolarAPI oficial, compra y venta**, provisional y sujeto a conversación con cliente. Implementado como control compacto en la barra superior, con nombre, fecha y actualización automática cada 5 minutos con pestaña visible. Servidor autenticado, caché de 5 minutos y timeout de 6 segundos; sin valores ficticios ante fallo. Conserva último valor/fecha con aviso si falla. Configurable mediante `DOLAR_API_CASA` (oficial/blue). Ver [demo-temporal.md](demo-temporal.md).

- Confirmar con cliente referencia definitiva y uso comercial. Actualización manual implementada: vuelve a consultar al proveedor. El usuario confirmó «Sí, calculadora informativa» el 24/11: implementada ARS ↔ USD dentro del widget, eligiendo explícitamente Compra/Venta y mostrando tasa usada, sin cambiar precios ni totales. Fórmulas y pruebas en demo-temporal.md.
- Fuente conectada: [DolarAPI, endpoint de dólares](https://dolarapi.com/docs/argentina/operations/get-dolares), campos compra, venta, casa y fechaActualizacion.
- Mantener importe y moneda originales del vehículo. Una equivalencia informativa debe indicar la cotización usada y no sobrescribir precios. Si se habilita ajuste manual, definir permisos administrativos y auditoría. Las ventas futuras necesitan conservar su tipo de cambio acordado, no recalcularse con el valor del día.

### Alcance conectado

Login/logout, perfiles, habilitación, auditoría y alta/edición básica de vendedores. Después del merge del PR #3 se conectó catálogo/inventario. Tras el merge del PR #4 se autorizó y conectó la primera etapa de clientes/oportunidades en `backend-clientes-oportunidades`: bandejas reales, toma, asignación y estados con historial. El 20/11 se autorizó cargar [datos de prueba persistentes](pruebas-crm.md) para probar sin bot. El alta manual desde el panel sigue pendiente: el usuario pidió revisar su inclusión en el alcance antes de implementarla. Ingreso desde el bot, actividades y ventas permanecen pendientes; ver [crm.md](crm.md).

El rol y la habilitación no dependen de metadata editable. El usuario sin perfil completo queda sin acceso. La gestión visible crea únicamente vendedores; las cuentas admin se incorporan mediante procedimiento controlado. La separación entre habilitación y disponibilidad está modelada, con disponibilidad inicialmente false y sin automatización.

El alta de Auth y la inserción de perfil no son una sola transacción. Un fallo intermedio requiere conciliación; no se borra ni reintenta indiscriminadamente una identidad existente. Auditoría nunca almacena contraseñas/tokens. Ver [autenticacion.md](autenticacion.md) para configuración, migración y verificaciones.

## Pendientes del alcance actualizado

| ID V2 | Decisión pendiente | Tratamiento actual |
| --- | --- | --- |
| D01 | Cuándo se libera un vendedor | No deducir disponibilidad del estado comercial. |
| D02 | Capacidad de toma voluntaria en producción | Demo sin tope provisional autorizado el 20/11; regla definitiva pendiente. |
| D03 | Quién cambia disponibilidad | Separada de cuenta habilitada; sin control operativo implementado. |
| D07 | Continuidad por búsqueda y pausa fija de 72 horas | Aprobada por el responsable del proyecto el 27/11; backend #17 y adaptación #19, ensayo remoto de desarrollo contrastado en QA. Pendientes revisión e integración de PR; no habilita producción. |
| D08 | Orden de preguntas aprobado; score parcialmente pendiente | Vehículo → presupuesto/alcance → usado → plazo → financiación; sólo faltantes y máximo tres respuestas incluido cierre. Motor del prototipo implementado. Criterios/pesos/bandas/momento pendientes de aprobación comercial. Ver acuerdos del 27/11. |
| D09 | Cola al liberarse un vendedor | El cuerpo dice asignar el más antiguo al liberarse; la conclusión habla de toma voluntaria si no hubo libres. Confirmar si la segunda limita también el drenaje posterior. |
| D12 | Correos a otros vendedores por pendientes | No incluir sin acuerdo. El correo al asignado es parte del alcance futuro de asignaciones. |
| D13 | Carga inicial e integración externa | Reunión pendiente; sin importación ni sincronización implícita. |
| D15 | Devolver oportunidades tras conocer score | Reasignación administrativa como mecanismo confirmado; no agregar devolución automática. |
| D16 | Interpretación y creación del catálogo aprobadas | Reutilizar o crear marca/modelo, interpretar modelos conocidos y errores, sin inventar unidades/precio. Búsqueda general/ambigua puede quedar sin vínculo. Ampliación pendiente de implementar; ver acuerdos del 27/11. |
| D17 | Anulación/corrección de una venta | Administrar stock está confirmado; faltan trazabilidad, permisos y reversión de venta. No liberar stock por cambiar una etiqueta. |
| D18 | KPI restantes | Atribución operativa y valores iniciales confirmados arriba; ventas/score y pérdidas individuales siguen pendientes de sus fuentes y reglas. |
| D19 | Reapertura de cerradas | No admitida por las operaciones actuales; acordar operación y motivo antes de habilitarla. |
| D20 | Reglas de avisos aprobadas; implementación pendiente | Espera de stock manual. Unidad cumple condiciones expresas; desconocidos no confirman. Aviso único por oportunidad/unidad al responsable y administrador; sin cambio de estado ni WhatsApp automático. Ver acuerdos del 27/11. |

## Decisiones técnicas pendientes

Plan actualizado: [continuidad.md](continuidad.md). Reportes conectado y SQL aplicado con autorización posterior. Actividades y recontactos quedan para otra versión.

- Próxima versión visual: compactación general de fichas, gestión antes del historial en móvil, jerarquía de eventos, unificación visual de estados, nombres de cliente en avisos y pulido de cargas/transiciones. El 24/11 se autorizaron y resolvieron específicamente BackLink, interés sin tarjeta anidada, paginado de una página y rótulo Resumen de la consulta; lo demás continúa pendiente.
- Navegación de regreso, resuelta localmente el 24/11: `BackLink` usa borde, fondo y área de interacción de 42 px, sin depender de hover. Conserva destinos/filtros del catálogo y actualiza regreso a la nueva ruta de Oportunidades.

- Completar los contactos de vendedores anteriores y validar `seller_contact_required` en una migración posterior. La restricción ya exige datos en nuevas escrituras; `NOT VALID` se refiere solamente a filas históricas.
- El último chequeo de advisors informó `auth_leaked_password_protection`: revisar la protección de contraseñas filtradas en Supabase antes de producción. No se modificó configuración de Auth en este incremento.

- Migración de identidad aplicada y cuentas de demo creadas. Pendiente desactivar el registro público: el token devolvió HTTP 403 y el control aparece bloqueado para el usuario; debe revisarlo un Owner/Administrator de Supabase. Las cuentas sin perfil no acceden al CRM.
- Cambiar correo de acceso, recuperación y cambio de contraseña: siguiente incremento del módulo de usuarios; no enviar emails a direcciones .example.
- Antes de sustituir muestras por datos reales, aplicar RLS por responsable a todas las relaciones comerciales y retirar las dependencias de demo-data.
- Manual de marca pendiente: colores actuales blanco/negro/grises/rojo y marca tipográfica provisional. Manrope aprobada por el usuario el 20/11 y aplicada globalmente como fuente variable local; etiquetas y ayudas más legibles. No se incorporó la foto del logo.
