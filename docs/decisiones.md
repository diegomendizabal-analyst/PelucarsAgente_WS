# Decisiones de diseño

Fecha: 17 de noviembre de 2026. Alcance: modelo documental y frontend visual. No autoriza implementación de integraciones.

Las observaciones visuales reportadas al preparar el primer PR se registran por separado en [pendientes-frontend.md](pendientes-frontend.md), para revisión el 18/11/2026. Su corrección queda fuera de este cierre de rama.

## Actualización: muestra local autorizada

El usuario pidió incorporar unos pocos datos ficticios para evaluar la interfaz antes de compartir el modelo definitivo. Esta indicación reemplaza la restricción anterior de no mostrar datos de prueba **sólo para la demostración local**. No autoriza seed de base de datos, Supabase, persistencia, autenticación, backend ni automatizaciones.

Se agregan dos vehículos, dos clientes, dos oportunidades (una en espera y otra asignada), seis mensajes ficticios, un intento de recontacto, una tarea programada y una compra histórica. Todos están centralizados en `frontend/src/lib/demo-data.ts`; son datos de presentación reemplazables, no un contrato de dominio. Precios, stock, estados, zonas, escala y valores de score son ilustrativos. Las decisiones pendientes enumeradas abajo continúan abiertas.

Los listados principales muestran ahora la muestra local; las fichas vacías continúan accesibles desde sus pies de listado. Las operaciones comerciales siguen deshabilitadas. Los apartados siguientes documentan las decisiones de la primera etapa, salvo esta excepción explícita sobre datos ficticios.

## Confirmado por el producto

- Cliente y oportunidad son entidades separadas; un cliente puede consultar y comprar varias veces.
- Nuevos leads ingresan en espera. Asignación automática futura a vendedores disponibles.
- Toma voluntaria de leads de la propia zona incluso estando ocupado.
- Vendedor: consulta clientes/historial/score/vehículos y cambia estados de sus oportunidades. Admin: además administra vehículos y responsables. Inicialmente dos administradores, sin crear cuentas en esta etapa.
- Inventario administrado desde el frontend, persistido en Supabase en una etapa futura. La API externa no es fuente de datos de esta entrega.
- Bot futuro: máximo de tres mensajes salientes por recepción inicial, sin catálogo ni respuestas de precio/stock, y derivación de toda consulta comercial a vendedor.
- Sin datos ficticios, seed, migraciones, RLS ejecutable, autenticación, backend, automatización, envío ni persistencia en esta entrega.

## Propuestas adoptadas sólo para estructurar el diseño

- Conversación ligada a un cliente, con vínculo N:M a oportunidades para conservar un mismo hilo a través de consultas sucesivas.
- Mensajes con emisor identificado y contenido original conservado; score versionado con fragmentos, offsets y vínculo al mensaje.
- Separar tareas de seguimiento e intentos efectivamente realizados. La agenda no se cuenta como intentos.
- Baja lógica del inventario y perfiles; compras con snapshots para preservar historia.
- En espera es una condición de asignación, independiente del catálogo de estados comerciales.
- Selector Admin/Vendedor en memoria, rotulado demostración; se reinicia al recargar. Las rutas `vista-previa` no representan IDs ni registros de prueba.
- Valores desconocidos como “Sin información” o “—”, sin números ni registros simulados. Formularios editables sólo para inspección visual, acciones de escritura deshabilitadas.
- Fuentes del sistema para que el frontend no necesite descargar tipografías externas al compilar.

## Decisiones pendientes

| ID | Pregunta a resolver | Impacto / opciones a evaluar |
| --- | --- | --- |
| D01 | ¿Qué es zona y cómo se determina? | Localidad, cobertura comercial u otra unidad; pertenencia múltiple; zona desconocida; qué ocurre al cambiar la zona del cliente. El modelo no impone geografía. |
| D02 | ¿Cuál es el límite de asignaciones y qué cuenta como carga? | Por vendedor/equipo/estado; capacidad configurable; alcance sobre asignación automática y toma voluntaria. No hay valor predeterminado. |
| D03 | ¿Cómo se determina disponibilidad? | Manual, horario, actividad o carga; persistencia de ocupado/desconectado; elegibilidad de Admin como vendedor. No bloquear la toma voluntaria únicamente por ocupado. |
| D04 | ¿Qué consultas puede leer cada vendedor? | Todos los clientes, equipo, cartera, zona o combinación. Debe permitir el historial autorizado sin filtrar mensajes/evidencias de otros ámbitos por accidente. |
| D05 | ¿Cuándo un nuevo contacto abre consulta y cuándo reabre? | Evitar contar cada mensaje como consulta. Definir consultas simultáneas, nueva intención y reaperturas; no fijar una ventana temporal arbitraria. |
| D06 | ¿Qué delimita una recepción inicial y qué consume el máximo de tres? | Reingreso, fallos de entrega, mensajes divididos, cierre y derivación. Preservar la idempotencia de reintentos y la reserva atómica del presupuesto. |
| D07 | ¿Cuáles son estados y transiciones permitidas? | Estados terminales, motivo de cierre, reapertura, permisos Admin y relación con compras. No hay catálogo comercial inventado en el frontend. |
| D08 | ¿Cómo funciona el score? | Escala, criterios, pesos, umbrales, recálculo y revisión humana. No asumir suma de aportes ni escala 0–100. |
| D09 | ¿Puede una evidencia usar mensajes de consultas anteriores? | Propuesta actual: sólo misma oportunidad. Definir mensajes editados, transcripciones, retención, versionado y revisiones del resultado. |
| D10 | ¿Cómo identificar y fusionar clientes? | Teléfonos compartidos o reciclados, varios contactos por persona, verificación y unificación auditada del historial. No UQ global de teléfono todavía. |
| D11 | ¿Un vehículo representa una unidad o un grupo equivalente? | Define stock, posible VIN/patente, reservas, stock disponible y unicidad. Se propone cantidad entera sin implementar reservas ni descuentos automáticos. |
| D12 | ¿Qué información comercial de vehículos es obligatoria? | Versión, rango de año, precio cero frente a no informado, monedas admitidas; opciones ARS/USD sólo propuestas visuales. |
| D13 | ¿Quién registra compras anteriores y con qué detalle? | Importación/manual, anulaciones, comprobantes, impuestos, descuentos, permutas, monedas mixtas y cuotas. No se implementa un módulo de venta. |
| D14 | ¿Cómo se transfieren tareas al reasignar? | Mantener autor y ejecutor históricos; elegir qué pasa con actividades pendientes y responsables. |
| D15 | ¿Qué resultados y canales tienen los intentos? | Normalizar contacto logrado, no respuesta y otros resultados sin confundir respuesta, mensaje e intento. Los textos del formulario son diseño. |
| D16 | ¿Quién administra cuentas, roles y zonas? | Gestionar responsables está confirmado; administrar identidades no necesariamente. Alta futura de los dos Admin, protección de la última cuenta y bajas. |
| D17 | ¿Qué se conserva, por cuánto tiempo y quién corrige? | Mensajes, adjuntos, evidencia, contactos y compras; anonimización, auditoría y registros dados de baja. Sin plazos inventados. |
| D18 | ¿Qué criterio ordenará la asignación automática? | Prioridad, equidad, antigüedad o score; casos sin vendedores disponibles y liberación de leads. Toda consulta comercial se deriva independientemente del score. |

Antes de integrar datos deben resolverse especialmente D01–D07, D10–D12 y la visibilidad/retención. Resolver decisiones no forma parte de esta implementación visual.
