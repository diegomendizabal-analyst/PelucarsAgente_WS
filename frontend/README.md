# Pelucars · Frontend

Interfaz interna en español para oportunidades, clientes e inventario. Incluye una pequeña muestra ficticia local para evaluar el diseño, sin autenticación ni persistencia.

Desde este directorio:

```text
npm run dev
```

Abrir la URL local indicada por Next.js. En Windows PowerShell, si la política bloquea `npm.ps1`, usar `npm.cmd run dev`.

La navegación principal ofrece Oportunidades, Clientes y Vehículos. Cada fila abre una ficha con datos de ejemplo; los pies de listado conservan accesos a las fichas vacías. El selector **Vista de demostración** alterna Vendedor/Admin; no es autenticación. Las acciones de escritura están deshabilitadas y marcadas como pendientes.

Los dos clientes y dos vehículos ficticios, con sus oportunidades e historial, están en `src/lib/demo-data.ts`. Este archivo es independiente del modelo de datos definitivo y se puede reemplazar sin ejecutar ningún seed. Precios, stock y puntajes son ilustrativos.

Verificaciones:

```text
npm run lint
npm run typecheck
npm run build
```

- [Pantallas, rutas y recorrido](../docs/frontend.md)
- [Modelo de datos propuesto](../docs/modelo-de-datos.md)
- [Decisiones pendientes](../docs/decisiones.md)

No se requieren credenciales ni variables de Supabase. No se ejecutan migraciones, seed ni integraciones.
