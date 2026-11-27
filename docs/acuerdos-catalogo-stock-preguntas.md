## Acuerdos del 27/11: catálogo, avisos de stock y preguntas del bot

Aprobados por el responsable del proyecto en esta conversación. Son requisitos de la versión inicial; no se atribuye aprobación comercial a Pelucars. Registrar una decisión no acredita su implementación ni habilita producción.

### D16 — Interpretación y escritura del catálogo

- Asociar la búsqueda a la ficha de marca/modelo existente aunque no se informen versión, año o transmisión. “Ford Ranger” alcanza para vincular Ford Ranger; los atributos desconocidos quedan sin informar.
- Si la marca/modelo identificada no existe, el bot crea la ficha y la asocia a la oportunidad. No crea unidades, stock, precio ni disponibilidad. Este requisito ya estaba previsto; no es una ampliación futura.
- La IA puede reconocer modelos conocidos sin marca explícita (Corolla → Toyota Corolla; Gol → Volkswagen Gol) y corregir errores habituales (Wolkswagen → Volkswagen). Primero buscar coincidencias y evitar duplicados; conservar el texto original. No gastar una pregunta en confirmar una marca evidente.
- Una ambigüedad real no autoriza inventar marca/modelo. Conservar la búsqueda y solicitar precisión cuando corresponda dentro de los cupos disponibles. “Una camioneta automática” no crea una ficha llamada Camioneta: puede quedar sin marca/modelo y asociarse después.
- Cambiar Ranger por Hilux conserva la oportunidad y el interés anterior, actualizando la búsqueda vigente. Una compra independiente de ambos vehículos corresponde a oportunidades distintas, respetando D07.
- La creación debe conservar el aislamiento demo/real y los permisos existentes. Detalles de normalización, concurrencia y contrato con n8n se implementan y prueban en un PR funcional separado de #16 y D07.
- Estado: vínculo al catálogo existente implementado; interpretación ampliada y creación automática pendientes de implementación y validación. Esta decisión sustituye la restricción funcional anterior de exigir siempre la marca literal, pero no afirma que el extractor/RPC actual ya lo admita.

### D20 — Espera de stock, compatibilidad y avisos

- **En espera de stock lo pone el vendedor responsable.** La ausencia de unidades no cambia el estado por programación. Se conservan los permisos administrativos existentes.
- Al ingresar una unidad compatible, evaluar oportunidades en En espera de stock. Debe cumplir las condiciones expresas del cliente: modelo y, cuando se hayan indicado, año, transmisión y presupuesto comparable. Sin restricciones adicionales, pedir Ranger permite considerar cualquier Ranger disponible.
- Los requisitos deben cumplirse en la misma unidad. Un dato necesario desconocido no confirma una coincidencia. El dinero a agregar no se compara directamente con el precio total: requiere una valoración del usado; no inventarla.
- Avisar dentro del sistema al responsable actual y al administrador. Si no hay responsable, avisar al administrador.
- Un solo aviso por oportunidad y unidad. Guardar o editar nuevamente la misma unidad no lo repite; otra unidad compatible puede generar otro aviso.
- El responsable revisa, recontacta y cambia el estado. La llegada de stock no cambia el estado, no reabre oportunidades ni envía WhatsApp automáticamente.
- Estado: reglas aprobadas por el responsable del proyecto; avisos pendientes de implementación. No confundir comparación de unidades ya existente con notificaciones implementadas. No se agrega reenvío por reingreso de la misma unidad.

### D08 — Orden de preguntas aprobado; score parcialmente pendiente

Orden aprobado para los datos faltantes:
1. Vehículo buscado.
2. Presupuesto y alcance: total del vehículo o dinero a agregar.
3. Entrega de usado.
4. Plazo de compra.
5. Financiación.

No volver a preguntar datos ya informados; interpretar correcciones y conservar el máximo de tres respuestas por ciclo, incluido el cierre. Puede cerrar con datos pendientes. Reconocer una marca evidente no debe consumir una pregunta innecesaria.

El cálculo y la persistencia del score del prototipo ya están implementados. Este acuerdo aprueba el orden de preguntas; **no aprueba nuevos pesos, bandas, señales ni momento de evaluación**. Esos aspectos de D08 siguen pendientes de validación comercial. La adecuación del flujo a este orden debe verificarse, no darse por hecha.

### Aplicación y coordinación

Codex debe implementar el contrato de catálogo y los avisos con pruebas focalizadas. n8n debe consumir el contrato revisado para interpretar/asociar/crear la ficha y respetar el orden de preguntas. El panel lee los campos persistidos; no deduce valores del resumen. Esta actualización sólo documenta: no aplica migraciones, modifica workflows, envía mensajes ni cambia estados comerciales.

## Referencias

- [Alcance vigente V4 en Notion](https://app.notion.com/p/425b6a1d71a48148a19adacf591e1d6d).
- [Modelo backend V3 en Notion](https://app.notion.com/p/425b6a1d71a481089b99d407f6bd64f9).
- [Registro de decisiones](decisiones.md).
- [PR #17: implementación separada de D07](https://github.com/diegomendizabal-analyst/PelucarsAgente_WS/pull/17).

Fuente de aprobación: conversación del 27/11/2026 con el responsable del proyecto. D16: respuestas 1–6 y aclaración sobre interpretación de modelos/errores; D20: corrección de A/C (estado manual) y aprobación de compatibilidad/aviso único; D08: «el orden establecido me parece bien». No hay cambio de pesos del score aprobado en este registro.
