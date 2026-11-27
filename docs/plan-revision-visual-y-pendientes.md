# Revisión visual transversal y pendientes — plan para Codex

Fecha de corte: 2026-11-27. **PR en borrador: sólo planificación. No contiene cambios de producto.**

## D07 aprobada — actualización del 27/11/2026

El responsable del proyecto aprobó la continuidad por búsqueda y una pausa fija de **72 horas desde el cierre del bot**, incluso si cerró antes del tercer mensaje. La aprobación comercial de Pelucars no se presume. Detalle vigente en [Alcance V4](https://app.notion.com/p/425b6a1d71a48148a19adacf591e1d6d) y [Modelo V3](https://app.notion.com/p/425b6a1d71a481089b99d407f6bd64f9).

- Primer contacto comercial válido: cliente si no existe y primera oportunidad. Reutilizar cliente por teléfono.
- Misma búsqueda abierta: misma oportunidad; cambio de preferencia actualiza interés y conserva el anterior.
- Compra adicional independiente: oportunidad distinta conceptualmente. Durante el silencio sólo se guarda para revisión; el alta manual continúa como ampliación futura, no se agrega ahora.
- Tras Vendida/Perdida, una nueva búsqueda abre otra oportunidad. Agradecimientos o consultas sobre la operación anterior no crean una por sí solos.
- Pausa por contacto y número comercial, no por oportunidad. Durante ella: guardar sin IA, cálculo, respuesta ni altas automáticas. Los mensajes no extienden la pausa.
- Vencidas 72 horas, el siguiente mensaje puede iniciar un ciclo nuevo de hasta tres respuestas; el reloj solo no envía ni crea nada.
- No resetear cupos ni borrar ciclos previos; diseñar elegibilidad y apertura atómicas. Crear otra oportunidad no elude el límite.
- Sin captura del chat privado, actividades ni habilitación manual del bot. Por ahora, revisión del responsable y cambios de estado.
- Definir aparte límites de ráfagas/procesamiento; las ejecuciones n8n no quedan gratuitas por silenciar respuestas.

**Secuencia:** hacer ahora el ensayo controlado de ficha nueva. Implementar D07 después en un **PR funcional separado de este plan visual**, antes de habilitar recepción general. D07 no es una oferta de otra versión ni un requisito para repetir el ensayo controlado. La prueba no acredita alta automática general ni pausa/reactivación ya implementadas.

Codex prepara contrato, migración incremental y pruebas locales con tiempo controlado (antes/en/después de 72 horas), cierre temprano, duplicados y concurrencia. n8n integra cuando ese contrato esté disponible. No simular el cambio reseteando contadores ni esperando 72 horas durante una ejecución.

## Prioridad y separación de trabajos

Primero cerrar la integración funcional actual: datos que llegan al panel, cálculo/persistencia del score y un recorrido nuevo de WhatsApp. La reestructuración visual transversal y las mejoras de Reportes se desarrollan después, sin ampliar #13/#14/#15 con todo este backlog.

Antes de implementar, verificar Git, PR y migraciones vigentes; leer AGENTS.md aplicables, docs/continuidad.md, docs/handoff-oportunidades-bot.md y los contratos. Conservar cambios locales y wsp/. El usuario cerró voluntariamente el servidor 3000; no tratarlo como incidente. QA 3114 es el servidor comunicado por el equipo: verificar su estado sin detenerlo/reemplazarlo arbitrariamente.

Fuentes vigentes:
- [Portal Notion](https://app.notion.com/p/41ab6a1d71a480aaa7d7c08cc9aea09a).
- [Alcance y futuro V4](https://app.notion.com/p/425b6a1d71a48148a19adacf591e1d6d).
- [Modelo backend V3](https://app.notion.com/p/425b6a1d71a481089b99d407f6bd64f9).
- [Score V1: reglas y ejemplos completos](https://app.notion.com/p/422b6a1d71a481be8c1fd0198947c711).
- [Costos de deploy](https://app.notion.com/p/424b6a1d71a48163b61bf8316600393b).

## Cierre de los PR actuales

Estado consultado en GitHub en este corte. No es aprobación de merge ni declaración de CI aprobada.

| PR | Commit revisado / estado | Qué falta para cerrar |
| --- | --- | --- |
| #13 Persistencia comercial | 486bf9c, abierto hacia main | Actualizar su descripción: la migración ya fue aplicada por el operador y hubo prueba real posterior. Incorporar esa evidencia al cierre. No se identificó una nueva implementación necesaria a partir del resultado compartido. |
| #14 Ficha | acc9b86, abierto sobre la rama de #13 | Prueba con sesión real de vendedor habilitado/asignado pendiente; permisos ya probados en SQL aislado. Comprobar la nueva ficha durante el ensayo integral. Los ajustes visuales generales se trasladan a este plan. |
| #15 Integración n8n | 8e67713, abierto sobre la rama de #13 | Probar una entrada nueva con extractor ampliado: atributos, datos comerciales, cálculo, evidencias, reserva/envío y lectura del panel. La prueba aislada con extracción histórica ya pasó. |

GitHub devolvió mergeable=true para los tres y ningún hilo de revisión. Las consultas de estados y ejecuciones de Actions asociadas a PR devolvieron listas vacías: **no se afirma CI verde**. Las pruebas locales/QA son las reportadas por el equipo, no una suite repetida para escribir este plan.

Orden al integrar, cuando corresponda: #13 primero; después revisar y retargetear #14/#15 a main, comprobando el diff resultante. No reaplicar migraciones por hacer merge. No cerrar manualmente PR sin integrar sus cambios si el objetivo es incorporarlos.

La limitación de vendedor habilitado puede documentarse como pendiente de entorno si no hay una cuenta/sesión disponible; no crear, habilitar ni reasignar cuentas para ocultarla.

## Prueba funcional nueva a coordinar con n8n

**Distinguir dos objetivos:** el workflow de #15 recibe una oportunidad/conversación demo explícitas. Preparar una oportunidad nueva y llenarla desde WhatsApp valida integración y ficha nueva; no valida por sí solo la creación automática general de clientes/oportunidades ni resuelve D07.

1. Verificar qué recorrido de alta existe y acordar con el operador la preparación de una oportunidad demo nueva. Reutilizar el cliente por teléfono si ya existe; no duplicarlo ni resetear conversaciones anteriores. No incluir en Git teléfonos, UUID de registros, IDs de mensajes ni credenciales.
2. Confirmar panel conectado, credenciales vigentes y escucha antes de pedir el mensaje. Mantener filtros de remitente y número de prueba; no exigir coincidencia literal con un texto de ensayo.
3. Para reducir costo, comenzar con **un mensaje completo** que permita cierre temprano y score esperado inequívoco. Ejemplo:

> Busco un Toyota Corolla automático, modelo 2022 en adelante. Mi presupuesto total es de USD 25.000. Quiero comprar dentro de los próximos 5 días. No entrego usado ni necesito financiación. Si encuentran uno que cumpla esos requisitos, quiero avanzar con la reserva.

4. Resultado esperado, si el extractor conserva esas declaraciones: marca Toyota, modelo Corolla, año mínimo 2022, transmisión automática; presupuesto total USD 25.000; usado descartado y financiación false; plazo hasta 7 días, intención reserva_compra. **100/100 = 30 + 40 + 15 + 15**, banda alta, con citas literales. La intención de reserva no crea una reserva comercial ni una venta.
5. Verificar normalización de transmisión entre extractor, persistencia y catálogo; no declarar incompatibilidad sólo por variantes equivalentes como automático/automática. Si aparece un fallo real del contrato, corregirlo en el PR funcional responsable antes de cerrar.
6. Vincular catálogo sólo si ya hay una ficha inequívoca de Toyota/Corolla del mismo origen. No crear ni cambiar stock para que el ensayo pase. Modelo vinculado no promete unidades compatibles ni disponibilidad.
7. Verificar una entrada guardada, resumen/campos/interés/score coherentes, una reserva closing en cupo 1 y envío registrado según resultado real. Si el usuario confirma llegada, registrar esa evidencia por separado de la aceptación de Meta.
8. Abrir la nueva ficha en QA y cotejar con la base: nombre conservado/completado conforme al contrato, campos, score, citas y dos mensajes en orden si el envío se confirma. Probar el vendedor asignado sólo si existe sesión y asignación autorizadas.
9. Ante fallo no pedir mensajes repetidos a ciegas ni volver a consumir cupos. Conservar IDs originales para conciliar en el entorno privado. Deshabilitar procesamiento y dejar sin publicar al terminar.

El caso de tres respuestas ya tiene evidencia histórica; repetirlo sólo si un cambio/fallo nuevo lo justifica o el usuario lo pide. Este archivo **no ejecuta ni programa** envíos, altas o pruebas remotas.

## Revisión de todas las pantallas

Pendiente realizar recorridos reales; las observaciones actuales proceden de capturas de la ficha, no de una auditoría completa del sitio.

| Superficie | Revisar |
| --- | --- |
| Acceso y estructura global | Login, navegación por rol, sidebar, encabezado, breadcrumbs, volver, títulos, estados activos, foco y errores. |
| Reportes y detalle | Jerarquía de KPI, filtros, gráfico mensual, estados vacíos, fuentes pendientes, tablas, paginación y legibilidad de cifras. |
| Oportunidades y ficha | Bandejas, filtros, identidad/resumen/datos, score/evidencias, chat, gestión y eventos. |
| Clientes y ficha | Búsqueda, contacto, oportunidades/historial y permisos. Repensar la vista de todos los clientes del admin sin ampliar acceso del vendedor. |
| Vehículos y unidades | Catálogo, ficha, formularios, precios/monedas, filtros/rangos, disponibilidad y oportunidades relacionadas. |
| Usuarios | Listado y formularios; jerarquía, errores y adaptación, sin modificar cuentas para probar. |
| Controles compartidos | Notificaciones sin marcarlas leídas, modo demo, widget de dólar, calculadora, selectores, modales y cargas. |

Recorrer desktop y móvil con roles disponibles. Usar 1440, 1024, 768, 390 y 320 px de forma focalizada: barrido general y ampliación sólo donde haya problemas. No repetir toda la matriz por cada ajuste menor. Verificar nombres/importes/textos largos, teclado/tacto, zoom y apertura/cierre de overlays. La ausencia de errores de consola no aprueba el diseño.

Antes de cambios masivos: registrar hallazgos por pantalla, proponer patrones compartidos y ordenar prioridades. No cambiar todos los componentes a partir de una única captura.

## Incidencia de scroll en la ficha nueva — 27/11/2026

**Estado actualizado tras QA:** defecto reproducido y corregido en #14. El ensayo nuevo ya fue contrastado contra PostgREST; no publicar aquí identificadores de registros, capturas con datos personales ni IDs de Meta.

**Evidencia de navegador:** en QA 3114, a 1440/390 px los dos mensajes cabían completos y aun así `contain` retenía la rueda; a 320 px había 30 px de scroll interno y la página también se detenía en sus extremos. Se cambió únicamente a `overscroll-behavior:auto`. Con pasos de rueda de 120 y 24 px la página vuelve a desplazarse. En chat largo hidratado de 53 mensajes se conservaron carga de anteriores, IDs/orden y anclaje menor a 2 px. Entrada por Chrome DevTools Protocol: no equivale a una prueba con trackpad físico ni Safari/iOS.

- [x] Reproducir con rueda en QA 3114: conversación corta y larga, comienzo/final e interior del chat; a 1440/390/320 px.
- [x] Permitir continuar el desplazamiento de la ficha en los extremos y cuando no existe desborde interno.
- [x] Ajustar sólo overscroll; sin listeners que cancelen wheel/touch ni bloqueo del documento.
- [x] Conservar orden, cursor y anclaje; no cambiar overflow-anchor ni la lógica de paginación.
- [x] Corregir en **#14**, con prueba focalizada `check-opportunity-ui.mjs --chat-scroll` y regresión hidratada local. No esperar #16 para este defecto.
- [ ] Ampliar en el recorrido general a hardware táctil/trackpad y otros navegadores disponibles, sin declarar esas verificaciones realizadas.
- [ ] Evaluar después en #16 la eliminación del scroll interno para chats cortos y un comportamiento consistente para chat, evidencias, notificaciones y otros paneles desplazables.

No hay evidencia de que este comportamiento modifique mensajes, score o persistencia. Su impacto es de navegación/accesibilidad y puede impedir llegar cómodamente al resto de la ficha.

### Ensayo vigente: Ranger y usado entregado
El usuario sustituyó el ejemplo de Corolla/100 puntos por **Ford Ranger manual desde 2020**, Amarok 2017 para entregar, **USD 12.000 a agregar**, compra en 45 días, financiación e intención de visita. Esperado: **70/100 Alto = 10 + 30 + 15 + 15** y cierre temprano si todos los grupos están completos.

Además de la revisión visual, cotejar que la Ranger figure como búsqueda y la Amarok sólo como usado; el dinero a agregar no sea presentado como precio total ni confirme compatibilidad de presupuesto con stock. La creación de la oportunidad no acredita por sí sola que extracción, score y envío hayan pasado. El ejemplo Corolla anterior se conserva únicamente como caso alternativo documentado, no es el ensayo actual.

**Resultado comprobado desde el panel:** nombre/resumen y campos coinciden con PostgREST; 70/100 Alto (10+30+15+15), cuatro citas literales y dos mensajes en orden. El saliente es `closing` en cupo 1, con estado `sent`, fecha e ID del proveedor. La conversación tiene un cupo y un envío confirmado. No se afirma entrega/lectura ni visita agendada. Ranger permanece sin vínculo porque no se encontró ese modelo en catálogo demo. El dinero a agregar no se usa como precio total. Sin escrituras de prueba ni cambios de cuentas/asignaciones. Sigue pendiente una sesión real de vendedor habilitado/asignado.

### Hallazgos visuales observados en el ensayo, para #16

Recorrido real en Chrome/Next a 1440, 390 y 320 px, con datos del ensayo. No se amplió el rediseño para resolver estas observaciones. Las capturas quedan en el entorno privado del QA; no se suben teléfonos o identidades al repositorio.

| Hallazgo observado | Clasificación / destino | Propuesta verificable para el próximo incremento |
| --- | --- | --- |
| La rueda quedaba atrapada sobre el chat, incluso sin desborde interno. | Funcional, corregido ahora en #14. | Conservar regresión de extremos y anclaje; no reintroducir contain en el chat al reorganizarlo. |
| A 320 px la navegación global, cotización y cuenta ocupan gran parte de la primera pantalla; el resumen queda debajo del encabezado del cliente. | Jerarquía visual, #16. | Revisar estructura global y encabezado juntos; acercar resumen y score sin ocultar estado, identidad o errores. |
| En escritorio, el formulario de gestión completo ocupa casi toda la columna derecha antes del chat; en móvil la gestión ya está plegada. | Densidad visual, #16. | Proponer acciones separadas Asignar/Cambiar estado; conservar validación, motivo y permisos. |
| Vehículo buscado repite Ford Ranger en título y marca/modelo, y manual/2020 en campos y características. | Redundancia visual, #16. | Agrupar atributos sin perder búsqueda original ni editar los valores persistidos; no extraer datos del resumen. |
| El presupuesto aparece primero como “Hasta USD 12.000”; “Dinero a agregar” y la aclaración se leen en líneas posteriores. | Jerarquía visual, #16; el dato y alcance actuales son correctos. | Presentar monto y alcance juntos, manteniendo la distinción con valor total y los datos parciales. |
| El score abierto en escritorio se superpone a resumen/gestión; el cierre se hace desde el mismo resumen del desplegable. Motivos muestran códigos como plazo_categoria. | Usabilidad/presentación, #16; apertura por teclado ya funciona. | Evaluar panel adaptable con cierre visible y foco claro; traducir motivos en presentación, conservar citas y versión técnica. |
| El chat de dos mensajes tiene título, explicación de orden, explicación de actualización y una franja de inicio antes de las burbujas; a 320 px aparece un scroll interno de sólo 30 px. | Densidad visual, #16. | Reducir introducciones y evaluar altura natural para chats cortos, manteniendo límite y carga progresiva en largos. |
| El historial operativo permanece abierto y ocupa otra tarjeta aunque haya un único evento. | Jerarquía visual, #16. | Evaluar desplegable inicial conservando eventos y paginación, separado de la conversación. |

No se detectó desborde horizontal en las tres anchuras. Las observaciones estéticas no cambian score, reglas, permisos, atribución comercial ni persistencia. D07 sigue como incremento funcional separado.

## Correcciones propuestas para la ficha

El usuario coincide con la mayoría de estas críticas; son propuestas de implementación a contrastar en navegador, no aprobación de cada detalle de interacción.

- [ ] Compactar encabezado: identidad/contacto/estado/responsable y score visibles sin una tarjeta excesivamente alta. Historial del cliente junto a su identidad.
- [ ] Mover aclaraciones técnicas generales a ayuda/detalle. Mantener visibles errores, incertidumbres y advertencias que requieren acción.
- [ ] No mostrar “Detalles sin informar” como faltante relevante cuando el cliente no entrega usado.
- [ ] Evitar aparente contradicción entre Corolla/automático/2022 declarados y campos estructurados vacíos. Mostrar las características originales como declaraciones; no parsear resumen ni inventar persistencia. Detalle técnico opcional para campos no estructurados.
- [ ] Mantener score grande con banda y contraste; evidencia en panel lateral o modal adaptable con cierre claro, teclado y gestión del foco.
- [ ] Traducir motivos técnicos para el usuario: “Compra prevista entre 8 y 30 días”, en lugar de nombres internos de categorías. Conservar citas textuales y versión en detalle secundario.
- [ ] Compactar gestión: acciones Asignar/Cambiar estado abren el formulario correspondiente; motivo según contrato. Conservar validaciones y permisos.
- [ ] Simplificar cabecera del chat, padding, separación y ancho de burbujas. Evaluar evitar scroll interno para conversación corta; para larga conservar carga de anteriores y posición.
- [ ] Mensajes pendientes/fallidos/inciertos no se presentan como entregados ni se ordenan con timestamps como si tuvieran posición confirmada.
- [ ] Historial operativo plegado inicialmente cuando no sea la acción principal.
- [ ] Retirar placeholders de funciones futuras; no incorporar procedencia comercial ni ventas ficticias para ocupar espacio.

No cambiar reglas del score, permisos o semántica de persistencia para resolver un problema estético.

## Pendientes funcionales dentro de este plan

### U01 — Rangos de años
Problema reportado: el deslizador sólo valora los años presentes en vehículos.
- [ ] Reproducir y comprobar si el conjunto filtrado cambia los límites y hace saltar la selección.
- [ ] Permitir años enteros intermedios válidos. Fixture local con unidades 2020 y 2024: mínimo 2022 seleccionable.
- [ ] Campos exactos y slider sincronizados; límites inclusivos, limpieza, teclado/tacto y vacío sin selección alterada.
- [ ] Mantener validación de límites del contrato y filtros sobre la misma unidad, antes de paginar. No agregar stock remoto para probar.

### R11 — Consultas por mes
- [ ] Serie mensual de oportunidades creadas, no mensajes ni clientes únicos.
- [ ] Agregado SQL con los mismos filtros y atribución de Reportes; meses Buenos Aires, vacíos en cero y parciales señalados.
- [ ] La suma coincide con Consultas ingresadas del mismo universo; ningún join multiplica leads.
- [ ] Gráfico accesible/responsive con datos legibles y estados carga/vacío/error. No depende de ventas, actividades ni score.

### R12 — Motivos de pérdida por categorías
- [ ] Proponer catálogo inicial para validación comercial; “Pospuso la compra” es un ejemplo, no toda la lista aprobada.
- [ ] Categoría estable y nota opcional separadas, selector requerido al perder, agrupación por identidad y no texto.
- [ ] Dos “pospuso la compra” y un “el cliente pospuso la compra” representan tres casos de la misma categoría.
- [ ] Preparar migración incremental y correspondencia histórica revisable; conservar originales, ambiguos Sin clasificar.
- [ ] No modificar datos compartidos ni ejecutar backfill como parte de un pulido visual.
- [ ] Pérdidas por vendedor requieren atribución histórica de cierre, no actor administrador ni responsable actual.

### P01 — Latencia de DolarAPI
- [ ] Después del deploy de prueba, medir proveedor, autenticación, Supabase y render; comparar búsquedas con/sin presupuesto y separar widget del filtro.
- [ ] Registrar tiempos y determinar causa antes de culpar a Next.js o agregar caché.
- [ ] Ajustar sólo con evidencia, conservando tasa/fecha/errores y precios originales. Oficial/Venta sigue provisional.
- [ ] No bloquear todo el PR esperando esta medición si el deploy aún no existe: dejar pendiente explícito o separar incremento.

## Futuro comercial y exclusiones

**F01 — Procedencia de la consulta** (pauta, Google Maps, referido u otra) es una ampliación para ofrecer en una versión posterior y conversar con Pelucars. No implementar aquí campos, KPI, atribución automática ni placeholders.

No confundir origen técnico demo/WhatsApp con fuente comercial. Una medición futura debe guardar evidencia de la atribución y Sin identificar; contar consultas no demuestra retorno de inversión.

No agregar ventas, actividades, recomendaciones automáticas, nuevas reglas de asignación ni editor del score a este PR. Ventas sigue incluida en el producto pero requiere sus decisiones y un incremento propio.

## Forma de trabajar y cierre futuro

1. Actualizar esta rama desde main cuando se integren las dependencias funcionales; no duplicar sus cambios.
2. Trabajar en commits acotados. Si SQL de R11/R12 y diseño transversal hacen el PR demasiado grande, dividir incrementos vinculados a este plan y actualizar su alcance.
3. Mantener una tabla de hallazgos/estado/pruebas por pantalla; preservar qué queda pendiente de negocio o entorno.
4. Verificar pruebas pertinentes, lint/tipos/build cuando haya código y recorridos visuales de componentes afectados. Datos sintéticos de escritura sólo locales/aislados.
5. No desplegar, mergear, enviar WhatsApp, habilitar cuentas ni aplicar migraciones remotas por este plan.
6. Para declarar listo: evidencia de datos correctos y diseño revisado, sin desbordes, con teclado y contraste, sin pérdida de filtros/paginación ni regresiones de permisos.
