# Decisiones vigentes — Pelucars
Actualizado el 19/11/2026. Fuentes: [alcance V2](referencias/alcance-v2-2026-11-19.md) y [modelo backend V1](referencias/modelo-backend-v1-2026-11-19.md), conservados tal como se recibieron. Las conclusiones de la tabla del alcance actualizan los párrafos anteriores cuando hay diferencias. Las contradicciones restantes se explicitan, sin convertirlas en reglas de código.

El [registro anterior](historico/decisiones-2026-11-18.md) es histórico: sus identificadores D01–D19 no equivalen a los del alcance V2. El [modelo vigente](modelo-de-datos.md) sustituye el diseño inicial.

## Confirmado

- Una sucursal; V1 no necesita zonas ni sucursales en el modelo.
- Supabase Auth para correo/contraseña, perfiles y roles admin/seller. Dos administradores individuales previstos, sin límite definido de vendedores.
- Demo inicial: un administrador y un vendedor, con correos de prueba aprobados. Los vendedores se crean desde el sistema; no hay registro público.
- Contacto del vendedor: teléfono internacional y correo de contacto obligatorios desde ahora en alta y edición, incluida la demo (confirmado el 19/11). Correo de contacto separado del de acceso, personal o laboral, sin exigencia de casilla corporativa. Las cuentas anteriores conservan sus datos; deben completarse al editar. No cambiar sus accesos ni rellenar valores ficticios.
- Administradores ven todo. Vendedores acceden al detalle sólo de sus oportunidades actuales; el permiso se aplica a mensajes, score, evidencia, relaciones y contadores.
- Pendientes: score, mensajes, resumen e información que revele intención permanecen ocultos. La lista exacta de campos mínimos sigue pendiente.
- Nueva consulta recurrente con responsable anterior deshabilitado vuelve a la bandeja (D04).
- Asignación manual y reasignación administrativa incluidas (D11). El responsable nuevo obtiene el detalle existente; el anterior pierde acceso (D06).
- El vendedor toma el teléfono del panel y contacta desde su teléfono particular (D09). No se promete traslado técnico ni captura del chat privado.
- Actividades realizadas y programadas incluidas (D10); programar no cuenta como intento realizado. Sin recordatorios automáticos.
- Cinco estados: Nueva consulta, En seguimiento, Vendido, Perdido y En espera de stock. Este último nombre ya está definido (D14).
- Ventas registradas explícitamente por responsable/admin, con actualización transaccional de la unidad vendida. El administrador gestiona inventario (D17).
- El catálogo reside en Supabase y se administra desde el panel; bot sin catálogo, precios ni stock en V1.
- Se conserva el interés original aunque la venta sea de una alternativa. La llegada de stock no reabre ni contacta automáticamente.
- Fotografías, dashboards y chat privado del vendedor fuera de V1.

## Primera implementación autorizada

Login/logout, perfiles, habilitación, auditoría y alta/edición básica de vendedores. Migración de identidad y cuentas iniciales de demo. Las operaciones comerciales siguen siendo una muestra local: no se conectan silenciosamente al nuevo esquema.

El rol y la habilitación no dependen de metadata editable. El usuario sin perfil completo queda sin acceso. La gestión visible crea únicamente vendedores; las cuentas admin se incorporan mediante procedimiento controlado. La separación entre habilitación y disponibilidad está modelada, con disponibilidad inicialmente false y sin automatización.

El alta de Auth y la inserción de perfil no son una sola transacción. Un fallo intermedio requiere conciliación; no se borra ni reintenta indiscriminadamente una identidad existente. Auditoría nunca almacena contraseñas/tokens. Ver [autenticacion.md](autenticacion.md) para configuración, migración y verificaciones.

## Pendientes del alcance actualizado

| ID V2 | Decisión pendiente | Tratamiento actual |
| --- | --- | --- |
| D01 | Cuándo se libera un vendedor | No deducir disponibilidad del estado comercial. |
| D02 | Capacidad de toma voluntaria | Sin límite inventado. |
| D03 | Quién cambia disponibilidad | Separada de cuenta habilitada; sin control operativo implementado. |
| D04 | Elegir responsable anterior con varios históricos | La excepción por deshabilitación ya está resuelta: bandeja. |
| D05 | Campos de la bandeja compartida | Propuesta mínima ID/espera/estado; no implementar una proyección definitiva aún. |
| D07 | Ventana de siete días | Faltan origen del cómputo, retornos anteriores y excepciones. |
| D08 | Preguntas y score | Aprobar criterios, pesos y momento; no implementar motor. |
| D09 | Cola al liberarse un vendedor | El cuerpo dice asignar el más antiguo al liberarse; la conclusión habla de toma voluntaria si no hubo libres. Confirmar si la segunda limita también el drenaje posterior. |
| D12 | Correos a otros vendedores por pendientes | No incluir sin acuerdo. El correo al asignado es parte del alcance futuro de asignaciones. |
| D13 | Carga inicial e integración externa | Reunión pendiente; sin importación ni sincronización implícita. |
| D15 | Devolver oportunidades tras conocer score | Reasignación administrativa como mecanismo confirmado; no agregar devolución automática. |
| D16 | Granularidad y normalización de catálogo | Adoptar separación catálogo/unidades como diseño; confirmar consolidación y nombres ambiguos antes de conectar inventario. |
| D17 | Anulación/corrección de una venta | Administrar stock está confirmado; faltan trazabilidad, permisos y reversión de venta. No liberar stock por cambiar una etiqueta. |

## Decisiones técnicas pendientes

- Completar los contactos de vendedores anteriores y validar `seller_contact_required` en una migración posterior. La restricción ya exige datos en nuevas escrituras; `NOT VALID` se refiere solamente a filas históricas.
- El último chequeo de advisors informó `auth_leaked_password_protection`: revisar la protección de contraseñas filtradas en Supabase antes de producción. No se modificó configuración de Auth en este incremento.

- Migración de identidad aplicada y cuentas de demo creadas. Pendiente desactivar el registro público: el token devolvió HTTP 403 y el control aparece bloqueado para el usuario; debe revisarlo un Owner/Administrator de Supabase. Las cuentas sin perfil no acceden al CRM.
- Cambiar correo de acceso, recuperación y cambio de contraseña: siguiente incremento del módulo de usuarios; no enviar emails a direcciones .example.
- Antes de sustituir muestras por datos reales, aplicar RLS por responsable a todas las relaciones comerciales y retirar las dependencias de demo-data.
- Manual de marca pendiente: colores actuales blanco/negro/grises/rojo, tipografías del sistema y marca tipográfica provisional. No se incorporó la foto del logo.
