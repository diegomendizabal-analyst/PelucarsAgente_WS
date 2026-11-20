# Pelucars · Frontend

Interfaz interna en español para oportunidades, clientes e inventario. Autenticación, administración de vendedores y catálogo/inventario conectados a Supabase. Oportunidades y clientes conservan su muestra ficticia local.

Desde este directorio:

```text
npm run dev
```

Abrir la URL local indicada por Next.js. En Windows PowerShell, si la política bloquea `npm.ps1`, usar `npm.cmd run dev`.

La navegación ofrece Oportunidades y Clientes de ejemplo, y **Vehículos** con datos reales de Supabase. El rol proviene de la cuenta autenticada. Administradores gestionan **Usuarios** y el inventario: ficha por marca/modelo y unidades físicas con sus características, precio y disponibilidad. Vendedores consultan el inventario sin editar. Las operaciones de oportunidades y ventas siguen pendientes.

`src/lib/demo-data.ts` conserva los ejemplos de clientes, oportunidades e historial, incluidos sus intereses ficticios. No se importan al inventario real ni se ejecuta seed. El catálogo conectado muestra los vehículos cargados por el usuario.

Vehículos filtra al escribir y al cambiar stock, catálogo, año o transmisión, sin recarga completa. Las fichas conservan los filtros para mostrar unidades coincidentes. Cada unidad nueva recibe un código interno automático; los códigos existentes permanecen iguales. La referencia de una futura API externa se definirá aparte.

También permite filtrar precio mínimo/máximo en ARS o USD, sin mezclar monedas ni convertir importes. El widget de cotización y conversor USD/ARS permanece como propuesta pendiente de definir con el cliente.

Verificaciones:

```text
npm run lint
npm run typecheck
npm run build
npm run test:auth
npm run test:inventory
```

La interfaz usa CSS nativo de Next.js. Después de actualizar desde la primera entrega, reiniciar una vez el servidor de desarrollo para que tome el cambio de `next.config.ts`.

Con el servidor local iniciado, se puede ejecutar la revisión de filas, fichas y navegación en Chrome/Chromium (también admite Edge):

```text
npm run check:ui -- http://127.0.0.1:3000
npm run check:ui -- http://127.0.0.1:3000 --inventory
```

Usar la URL y el puerto del servidor. El recorrido completo necesita las cuentas de `frontend/.env.demo.local`; `--public-only` comprueba login y rutas cerradas sin cuentas reales. `CHROME_BIN` permite indicar el ejecutable si no se detecta automáticamente. Para comprobar también las actualizaciones de CSS en desarrollo, agregar `--hmr`: esta opción agrega y restaura una regla temporal en `globals.css`, por lo que no se debe editar ese archivo mientras corre. Sin esa opción también se puede verificar `npm run start` después del build. Capturas y reporte quedan en `.next/ui-qa/`, ignorados por Git.

- [Pantallas, rutas y recorrido](../docs/frontend.md)
- [Modelo de datos propuesto](../docs/modelo-de-datos.md)
- [Decisiones pendientes](../docs/decisiones.md)

Para habilitar el acceso se requiere `.env.local`, la migración de identidad y al menos una cuenta con perfil habilitado. Configuración, alta de cuentas y pruebas: [Autenticación](../docs/autenticacion.md). Las claves y las contraseñas locales quedan fuera de Git. No hay integración de WhatsApp, email ni API de vehículos.
