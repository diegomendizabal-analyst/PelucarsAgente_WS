# Frontend visual — Pelucars

**Defectos visuales conocidos:** las capturas posteriores del usuario muestran pérdida de distribución en las filas de oportunidades y de jerarquía en el historial. Quedan pendientes para el 18/11/2026 en [pendientes-frontend.md](pendientes-frontend.md), junto con el relevamiento de componentes similares. Las verificaciones descritas abajo no cierran estas observaciones.

Actualizado el 17 de noviembre de 2026. Aplicación Next.js en `frontend/`. A pedido del usuario, la interfaz incorpora una muestra ficticia local para evaluar las pantallas antes de definir el modelo final. No hay conexión a Supabase, autenticación, persistencia, backend de negocio ni envíos.

## Ejecutar y recorrer

Desde `frontend/`, ejecutar `npm.cmd run dev` en PowerShell (o `npm run dev` en otras terminales) y abrir la URL indicada por Next.js.

1. **Oportunidades → En espera:** Ana Martínez consulta por el Corolla. Abrir la fila para ver sus datos, dos mensajes ficticios, score ilustrativo y evidencia resaltada. **Ver mensaje original** abre Conversación y enfoca el mensaje correspondiente, incluso desde otra sección.
2. **Mis oportunidades:** Bruno López consulta por el Cronos. Su ficha tiene cuatro mensajes, una llamada programada, un intento de recontacto realizado y cambios de responsable/estado. Representa al vendedor de demostración tanto en vista Vendedor como Admin.
3. **Clientes:** abrir Ana o Bruno. Consultas, mensajes, intentos de recontacto y compras tienen contadores independientes. Bruno muestra una compra anterior; Ana conserva el estado vacío de compras.
4. **Vehículos:** Corolla con stock y Cronos sin stock. Buscar por marca/modelo/versión o filtrar por stock. Los precios y cantidades son ficticios.
5. Seleccionar **Admin** en **Vista de demostración**. Abrir un vehículo y **Ver formulario de edición** para revisar campos precargados. **Alta de vehículo · diseño** conserva el formulario vacío. Vendedor sólo consulta; entrar a una ruta de edición no le muestra el formulario.
6. Los enlaces del pie de cada listado permiten revisar las fichas vacías de la primera etapa.

El selector de rol sólo cambia la presentación. Se conserva durante navegación con Next Link y vuelve a Vendedor al recargar. No es autenticación ni autorización real.

## Muestra local

Todos los ejemplos están en `src/lib/demo-data.ts`, con IDs prefijados por `demo-` y sin dependencias de Supabase. Los tipos describen sólo la presentación de esta muestra y no fijan el modelo de producción.

| Ejemplo | Cantidad / uso |
| --- | --- |
| Vehículos | 2: Toyota Corolla y Fiat Cronos, una moneda distinta y disponibilidad distinta. |
| Clientes | 2: Ana Martínez y Bruno López; correos bajo `example.test`, sin números telefónicos reales. |
| Oportunidades | 2: una en espera y otra asignada al vendedor de demostración. |
| Mensajes | 6: dos de Ana y cuatro de Bruno; autores y fechas explícitos. |
| Intentos de recontacto | 1, vinculado a los dos mensajes del contacto vendedor/cliente de Bruno. |
| Agenda | 1 llamada programada, separada del intento realizado. |
| Compras | 1 operación histórica ficticia de Bruno; importe histórico independiente del precio y stock actuales. |

Precios, stock, estados, zonas y puntajes son ejemplos escritos manualmente. La escala 0–100 se utiliza únicamente para ilustrar el componente visual: no define reglas ni calcula scores. Los fragmentos de evidencia coinciden con mensajes de la muestra. No hay bot ni asignación automática; las conversaciones y el historial son estáticos. Las fechas son fijas, se muestran en America/Buenos_Aires y no dependen de la fecha del navegador.

## Rutas

| Ruta | Contenido |
| --- | --- |
| `/` | Bandeja poblada, En espera/Mis oportunidades, búsqueda por cliente/interés y filtro por estado de ejemplo. |
| `/oportunidades/demo-consulta-ana` | Oportunidad en espera del Corolla. |
| `/oportunidades/demo-consulta-bruno` | Oportunidad del Cronos con seguimiento e historial. |
| `/clientes` | Listado y búsqueda por nombre/correo. |
| `/clientes/demo-ana`, `/clientes/demo-bruno` | Fichas de cliente con contadores y secciones de historial. |
| `/vehiculos` | Listado con búsqueda y filtro de stock. |
| `/vehiculos/demo-corolla`, `/vehiculos/demo-cronos` | Detalles de los vehículos ficticios. |
| `/vehiculos/demo-corolla/editar`, `/vehiculos/demo-cronos/editar` | Formularios precargados sólo en vista Admin. |
| `/vehiculos/nuevo` | Formulario vacío de alta visual Admin. |
| `/oportunidades/vista-previa`, `/clientes/vista-previa`, `/vehiculos/vista-previa` | Estructuras vacías preservadas. |
| `/vehiculos/vista-previa/editar` | Formulario visual sin vehículo seleccionado. |

Las rutas dinámicas generan páginas desde la muestra local. Un ID desconocido devuelve la pantalla de no encontrado, sin inventar un registro de respaldo.

## Interacciones y límites

Funcionan navegación, búsqueda y filtros sobre los ejemplos, secciones, foco en mensaje original, cambio de rol visual y escritura temporal en formularios. Las búsquedas ignoran mayúsculas y acentos; al no coincidir muestran estados vacíos. Los contadores se derivan de los datos locales, sin contar tareas como intentos ni mensajes como consultas.

Tomar/asignar oportunidad, cambiar estado, registrar seguimiento, enviar mensajes y crear/editar/dar de baja vehículos siguen **deshabilitados y rotulados Pendiente**. No se simulan guardados exitosos. No hay localStorage, cookies de aplicación, seed, migraciones ni cambios remotos. El envío de formularios se cancela localmente. La edición no modifica los ejemplos y se pierde al abandonar el formulario.

Las fichas vacías mantienen `—` para información no disponible; los registros demo pueden mostrar un cero real de la muestra (por ejemplo, compras de Ana o stock del Cronos).

## Archivos

- `src/lib/demo-data.ts`: única fuente de ejemplos y utilidades de presentación.
- `src/components/demo-lists.tsx`: listados de demostración con filtros locales.
- `src/components/demo-details.tsx`: fichas, conversación, evidencia, historial y edición visual precargada.
- Páginas `[id]/page.tsx` en clientes, oportunidades y vehículos, y `[id]/editar/page.tsx` en vehículos: resolución de IDs y generación de rutas demo.
- `src/components/app-shell.tsx`: navegación, selector de rol y aviso global de datos ficticios.
- `src/components/ui.tsx`: componentes compartidos; indicadores con valor opcional para soportar muestras y estados vacíos.
- `src/components/opportunities.tsx`, `clients.tsx`, `vehicles.tsx`: conservan las estructuras vacías originales.
- `src/app/globals.css`: estilos compartidos y responsive para filas, mensajes y cronología.

Se mantiene la navegación lateral en escritorio y superior en móvil. Filas y formularios se apilan, filtros envuelven, pestañas pueden desplazarse. Hay labels, foco visible, enlace de salto al contenido, `aria-current` y botones de sección con `aria-pressed`. Los ejemplos no requieren imágenes externas ni nuevas dependencias.

## Verificación

Desde `frontend/`:

```text
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

La muestra pasó lint, tipos y build, y las 16 rutas de muestras/formularios/vistas vacías respondieron HTTP 200. Se verificaron 66 combinaciones en Chrome sin ventana: 11 rutas pobladas, dos roles y anchos de 1440/768/390 px, sin desbordamiento horizontal ni excepciones JavaScript. Se comprobaron bandejas, búsqueda sin acentos y sin resultados, filtro de stock, foco de evidencia desde Seguimiento, contadores de Bruno (1 consulta, 4 mensajes, 1 intento, 1 compra), compra histórica, edición Admin precargada, ausencia de persistencia y pantalla 404 para un ID desconocido. También se inspeccionaron capturas de escritorio y móvil.

Lint detectó archivos generados dentro de una carpeta `.next` anidada que ya existía. Se ajustaron `eslint.config.mjs` y `.gitignore` para excluir `**/.next/`, conservando los archivos de código. No se agregaron dependencias. Los scripts y capturas temporales de QA quedan bajo `.next/`, fuera del código versionado.

No se prueban autorización real, persistencia, stock real, scoring, integraciones ni envíos, que siguen fuera de alcance. La revisión visual no es una auditoría completa de accesibilidad ni una prueba en dispositivos físicos o múltiples navegadores.

Ver [decisiones.md](decisiones.md) para la excepción autorizada sobre datos ficticios y [modelo-de-datos.md](modelo-de-datos.md) para el diseño documental pendiente de revisión.
