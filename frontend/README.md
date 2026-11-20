# Pelucars · Frontend

Interfaz interna en español para oportunidades, clientes e inventario, conectada a Supabase junto con autenticación y administración de vendedores.

Desde este directorio:

```text
npm run dev
```

Abrir la URL local indicada por Next.js. En Windows PowerShell, si la política bloquea `npm.ps1`, usar `npm.cmd run dev`.

La navegación ofrece Oportunidades, Clientes y Vehículos reales. El rol proviene de la cuenta autenticada. Administradores gestionan Usuarios, inventario y responsables de oportunidades. Vendedores toman consultas en espera (sin tope provisional para la demo), gestionan estados de las propias y consultan inventario. La bandeja de espera oculta identidad e intención hasta la asignación. Las ventas siguen pendientes.

`src/lib/demo-data.ts` conserva las muestras de etapas anteriores fuera de las rutas activas. El panel consulta Supabase, donde se autorizaron [cinco clientes y siete oportunidades de prueba](../docs/pruebas-crm.md) para validar el circuito sin bot. La carga es explícita, no se ejecuta al iniciar ni desplegar. Ver [CRM](../docs/crm.md) para alcance y permisos.

Vehículos filtra al escribir y al cambiar stock, catálogo, año o transmisión, sin recarga completa. Las fichas conservan los filtros para mostrar unidades coincidentes. Cada unidad nueva recibe un código interno automático; los códigos existentes permanecen iguales. La referencia de una futura API externa se definirá aparte.

También permite filtrar precio mínimo/máximo en ARS o USD, sin mezclar monedas ni convertir importes. El widget de cotización y conversor USD/ARS permanece como propuesta pendiente de definir con el cliente.

Verificaciones:

```text
npm run lint
npm run typecheck
npm run build
npm run test:auth
npm run test:inventory
npm run test:crm
```

La interfaz usa CSS nativo de Next.js. Después de actualizar desde la primera entrega, reiniciar una vez el servidor de desarrollo para que tome el cambio de `next.config.ts`.

Con el servidor local iniciado, se puede ejecutar la revisión de filas, fichas y navegación en Chrome/Chromium (también admite Edge):

```text
npm run check:ui -- http://127.0.0.1:3000
npm run check:ui -- http://127.0.0.1:3000 --crm
npm run check:ui -- http://127.0.0.1:3000 --inventory
```

Usar la URL y el puerto del servidor. El recorrido predeterminado (`--crm`) revisa bandejas, fichas existentes y validación de motivo obligatorio con la cuenta administradora de `frontend/.env.demo.local`, sin guardar cambios; `--inventory` revisa catálogo y formularios sin guardar. `--public-only` comprueba login y rutas cerradas sin cuentas reales. `CHROME_BIN` permite indicar el ejecutable si no se detecta automáticamente. Admite desarrollo o `npm run start` después del build. Capturas y reporte quedan en `.next/ui-qa/`, ignorados por Git.

- [Pantallas, rutas y recorrido](../docs/frontend.md)
- [Modelo de datos propuesto](../docs/modelo-de-datos.md)
- [Decisiones pendientes](../docs/decisiones.md)

Para habilitar el acceso se requiere `.env.local`, la migración de identidad y al menos una cuenta con perfil habilitado. Configuración, alta de cuentas y pruebas: [Autenticación](../docs/autenticacion.md). Las claves y las contraseñas locales quedan fuera de Git. No hay integración de WhatsApp, email ni API de vehículos.
