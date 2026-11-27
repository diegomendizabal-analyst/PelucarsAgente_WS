# QA de ficha de oportunidad — 27/11/2026

PR existente: [#14](https://github.com/diegomendizabal-analyst/PelucarsAgente_WS/pull/14), dependiente de [#13](https://github.com/diegomendizabal-analyst/PelucarsAgente_WS/pull/13). Ambos seguían abiertos al consultar GitHub; `origin/main` b090581 no incluye esas ramas. Se hizo fetch antes de comenzar.

## Versión navegable

http://127.0.0.1:3114/oportunidades/19f65c2c-a0d1-4e0f-8ee3-fef55f27ca13

**OP-000063**, administrador habilitado, Datos demo visibles. Next se ejecuta en el worktree `.pr-work/qa-pr14-real`, separado del checkout que usa el servidor 3000. Se reutilizó el proceso de QA 3114, conservando el checkout original y `wsp/`.

Datos contrastados entre la ficha, la sesión autenticada y PostgREST:

- Nombre igual al guardado, con advertencia de identidad no verificada cuando proviene del perfil de WhatsApp.
- Resumen literal; presupuesto USD 20.000, alcance valor total; plazo dentro de los próximos 15 días; usado descartado y financiación false.
- Búsqueda Corolla conservada. `vehicle_id`, `requested_brand` y `requested_model` NULL: no se infieren atributos del resumen ni se vincula al catálogo.
- Una evaluación guardada: **50/100 Medio**, tres evidencias. Se contrastaron las tres citas y motivos del desglose con la RPC, incluyendo apertura con Enter y cierre con Espacio.
- Seis mensajes: mismo ID, texto y orden que `lead_messages` ascendente por `history_position`. Tres respuestas con envío confirmado, sin inventar entrega o lectura.

También se abrió **OP-000062** (`fc9aa375-8769-4c19-a89a-b5afee2d6079`): score pendiente sin cero, datos sin informar o pendientes de registrar, sin error de lectura; el intento de envío incierto aparece separado del mensaje con posición confirmada.

## Cambios y contrato de navegación

Encabezado con referencia, estado, responsable y score; detalle desplegable con citas, limitaciones y versión técnica. Bandas existentes: 0–29 Bajo rojo, 30–59 Medio naranja, 60–100 Alto verde, acompañadas de texto. No se modificó el cálculo ni se expresa probabilidad de venta.

Resumen al comienzo y cuatro grupos compactos de campos reales. Vehículo buscado conserva la búsqueda original y comparación de unidades; búsquedas reemplazadas en desplegable. Gestión a la derecha en escritorio, con botón accesible para abrir/cerrar en móvil. Historial operativo separado del diálogo; sin placeholder de atribución comercial.

Chat de solo lectura en contenedor acotado, cliente a la izquierda y bot a la derecha. Inicialmente lee los últimos 20 mensajes confirmados; los anteriores se agregan arriba conservando la posición de lectura. Cursor por posición durable con corte superior, sin offsets; no presupone posiciones consecutivas. Los intentos sin posición usan su propio apartado y cursor UUID, sin orden conversacional inventado. Actualizar vuelve a consultar mensajes y estados. La nueva ruta GET vuelve a verificar la sesión habilitada, el origen seleccionado y el acceso al lead en cada página; no usa service_role y responde `private, no-store`.

## Pruebas efectivas

Desde `frontend` del worktree de QA:

- `npm run test:opportunities`: **7 pruebas pasan**. Reutiliza las suites SQL de intake/score/RLS en PGlite y agrega cursores con huecos, ingresos nuevos, duplicados, estados vacíos/errores, validación de parámetros y nueva verificación de acceso antes de leer páginas.
- `npm run check:opportunities`: **24 casos pasan**, componentes y CSS reales con adaptadores locales, a 1440/768/390/320 px. Completo, vacío, cero, error, integración pendiente y carga; nombres/importes/textos largos, foco visible, detalle del score por teclado y ausencia de desborde horizontal. Estas pruebas visuales aisladas no son lecturas de Supabase.
- QA adicional de **Next y PostgREST reales**: login administrador; comparación exacta de OP-000063; API de anteriores devuelve los tres IDs esperados usando un corte real, cursor inválido devuelve 400 y demo oculto devuelve 404. Sin sesión redirige a login; cuenta de vendedor deshabilitada no accede al resumen ni a mensajes. Capturas a 1440/390/320 px, score por teclado, gestión visible a la derecha y desplegable/foco en móvil, sin enviar formularios.
- Chat **hidratado en Next** con fixture temporal autenticada, solo en memoria: 53 mensajes en tres páginas a 1440/390/320 px; ningún ID duplicado u omitido, posición preservada con diferencia menor a 2 px; reintento tras HTTP 503 conserva mensajes; pérdida de acceso oculta el chat. Se retiró la ruta de fixture al terminar. Ningún mensaje ficticio se guardó en Supabase.
- `npm run lint`, `npm run typecheck` y `npm run build -- --webpack`: **pasan**. El worktree reutiliza dependencias mediante una junction; el build Turbopack por defecto rechaza paquetes fuera de su raíz. QA también usa webpack. No se cambió la configuración del proyecto para este detalle local.

Artefactos locales (no versionados, contienen capturas de datos de desarrollo): `.pr-work/pr14-redesign-evidence/` en el checkout original. Incluye `results.json`, `hydrated-results.json`, `1440-top.png`, `390-score-evidence.png`, `320-conversation.png`, capturas de gestión móvil y de paginación. Los 24 casos aislados quedan en `.pr-work/qa-pr14-real/.pr-work/opportunity-ui/`.

## Límites y preservación

No se modificaron datos comerciales, cuentas, asignaciones o notificaciones para probar. No se aplicaron migraciones remotas, editaron workflows, enviaron WhatsApp, hicieron merge o despliegues. Las migraciones de desarrollo fueron aplicadas previamente por el usuario; los datos completos llegaron del trabajo de persistencia coordinado.

Las credenciales de vendedor disponibles corresponden a una cuenta deshabilitada. No se verificó una sesión real de vendedor habilitado asignado: esos permisos y la pérdida de acceso tras reasignación sí pasan en las pruebas SQL aisladas existentes. No se alteraron cuentas para cubrir ese caso. No se hicieron pruebas nuevas de concurrencia multisesión ni carga. El contenido ya renderizado requiere Actualizar para reflejar cambios externos; las lecturas nuevas siguen protegidas por RLS.
