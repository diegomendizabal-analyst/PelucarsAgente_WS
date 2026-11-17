# Observaciones pendientes del frontend

Registradas el 17/11/2026 a partir de las capturas del usuario. Revisión prevista: **18/11/2026**. Se incluyen en el primer PR como defectos conocidos; no se corrigen en esta entrega ni se programa una automatización.

## UI-01 — Filas de oportunidades sin distribución visual

- **Estado:** pendiente. Prioridad alta para la revisión visual.
- **Dónde:** `/`, bandeja En espera; captura del usuario en vista Admin, escritorio.
- **Observado:** avatar/iniciales, nombre e interés aparecen concatenados; score, responsable y estado se apilan bajo la primera columna. La fila no se alinea con los encabezados y pierde espacios, avatar y distintivos.
- **Esperado:** cliente/interés, score, responsable y estado legibles y alineados con sus encabezados en escritorio; distribución explícita en tarjetas o filas adaptadas en móvil.
- **Revisar mañana:** estilos efectivos de `.demo-row`, `.opportunity-row`, `.demo-person`, `.demo-avatar`, `.demo-cell` y `.demo-badge`; CSS entregado al navegador y posibles diferencias entre desarrollo, build y navegación. Que falten estilos es una hipótesis, no un diagnóstico confirmado.
- **Aceptación:** reproducir el escenario de la captura; comprobar ambas bandejas y ambos roles con recarga y navegación interna, sin texto concatenado ni columnas desalineadas.

## UI-02 — Historial de oportunidad sin jerarquía de eventos

- **Estado:** pendiente. Prioridad media.
- **Dónde:** `/oportunidades/demo-consulta-ana`, sección Historial; captura del usuario en vista Admin.
- **Observado:** el evento de ingreso y su fecha aparecen como dos líneas de texto sin la separación, el marcador lateral ni la jerarquía visual prevista para la cronología.
- **Esperado:** distinguir evento, autor/contexto y fecha; conservar espaciado y tratamiento visual consistente entre eventos.
- **Revisar mañana:** `.demo-timeline`, sus artículos, encabezados y fechas; comparar con Seguimiento y el historial de Bruno, que contiene varios eventos. Confirmar además la presentación de fechas y horas entre servidor y navegador.
- **Aceptación:** cronología legible con uno y varios eventos, en escritorio y móvil, sin perder estilos al cambiar de pestaña.

## UI-03 — Revisión de otros componentes de demostración

- **Estado:** pendiente de relevamiento. El usuario reporta varios problemas similares; sólo UI-01 y UI-02 tienen evidencia concreta en las capturas recibidas.
- **Alcance:** listados de clientes y vehículos; conversación, fragmentos destacados y evidencia; recontactos, compras y formularios Admin. Revisar las clases compartidas `demo-*` y los estados vacíos.
- **No asumir:** que todas esas pantallas están defectuosas ni que todos los síntomas tienen la misma causa.
- **Aceptación:** registrar cada defecto reproducible con ruta, rol, ancho, pasos, resultado esperado y captura; validar el resultado tanto en `npm run dev` como en el build servido localmente. Confirmar navegador, zoom y modo de ejecución del caso informado durante la reproducción.

## UI-04 — Concordancia de contadores

- **Estado:** pendiente. Prioridad baja.
- **Observado en la bandeja:** “1 oportunidades de ejemplo”.
- **Esperado:** “1 oportunidad de ejemplo”; revisar también “1 clientes” y “1 vehículos” al filtrar los otros listados.
- **Aceptación:** textos correctos para cero, uno y varios resultados.

## Alcance de las verificaciones anteriores

Lint, tipos, build y las comprobaciones locales de navegación/responsive habían pasado. Las capturas del usuario muestran problemas visuales que esas verificaciones no cubrieron en su entorno; **no se considera cerrada la validación visual**. La ausencia de desbordamiento horizontal o de excepciones JavaScript no garantiza una presentación correcta.

La revisión de mañana se limita a estas observaciones y al relevamiento visual. Las decisiones del modelo siguen en [decisiones.md](decisiones.md); no se habilitan integraciones, persistencia, autenticación ni automatizaciones.
