# QA de ficha de oportunidad — 27/11/2026

PR existente: [#14](https://github.com/diegomendizabal-analyst/PelucarsAgente_WS/pull/14). En la comprobación posterior del 27/11, [#13](https://github.com/diegomendizabal-analyst/PelucarsAgente_WS/pull/13) ya está integrado en `origin/main` ca40789; #14 y #15 siguen abiertos y ambos apuntan a main. Se volvió a hacer fetch. El corte anterior b090581 precedía a ese merge.

## Cierre funcional pendiente y ensayo nuevo

Prioridad acordada: completar el ensayo coordinado de #14/#15 antes de la reestructuración general del plan #16. No continuar ajustes estéticos generales en #14. El usuario cerró voluntariamente el puerto 3000; no es un incidente. QA 3114 sigue siendo la instancia a utilizar.

- La ficha histórica de OP-000063 ya pasó el contraste real detallado abajo. El control focalizado posterior volvió a comprobar ficha, campos, score/citas y mensajes contra PostgREST; no se repitieron las suites completas.
- El ensayo nuevo **OP-000064** ya fue contrastado en Next/PostgREST. Ver resultado y corrección focalizada debajo; la creación de la oportunidad por sí sola no se usó como prueba del envío.
- El caso coordinado reemplaza el ejemplo anterior del plan: **Ford Ranger manual desde 2020**, Volkswagen Amarok 2017 para entregar, **USD 12.000 a agregar**, plazo 45 días, financiación requerida e intención de visita. Resultado esperado si la extracción conserva lo declarado: **70/100 Alto = plazo 10 + intención 30 + búsqueda 15 + presupuesto 15**.
- Contrastar nombre según contrato, búsqueda/atributos reales, presupuesto y alcance, plazo, usado/detalles, financiación, resumen, score/desglose y citas literales. La Ranger buscada no debe confundirse con la Amarok entregada. Dinero a agregar no permite afirmar compatibilidad de precio total con una unidad.
- Cotejar conversación y estado de envío real. Se esperan un entrante y un cierre en primer cupo si el workflow confirma ese recorrido; aceptación del proveedor no prueba entrega o lectura. Conservar errores o incertidumbre sin completar datos para forzar el resultado.
- Corregir un eventual fallo funcional en el PR responsable y repetir sólo la comprobación afectada. No editar workflows desde el trabajo del panel ni reenviar mensajes para ocultar fallos.
- Sesión real de vendedor habilitado/asignado: pendiente de entorno. Mantener esa limitación explícita si no hay sesión disponible; no habilitar cuentas ni reasignar oportunidades para probar. Las pruebas SQL existentes de esos permisos ya pasaron.
- Antes de integrar: registrar resultado del nuevo ensayo, revisar diff de #14 contra main, atender hallazgos funcionales y comprobar el estado de revisión/CI sin inferir CI verde de las pruebas locales. Tras recalcular la base, GitHub confirmó **#14 y #15 integrables**; el indicador transitorio anterior de #15 no acreditó un conflicto. El árbol de main ca40789 coincide con la base de #13 y el diff de #14 contra main se revisó sin errores de espacios. Este documento no autoriza merge.

### Resultado del ensayo Ranger y scroll — 27/11

La ficha y PostgREST coinciden en nombre del perfil (sin identidad verificada), resumen literal, Ford Ranger manual desde 2020 y Volkswagen Amarok 2017 como usado. Presupuesto USD 12.000 con alcance `dinero_a_agregar`, plazo 45 días, `trade_in_decision=confirmada` y financiación true. El score guardado es **70/100 Alto**, con plazo 10, intención de visita 30, búsqueda 15 y presupuesto 15; las **cuatro citas** son literales y pertenecen al mensaje de cliente guardado. Se conserva incluso la escritura original de la cita de intención; no se corrige dentro de la evidencia.

Hay **dos mensajes**, cotejados por ID, cuerpo y posición: un entrante y una respuesta `closing`, `bot_slot=1`, `send_state=sent`, con identificador del proveedor y fecha de envío presentes. La RPC de conversación devuelve `waiting_assignment`, un cupo reservado y un envío confirmado. Esto verifica aceptación registrada por el proveedor, no entrega ni lectura. No existe una ficha Ford/Ranger demo en la consulta de catálogo; `vehicle_id` permanece NULL. No se creó stock ni se forzó vínculo. La intención de visita no acredita una visita agendada.

**Defecto funcional confirmado:** `overscroll-behavior:contain` retenía la rueda sobre `.op-chat-scroll`, incluso cuando los dos mensajes cabían completos a 1440/390 px. A 320 px había 30 px de desborde interno; en ambos extremos la página también quedaba inmóvil. Se reprodujo con eventos nativos de rueda de Chrome, pasos de 120 y 24 px, y se cambió sólo esa propiedad a `auto`. La continuación de rueda desplaza ahora la página en ambos extremos. No se agregaron listeners, ni se modificaron `overflow-anchor:none`, cursores o cálculo de anclaje.

Pruebas focalizadas posteriores:

- Lectura de OP-000064 en Next y PostgREST, capturas a 1440/390/320, doce combinaciones de extremo/delta/anchura: pasan, con continuidad de scroll y sin desborde horizontal.
- `node scripts/check-opportunity-ui.mjs --chat-scroll`: tres casos locales, doce combinaciones de rueda; pasa. Es un modo acotado de la prueba existente, sin repetir los 24 escenarios.
- Chat largo hidratado con 53 mensajes solo en memoria, a las tres anchuras: scroll interno en zona intermedia, continuación sobre la página en extremos; dos cargas hacia atrás, orden e IDs íntegros y diferencia del anclaje menor a 2 px; reintento de lectura y pérdida de acceso siguen funcionando. Ruta temporal retirada después.
- La entrada de rueda se generó mediante Chrome DevTools Protocol, incluyendo deltas pequeños similares a trackpad; no fue una prueba con trackpad físico ni Safari/iOS. No se repitieron build ni suites SQL completas porque no cambiaron lógica, consultas o permisos.

Capturas/resultados privados en `.pr-work/pr14-functional-<id-local>/`; no se versionan datos personales ni IDs de Meta. Los hallazgos visuales del recorrido se agregan al plan de #16, sin implementarlos en este arreglo. Para integrar #14 queda revisión del diff/CI y mantener explícita la limitación de sesión real de vendedor habilitado/asignado; el ensayo nuevo de lectura y el defecto de rueda quedan validados.

**D07 después del ensayo:** decisión funcional aprobada, implementación pendiente en otro PR funcional, separado de #14/#16. Se leyó la [decisión completa](https://app.notion.com/p/425b6a1d71a48148a19adacf591e1d6d) y el [contrato técnico pendiente](https://app.notion.com/p/425b6a1d71a481089b99d407f6bd64f9). Preparar contrato atómico, migración incremental, pruebas locales con reloj controlado y handoff a n8n. Pausa fija de 72 horas por contacto/número comercial desde cierre incluso temprano; guardar mensajes sin IA/envíos/altas durante la pausa, sin prorrogarla. Otro ciclo sólo ante un mensaje posterior elegible, con historial/cupos anteriores intactos y sin elusión por otra oportunidad. Misma búsqueda abierta continúa; cambio de preferencia conserva intereses anteriores. Alta manual, actividades y avisos nuevos quedan fuera. No aplicar SQL remoto ni desplegar automáticamente.

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
