# Decisiones vigentes — Pelucars
Actualizado el 20/11/2026. Fuentes: [alcance V2](referencias/alcance-v2-2026-11-19.md) y [modelo backend V1](referencias/modelo-backend-v1-2026-11-19.md), conservados tal como se recibieron. Las conclusiones de la tabla del alcance actualizan los párrafos anteriores cuando hay diferencias. Las contradicciones restantes se explicitan, sin convertirlas en reglas de código.

El [registro anterior](historico/decisiones-2026-11-18.md) es histórico: sus identificadores D01–D19 no equivalen a los del alcance V2. El [modelo vigente](modelo-de-datos.md) sustituye el diseño inicial.

## Confirmado

- Una sucursal; V1 no necesita zonas ni sucursales en el modelo.
- Supabase Auth para correo/contraseña, perfiles y roles admin/seller. Dos administradores individuales previstos, sin límite definido de vendedores.
- Demo inicial: un administrador y un vendedor, con correos de prueba aprobados. Los vendedores se crean desde el sistema; no hay registro público.
- Contacto del vendedor: teléfono internacional y correo de contacto obligatorios desde ahora en alta y edición, incluida la demo (confirmado el 19/11). Correo de contacto separado del de acceso, personal o laboral, sin exigencia de casilla corporativa. Las cuentas anteriores conservan sus datos; deben completarse al editar. No cambiar sus accesos ni rellenar valores ficticios.
- Administradores ven todo. Vendedores acceden al detalle sólo de sus oportunidades actuales; el permiso se aplica a mensajes, score, evidencia, relaciones y contadores.
- D05 confirmado el 20/11: en la bandeja de espera, el vendedor ve únicamente identificador de consulta, fecha/hora de ingreso y tiempo de espera, e indicación operativa **Sin asignar**. Se ofrece la acción **Tomar oportunidad**. El nombre del cliente y el detalle se habilitan después de asignarse, sólo para su responsable y administradores.
- La bandeja del vendedor no revela teléfono, vehículo/interés, stock relacionado, presupuesto, financiación, urgencia, score, conversación, evidencias, resumen ni historial de compras. Tampoco muestra estados comerciales como **En espera de stock**. La restricción alcanza respuestas de servidor, búsquedas, filtros, ordenamientos y eventos; no basta con ocultar columnas. Administradores mantienen el acceso completo. Implementada en la primera etapa de [clientes y oportunidades](crm.md).
- Toma voluntaria: **sin tope provisional para la demo**, confirmado por el usuario el 20/11. No define el límite de producción ni modifica disponibilidad/asignación automática. La toma y el historial son atómicos; una oportunidad ya tomada no se puede volver a tomar.
- Recurrencia (D04, confirmado el 20/11): usar al responsable actual de la consulta más reciente, ordenada por ingreso y UUID como desempate, incluso si está ocupado. Si está deshabilitado o la consulta más reciente no tiene responsable, volver a la bandeja; no buscar un responsable más antiguo. Implementado al insertar una nueva consulta sin asignación explícita. La ventana que decide cuándo crear esa nueva consulta sigue pendiente (D07).
- Avisos internos de asignación implementados el 20/11: campana para el destinatario actual, revisión cada 45 segundos con pestaña visible y al recuperar foco, marcado como leído al abrir. Incluye recurrencia y reasignación; la toma propia no genera aviso redundante. No envía correo ni WhatsApp.
- Asignación manual y reasignación administrativa incluidas (D11). El responsable nuevo obtiene el detalle existente; el anterior pierde acceso (D06).
- El vendedor toma el teléfono del panel y contacta desde su teléfono particular (D09). No se promete traslado técnico ni captura del chat privado.
- Actividades realizadas y programadas incluidas (D10); programar no cuenta como intento realizado. Sin recordatorios automáticos.
- Cinco estados: Nueva consulta, En seguimiento, Vendido, Perdido y En espera de stock. Este último nombre ya está definido (D14).
- Ventas registradas explícitamente por responsable/admin, con actualización transaccional de la unidad vendida. El administrador gestiona inventario (D17).
- El catálogo reside en Supabase y se administra desde el panel; bot sin catálogo, precios ni stock en V1.
- Separación confirmada el 19/11: ficha por marca/modelo; versión, año, precio y características en cada unidad física. El stock disponible se calcula por unidades, no se edita como cantidad. Datos desconocidos opcionales.
- Revisión del 20/11: el código interno de unidad se genera en la base (`PEL-<número>`) y no se ingresa ni se modifica en los formularios. Los códigos existentes se conservan. La secuencia puede tener saltos; no representa cantidad de stock. La referencia del sistema externo será independiente y sigue pendiente de definición.
- Búsqueda del 20/11: marca/modelo al escribir con pausa de 300 ms; stock, catálogo, año y transmisión al cambiar. Año/transmisión y, cuando se pide, disponibilidad deben coincidir en la misma unidad. No se cruzan características de autos diferentes. La búsqueda se realiza en la base antes de paginar.
- Rango de precios del 20/11: mínimo y máximo inclusivos y opcionales; se exige ARS o USD si se usa un límite. Se compara el precio publicado en su moneda original, en la misma unidad que cumple año, transmisión y stock. No convierte importes; precios desconocidos quedan fuera de un filtro por precio/moneda. Los rangos inválidos muestran una indicación y no se interpretan como una búsqueda sin límites.
- Primera implementación de inventario: admin crea/edita y da de baja/restaura fichas sin unidades disponibles; retira o vuelve a disponer unidades. Vendedor consulta. Marcar vendido requiere el futuro módulo comercial y no está habilitado en inventario.
- Se conserva el interés original aunque la venta sea de una alternativa. La llegada de stock no reabre ni contacta automáticamente.
- Fotografías, dashboards y chat privado del vendedor fuera de V1.

## Primera implementación autorizada

### Propuesta pendiente: widget de cotización USD/ARS

El usuario propone un widget compacto, siempre visible en el centro de la barra superior, con valor obtenido de una API y botón **Actualizar**. El tipo de dólar se conversará con el cliente; no está definido ni implementado todavía.

- Resolver con el cliente fuente/proveedor, tipo de dólar (oficial, MEP, blue o cotización propia), compra/venta y uso comercial de la referencia. Definir si el futuro conversor será sólo una calculadora o también permitirá comparar unidades de monedas diferentes.
- Propuesta visual: tipo de cotización, valor en ARS por USD, fecha/hora de la fuente y botón Actualizar; en móvil, un indicador compacto que despliegue el detalle. El conversor podría abrirse desde el mismo widget.
- Propuesta técnica: consultar desde servidor y compartir un valor cacheado, con intervalo de vigencia y límite de actualizaciones por definir. Ante fallo, conservar la última cotización con fecha y aviso de desactualización, o mostrar Sin cotización si nunca hubo una. Nunca reemplazarla por un valor aproximado silencioso.
- Candidato a evaluar: [DolarAPI, endpoint de dólares](https://dolarapi.com/docs/argentina/operations/get-dolares), cuya documentación expone compra, venta, casa y fechaActualizacion. Es un agregador; confirmar fuente, disponibilidad, límites y condiciones antes de elegirlo. No se conectó al proyecto.
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
| D07 | Ventana de siete días | Faltan origen del cómputo, retornos anteriores y excepciones. |
| D08 | Preguntas y score | Aprobar criterios, pesos y momento; no implementar motor. |
| D09 | Cola al liberarse un vendedor | El cuerpo dice asignar el más antiguo al liberarse; la conclusión habla de toma voluntaria si no hubo libres. Confirmar si la segunda limita también el drenaje posterior. |
| D12 | Correos a otros vendedores por pendientes | No incluir sin acuerdo. El correo al asignado es parte del alcance futuro de asignaciones. |
| D13 | Carga inicial e integración externa | Reunión pendiente; sin importación ni sincronización implícita. |
| D15 | Devolver oportunidades tras conocer score | Reasignación administrativa como mecanismo confirmado; no agregar devolución automática. |
| D16 | Granularidad y normalización de catálogo | Confirmada ficha marca/modelo y unidades con versión/año. Implementada deduplicación por mayúsculas y espacios. Consolidación automática de nombres ambiguos e importación siguen pendientes. |
| D17 | Anulación/corrección de una venta | Administrar stock está confirmado; faltan trazabilidad, permisos y reversión de venta. No liberar stock por cambiar una etiqueta. |

## Decisiones técnicas pendientes

Plan para retomar la semana del 23/11 y contexto para otro chat: [continuidad.md](continuidad.md). Próximo incremento propuesto: actividades y recontactos; no implementado en esta entrega.

- Próxima versión visual, diferida por el usuario el 20/11: compactación general de fichas, gestión antes del historial en móvil, jerarquía de eventos, unificación visual de estados, nombres de cliente en avisos y pulido de cargas/transiciones. En esta entrega sólo se ajusta la distinción del bloque **Interés del cliente**, con búsqueda destacada y etiqueta de interés separada.
- Navegación de regreso, pendiente para esa revisión visual (observación del usuario, 20/11): los enlaces **Volver a vehículos / clientes / oportunidades** parecen texto informativo y no se reconoce claramente que son clickeables. Revisar el componente compartido `BackLink`: tratamiento visible de enlace o botón secundario desde el estado inicial, contraste, área de interacción y estados de hover/foco; comprobar escritorio y móvil sin depender del hover para reconocer la acción. Mantener el destino y los filtros de regreso existentes. Registrado para una próxima versión, sin cambio visual en esta entrega.

- Completar los contactos de vendedores anteriores y validar `seller_contact_required` en una migración posterior. La restricción ya exige datos en nuevas escrituras; `NOT VALID` se refiere solamente a filas históricas.
- El último chequeo de advisors informó `auth_leaked_password_protection`: revisar la protección de contraseñas filtradas en Supabase antes de producción. No se modificó configuración de Auth en este incremento.

- Migración de identidad aplicada y cuentas de demo creadas. Pendiente desactivar el registro público: el token devolvió HTTP 403 y el control aparece bloqueado para el usuario; debe revisarlo un Owner/Administrator de Supabase. Las cuentas sin perfil no acceden al CRM.
- Cambiar correo de acceso, recuperación y cambio de contraseña: siguiente incremento del módulo de usuarios; no enviar emails a direcciones .example.
- Antes de sustituir muestras por datos reales, aplicar RLS por responsable a todas las relaciones comerciales y retirar las dependencias de demo-data.
- Manual de marca pendiente: colores actuales blanco/negro/grises/rojo y marca tipográfica provisional. Manrope aprobada por el usuario el 20/11 y aplicada globalmente como fuente variable local; etiquetas y ayudas más legibles. No se incorporó la foto del logo.
