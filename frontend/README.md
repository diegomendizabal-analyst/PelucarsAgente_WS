# Pelucars · Frontend

Interfaz interna en español para oportunidades, clientes e inventario. Esta rama incorpora autenticación con Supabase y administración de vendedores. Las pantallas comerciales todavía usan una muestra ficticia local sin persistencia comercial.

Desde este directorio:

```text
npm run dev
```

Abrir la URL local indicada por Next.js. En Windows PowerShell, si la política bloquea `npm.ps1`, usar `npm.cmd run dev`.

La navegación principal ofrece Oportunidades, Clientes y Vehículos, con datos comerciales de ejemplo. El rol proviene de la cuenta autenticada. Administradores ven además **Usuarios**, con alta de vendedores y edición de nombre, teléfono y habilitación. Las acciones comerciales siguen deshabilitadas y marcadas como pendientes.

Los dos clientes y dos vehículos ficticios, con sus oportunidades e historial, están en `src/lib/demo-data.ts`. Este archivo es independiente del modelo de datos definitivo y se puede reemplazar sin ejecutar ningún seed. Precios, stock y puntajes son ilustrativos.

Verificaciones:

```text
npm run lint
npm run typecheck
npm run build
npm run test:auth
```

La interfaz usa CSS nativo de Next.js. Después de actualizar desde la primera entrega, reiniciar una vez el servidor de desarrollo para que tome el cambio de `next.config.ts`.

Con el servidor local iniciado, se puede ejecutar la revisión de filas, fichas y navegación en Chrome/Chromium (también admite Edge):

```text
npm run check:ui -- http://127.0.0.1:3000
```

Usar la URL y el puerto del servidor. El recorrido completo necesita las cuentas de `frontend/.env.demo.local`; `--public-only` comprueba login y rutas cerradas sin cuentas reales. `CHROME_BIN` permite indicar el ejecutable si no se detecta automáticamente. Para comprobar también las actualizaciones de CSS en desarrollo, agregar `--hmr`: esta opción agrega y restaura una regla temporal en `globals.css`, por lo que no se debe editar ese archivo mientras corre. Sin esa opción también se puede verificar `npm run start` después del build. Capturas y reporte quedan en `.next/ui-qa/`, ignorados por Git.

- [Pantallas, rutas y recorrido](../docs/frontend.md)
- [Modelo de datos propuesto](../docs/modelo-de-datos.md)
- [Decisiones pendientes](../docs/decisiones.md)

Para habilitar el acceso se requiere `.env.local`, la migración de identidad y al menos una cuenta con perfil habilitado. Configuración, alta de cuentas y pruebas: [Autenticación](../docs/autenticacion.md). Las claves y las contraseñas locales quedan fuera de Git. No hay integración de WhatsApp, email ni API de vehículos.
