# Continuidad — semana del 23/11/2026

Preparado el 20/11 para retomar en otro chat. Es un plan de trabajo; no incorpora funcionalidades nuevas ni resuelve decisiones pendientes por sí solo.

## Punto de partida

- Rama de esta entrega: `backend-clientes-oportunidades`, PR hacia `main`. El usuario revisa y realiza el merge. Antes de continuar, comprobar su estado y partir del `main` actualizado en una nueva rama.
- Aplicación: ejecutar npm desde `frontend/` (la carpeta superior). Leer `frontend/AGENTS.md` y las skills pertinentes antes de modificar código.
- Login, gestión de vendedores y catálogo/inventario ya estaban conectados. Esta entrega conecta clientes y oportunidades, toma voluntaria, asignación administrativa, estados e historial, recurrencia y notificaciones internas.
- Bandeja del vendedor: sólo referencia OP, ingreso/espera y Sin asignar. Datos comerciales disponibles para responsable actual/admin. Toma sin tope provisional para demo.
- Recurrencia: responsable actual de la consulta más reciente si está habilitado, aunque esté ocupado. Sin responsable o deshabilitado: En espera. La ventana para crear otra consulta sigue pendiente.
- Migraciones CRM de esta rama ya aplicadas al proyecto de demo. No editarlas ni volver a aplicar SQL manualmente sin revisar el estado remoto.
- Datos de prueba persistentes y reiniciables documentados en [pruebas-crm.md](pruebas-crm.md). No reiniciarlos al comenzar: el usuario puede estar probando. Nunca alterar inventario, cuentas ni registros ajenos a la muestra al reiniciar.
- Credenciales sólo en archivos locales ignorados. No incluirlas en chat, logs o commits.

## Próximo incremento propuesto: actividades y recontactos

1. Revisar [alcance V2](referencias/alcance-v2-2026-11-19.md), [modelo vigente](modelo-de-datos.md), [CRM implementado](crm.md) y [decisiones](decisiones.md). Las decisiones confirmadas posteriores prevalecen sobre las referencias originales.
2. Diseñar y conectar actividades de una oportunidad: contacto por WhatsApp realizado manualmente, llamada, visita y nota; autor, fecha, propósito y resultado. No enviar mensajes desde el panel.
3. Mostrar un único historial con actividades y eventos de estados/asignaciones, además del historial autorizado del cliente. No duplicar el registro para que aparezca en ambas vistas.
4. Incorporar programación y cancelación de actividades sin recordatorios automáticos. D10 figura confirmado en decisiones; el documento original lo dejaba pendiente. Una programación nunca equivale a un contacto realizado.
5. Separar contadores: consultas, mensajes, intentos de recontacto realizados y contactos efectivos. Sólo una actividad de contacto completada con propósito de seguimiento cuenta como intento; notas, cancelaciones y tareas programadas no cuentan. Editar no debe incrementar el contador por duplicación.
6. Aplicar permisos al responsable actual/admin en todas las lecturas y escrituras. La reasignación debe revocar al anterior y conservar la autoría histórica.
7. Extender las muestras y verificaciones del módulo: permisos, estados de actividad, contadores, edición sin duplicados y recorrido responsive. Documentar y abrir un PR separado.

Antes de implementar, cerrar el catálogo de resultados, permisos/reglas de edición o anulación de actividades y comportamiento en oportunidades cerradas. Usar las reglas existentes sin inventar reaperturas ni automatización comercial.

## Después y decisiones que necesitan al cliente

- Ventas y compras previas: registro transaccional sobre una unidad física; acordar corrección/anulación antes de habilitarlo. Cambiar una etiqueta no vende ni libera stock.
- Bot/n8n: siguiente etapa independiente, después de resolver preguntas/score, ventana de nueva consulta y reglas de disponibilidad/asignación. No hay bot ni endpoint público de ingreso implementado.
- Alta manual de clientes/oportunidades: sigue pausada hasta revisar su inclusión en el alcance.
- Widget USD/ARS: pendiente fuente, tipo de dólar y uso comercial; no elegir cotización por cuenta propia.
- Antes de producción: resolver registro público de Auth bloqueado en el dashboard, protección de contraseñas filtradas y contactos históricos pendientes. Ver [autenticacion.md](autenticacion.md).

## Diseño pendiente para otra versión

- Hacer reconocibles como clickeables los enlaces de regreso del componente `BackLink`.
- Simplificar Interés del cliente: mejoró la jerarquía, pero el usuario no está convencido del recuadro dentro de otro y el doble acento rojo. Revisar también el espacio del paginado para un solo registro.
- Resto del pulido visual en [decisiones.md](decisiones.md). Manrope está aprobada; conservarla.
- El rótulo actual **Nota:** muestra `leads.summary` (`text`, nullable, máximo 6000 caracteres): resumen privado de la necesidad. **Resumen de la consulta** sería más preciso para distinguirlo de futuras notas de actividades. La etiqueta se conserva hasta acordar el ajuste; no requiere renombrar la columna.

## Verificación de esta entrega

Ya se ejecutaron lint, tipos, build, validaciones CRM, verificaciones SQL de permisos/recurrencia/seed y recorridos de UI. El último cambio del rótulo Nota pasó lint y tipos. No se repitieron tests para preparar el PR, por indicación del usuario.

Límites: no hubo prueba de carga con sesiones concurrentes ni recorrido de mutaciones desde navegador con un vendedor habilitado; permisos y mutaciones se verificaron con SQL. El navegador sí comprobó el rechazo de una cuenta deshabilitada. Ver [crm.md](crm.md) para el detalle.

## Texto para iniciar otro chat

> Retomemos Pelucars desde docs/continuidad.md. Primero revisá el estado del PR de backend-clientes-oportunidades y la rama main; el merge lo hago yo. El próximo incremento propuesto es actividades y recontactos, con historial y contadores separados, permisos por responsable/admin y sin mensajes automáticos. Leé AGENTS.md, docs/decisiones.md y docs/crm.md antes de modificar. No reinicies datos de demo ni cambies cuentas al comenzar.
