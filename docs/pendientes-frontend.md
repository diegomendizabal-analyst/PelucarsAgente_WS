# Observaciones pendientes del frontend

Registradas el 17/11/2026 a partir de las capturas del usuario. Corregidas localmente el **18/11/2026**, por pedido del usuario. Se conserva el detalle original para explicar los cambios; la validación no implica merge ni publicación.

## Diagnóstico y corrección

En desarrollo se reprodujo que, con el loader personalizado de `@tailwindcss/turbopack`, el navegador seguía recibiendo CSS anterior después de modificar la hoja fuente. Se retiraron ese loader y las directivas de Tailwind no utilizadas; la aplicación usa CSS nativo de Next.js. Una prueba en navegador confirma que una regla nueva se aplica y se revierte sin recargar ni reiniciar. Esto explica una causa reproducible local; no permite reconstruir exactamente el estado del navegador de las capturas originales.

Las cabeceras y filas ahora comparten columnas y separaciones. Se incorporaron componentes comunes de identidad, celda, distintivo y evento, con estilos explícitos en `records.css`. El diseño usa blanco, negro y acentos rojos; la foto del logo no se incorpora. Se añadieron límites de carga en las fichas para resolver los avisos de navegación de Next.js detectados por la revisión de consola.

## UI-01 — Filas de oportunidades sin distribución visual

- **Estado:** corregido y revisado localmente en ambas bandejas y roles.
- **Dónde:** `/`, bandeja En espera; captura del usuario en vista Admin, escritorio.
- **Observado:** avatar/iniciales, nombre e interés aparecen concatenados; score, responsable y estado se apilan bajo la primera columna. La fila no se alinea con los encabezados y pierde espacios, avatar y distintivos.
- **Esperado:** cliente/interés, score, responsable y estado legibles y alineados con sus encabezados en escritorio; distribución explícita en tarjetas o filas adaptadas en móvil.
- **Corrección:** estilos efectivos de filas, identidades, score y distintivos; columnas compartidas con las cabeceras en escritorio y etiquetas por campo en móvil.
- **Aceptación:** reproducir el escenario de la captura; comprobar ambas bandejas y ambos roles con recarga y navegación interna, sin texto concatenado ni columnas desalineadas.

## UI-02 — Historial de oportunidad sin jerarquía de eventos

- **Estado:** corregido y revisado localmente con uno y varios eventos.
- **Dónde:** `/oportunidades/demo-consulta-ana`, sección Historial; captura del usuario en vista Admin.
- **Observado:** el evento de ingreso y su fecha aparecen como dos líneas de texto sin la separación, el marcador lateral ni la jerarquía visual prevista para la cronología.
- **Esperado:** distinguir evento, autor/contexto y fecha; conservar espaciado y tratamiento visual consistente entre eventos.
- **Corrección:** cronología con fecha y hora, marcador, tipo de evento, título, detalle y responsable. Se comparte con seguimiento, recontactos y compras. Fechas explícitas en America/Buenos_Aires y horas de 24 horas consistentes entre servidor y navegador.
- **Aceptación:** cronología legible con uno y varios eventos, en escritorio y móvil, sin perder estilos al cambiar de pestaña.

## UI-03 — Revisión de otros componentes de demostración

- **Estado:** relevamiento y actualización visual realizados localmente. Las capturas originales sólo documentaban UI-01 y UI-02; la revisión se extendió a las otras vistas solicitadas.
- **Alcance:** listados de clientes y vehículos; conversación, fragmentos destacados y evidencia; recontactos, compras y formularios Admin. Revisar las clases compartidas `demo-*` y los estados vacíos.
- **No asumir:** que todas esas pantallas están defectuosas ni que todos los síntomas tienen la misma causa.
- **Aceptación:** registrar cada defecto reproducible con ruta, rol, ancho, pasos, resultado esperado y captura; validar el resultado tanto en `npm run dev` como en el build servido localmente. Confirmar navegador, zoom y modo de ejecución del caso informado durante la reproducción.

## UI-04 — Concordancia de contadores

- **Estado:** corregido. Los contadores usan una utilidad de singular/plural, también para unidades de stock.
- **Observado en la bandeja:** “1 oportunidades de ejemplo”.
- **Esperado:** “1 oportunidad de ejemplo”; revisar también “1 clientes” y “1 vehículos” al filtrar los otros listados.
- **Aceptación:** textos correctos para cero, uno y varios resultados.

## Alcance de las verificaciones anteriores

Lint, tipos, build y las comprobaciones locales de navegación/responsive habían pasado. Las capturas del usuario muestran problemas visuales que esas verificaciones no cubrieron en su entorno; **no se considera cerrada la validación visual**. La ausencia de desbordamiento horizontal o de excepciones JavaScript no garantiza una presentación correcta.

## Validación del 18/11/2026

La revisión actual usa `frontend/scripts/check-ui.mjs`: verifica estilos computados, alineación de columnas, jerarquía de eventos, ausencia de desbordamiento y errores de consola, además de interacciones. Cubre 15 rutas, los dos roles, pestañas de las cuatro fichas pobladas y anchos de 1440, 768, 390 y 320 px. Incluye filtros, contadores, foco de evidencia y edición visual Admin. Las capturas quedan en `.next/ui-qa/` y se inspeccionan también visualmente. El resultado final de desarrollo y producción se registra en [frontend.md](frontend.md).

Pendiente: revisión del usuario en su navegador y manual de marca definitivo (D19). No se realizó una auditoría completa de accesibilidad ni pruebas en dispositivos físicos o múltiples motores de navegador. Las decisiones del modelo siguen en [decisiones.md](decisiones.md); no se habilitan integraciones, persistencia, autenticación ni automatizaciones.
