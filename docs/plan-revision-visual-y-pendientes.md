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
