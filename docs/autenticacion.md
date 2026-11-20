# Acceso y usuarios — primera etapa de backend

19/11/2026. Rama de trabajo: `backend-auth-usuarios`. Esta etapa está autorizada por el pedido de implementar login, usuarios de demo y comenzar la base en Supabase; reemplaza el límite de frontend exclusivamente visual para estas funciones.

## Flujo implementado

- `/login`: correo y contraseña mediante Supabase Auth. No hay registro público en la aplicación.
- Sesión SSR con `@supabase/ssr`, cookies HttpOnly, SameSite=Lax y Secure en producción; sin tokens en localStorage. El proxy renueva cookies y marca respuestas privadas/no-store. Desde la optimización del 20/11 el servidor verifica firma/vigencia con `getClaims()` y consulta el perfil actual en cada render/acción/ruta; no autoriza con `user_metadata` ni con claims de rol. El perfil se deduplica sólo dentro del render. El proxy conserva el rechazo previo al streaming para rutas exclusivas de admin; en las demás se evita una segunda consulta de perfil. No hay caché compartida de cuentas o permisos. Se comprobó el rechazo de un JWT válido de un perfil deshabilitado sin cambiar esa cuenta.
- Un perfil inexistente o deshabilitado queda fuera del CRM. Las reglas RLS también comprueban la habilitación vigente, incluso con un JWT anterior.
- `/usuarios`: sólo administradores. Lista nombre, correo de Auth, rol, teléfono/correo de contacto y habilitación. Permite crear vendedores y editar nombre/contacto/habilitación; el correo de acceso y el rol no se editan en esta primera pantalla. Nombre, teléfono y correo de contacto son obligatorios desde la demo; asteriscos rojos y errores por campo, verificados también en servidor.
- El alta crea primero Auth desde el servidor, luego perfil y auditoría en una transacción SQL autenticada. Si falla entre ambos pasos, la cuenta sin perfil no tiene acceso; revisar y conciliar sin borrar automáticamente una identidad cuyo resultado pueda ser incierto.
- El formulario de vendedores no permite modificar administradores. El segundo administrador se incorpora mediante alta controlada, no mediante un registro público o un cambio de rol del navegador.
- Deshabilitar conserva historial y no reasigna oportunidades. Se pone disponibilidad en false. La política operativa de disponibilidad todavía no está implementada.
- Salir revoca la sesión actual y limpia sus cookies. Recuperación por correo, cambio de contraseña autoservicio y cambio de correo quedan para el siguiente incremento; las cuentas de esta demo usan direcciones `.example`, sin bandeja real ni envío de emails.

La presentación usa el rol real. Los incrementos posteriores conectan vehículos/inventario y clientes/oportunidades a Supabase. La bandeja compartida del vendedor sólo recibe tres campos operativos; las oportunidades, relaciones y contadores se restringen al responsable actual o administrador. Ver [frontend.md](frontend.md) y [crm.md](crm.md) para el estado y las pruebas de cada módulo.

## Configuración local

Ejecutar npm desde `frontend/`. Los secretos nunca se agregan al repositorio ni se envían por chat.

1. `frontend/.env.local`: URL del proyecto, clave publicable y `SUPABASE_SECRET_KEY`. Ver plantilla `.env.example`. La secret key se usa sólo para administrar Auth desde el servidor; las consultas y escrituras de perfiles usan el JWT del administrador y las RPC restringidas.
2. `.env.supabase.local` en la raíz: `SUPABASE_ACCESS_TOKEN`, limitado al proyecto y con permisos de base Read/Write. Se usa sólo con herramientas locales, no por Next.js. La CLI puede requerir permisos adicionales de lectura para resolver el proyecto; deben revisarse según el error, sin otorgar acceso global por defecto.
3. Pendiente de permisos en Supabase: deshabilitar los registros públicos en Authentication → Sign In / Providers → Allow new users to sign up. El intento con el token actual devolvió HTTP 403 y el usuario ve el control bloqueado. Un Owner/Administrator del proyecto debe revisar ese ajuste; no es el rol admin del CRM. Mientras tanto, un alta pública no crea perfil ni otorga acceso al CRM. Conservar el proveedor Email para correo/contraseña; desactivar el registro público no deshabilita el alta administrativa.
4. Reiniciar el servidor si cambian las variables.

## Migración y cuentas iniciales

Archivo generado con CLI 3.2.0: `supabase/migrations/20261119144830_identity.sql`. Crea `profiles`, `user_admin_events`, sus permisos, políticas RLS y operaciones restringidas. No incluye seed ni tablas comerciales. Las RPC públicas son invoker; las funciones privilegiadas están en `private`, con search_path vacío, permisos explícitos y comprobación del administrador.

Segunda migración aplicada: `20261119154713_seller_contact_details.sql`. Agrega `profiles.contact_email`, actualiza las RPC y su auditoría, y exige teléfono/correo en nuevas altas y ediciones de vendedores. Conserva los NULL históricos y no cambia habilitaciones ni Auth. Tras completar las cuentas anteriores, una nueva migración validará la restricción histórica `seller_contact_required`. Las pruebas SQL de permisos y alta/edición sin contacto pasaron dentro de una transacción revertida.

Las tablas comerciales se incorporarán por migraciones posteriores, con claves, restricciones, índices y permisos revisados según cada módulo. Orden propuesto: catálogo/unidades; clientes/oportunidades y asignaciones; conversaciones/mensajes/evidencias; seguimiento y compras. Crear estructura no importa datos ni reemplaza automáticamente la muestra visual. No editar migraciones ya aplicadas: cada cambio nuevo lleva su archivo y revisión previa `--dry-run`.

Para recrear un vendedor de demo en otra base, el bootstrap exige `DEMO_SELLER_CONTACT_PHONE` y `DEMO_SELLER_CONTACT_EMAIL` explícitos en el archivo privado de demo antes de crear Auth. No se generan contactos. `check:auth` requiere una cuenta de demo habilitada y con esos datos completos; no lo ejecutar sobre una cuenta incompleta o deshabilitada para evitar cambiar decisiones del administrador.

Desde la raíz, la herramienta carga el token local sin imprimirlo:

```powershell
powershell.exe -NoProfile -File scripts/supabase-admin.ps1 -Action Inspect
powershell.exe -NoProfile -File scripts/supabase-admin.ps1 -Action Apply
powershell.exe -NoProfile -File scripts/supabase-admin.ps1 -Action Test
powershell.exe -NoProfile -File scripts/supabase-admin.ps1 -Action Advisors
```

`Apply` revisa primero el plan de migración y luego aplica las pendientes, registradas por la CLI. `Test` ejecuta pruebas de permisos dentro de una transacción que termina en rollback; sus identidades temporales no quedan guardadas. No ejecutar pruebas contra datos de producción sin revisión.

Desde `frontend/`, una vez aplicada la migración:

```powershell
npm.cmd run users:bootstrap -- --project-ref pkyinqzvmmciqlvfwtxl
```

Crea únicamente las cuentas aprobadas: Administrador Demo (`admin@pelucars.example`) y Vendedor Demo (`vendedor@pelucars.example`). Genera contraseñas aleatorias en `frontend/.env.demo.local`, ignorado por Git. El script no imprime contraseñas ni las reinicia si la cuenta ya existe. Si se interrumpe después del alta de Auth, puede volver a intentar crear su perfil; se detiene ante un perfil preexistente con rol/habilitación diferentes. La confirmación del correo es administrativa para la demo; no constituye verificación de propiedad de una dirección real.

## Verificación

- `npm.cmd run test:auth`: validación de credenciales/formularios y rechazo de campos de privilegios.
- `npm.cmd run check:ui -- http://127.0.0.1:3100 --public-only`: login responsive y redirección de rutas privadas sin sesión.
- `npm.cmd run check:ui -- http://127.0.0.1:3100`: recorrido visual con login real de las cuentas de `.env.demo.local`; ya no alterna un selector de roles.
- `--smoke` reduce ese recorrido a escritorio/móvil y fichas representativas, conservando login/logout, cookies HttpOnly, acceso administrativo por URL, edición del vendedor y rechazo de correo duplicado. `--hmr` verifica además aplicar/revertir CSS sin recargar en desarrollo.
- `npm.cmd run check:auth`: prueba los dos logins contra Supabase, permisos, intento de elevación y deshabilitación con JWT previo. Deshabilita temporalmente al vendedor de demo y restituye su habilitación al terminar; esos cambios quedan auditados.
- `supabase/tests/identity.sql`: anon sin acceso, vendedor sólo propio perfil, metadata sin elevación, RPC administrativas prohibidas al vendedor, escritura directa de rol prohibida, deshabilitación con la misma identidad, lectura de administrador y auditoría.

## Resultado inicial del 19/11/2026 — antes del incremento de contactos

- Proyecto `pkyinqzvmmciqlvfwtxl`: se comprobó que no había tablas públicas. Migración `20261119144830_identity.sql` aplicada y registrada por la CLI, sin seed ni tablas comerciales.
- Creadas las dos cuentas de demo con perfil habilitado, disponibilidad false y evento de bootstrap. Las contraseñas permanecen en `.env.demo.local`, no en esta documentación.
- Pruebas SQL de permisos aprobadas, con rollback de identidades temporales. Advisors no reportó observaciones.
- Comprobaciones reales de Auth/RLS aprobadas: los dos logins, acceso administrativo, prohibición de elevar el rol y bloqueo del perfil con un JWT previo al deshabilitarlo. Vendedor nuevamente habilitado.
- Lint, tipos, build y las tres pruebas de validación local aprobados.
- La revisión inicial en navegador cubrió cuatro anchos sin desbordamiento; detectó un aviso de Next.js por consultar la hora al prerenderizar la sesión. Se corrigió haciendo que el cliente SSR espere la solicitud con `connection()`. La revisión posterior de desarrollo, incluyendo usuarios, completó 47 escenarios sin errores de consola y verificó HMR.
- Build servido localmente: 46 escenarios de escritorio/móvil aprobados sin errores de consola. Se verificaron login/logout de ambos roles, cookies HttpOnly, navegación protegida, edición de vendedor y rechazo de correo duplicado. Se corrigió un error de React al rechazar Usuarios durante el streaming: ahora el proxy rechaza ese acceso antes de renderizar; la acción y la RPC conservan sus comprobaciones independientes.
- Se inspeccionaron capturas de login y administración en escritorio y móvil. Se comprobó que los 19 archivos JS/JSON del bundle de cliente no contienen la clave administrativa, el token personal ni las contraseñas de demo. Los archivos privados y la carpeta temporal de la CLI están ignorados por Git.
- Pendiente: cerrar el registro público en el panel de Supabase. El usuario no puede editar el control y el token actual no puede cambiar esa configuración. La demo y la barrera de perfiles habilitados funcionan mientras se resuelve.

## Verificación del incremento de contactos — 19/11/2026

- Segunda migración aplicada después del dry-run. Consulta de estado: tres perfiles existentes, dos vendedores con contacto pendiente; se conservan sus datos y accesos. La restricción histórica aún no está validada, como se diseñó.
- Prueba SQL transaccional aprobada: alta/edición rechazan contactos faltantes o inválidos; contacto y correo de Auth permanecen separados; permisos, baja y auditoría verificados. Los registros temporales se revirtieron.
- Cuatro pruebas locales de validación aprobadas, incluidas eliminación accidental de obligatorios y normalización de espacios. Lint, tipos y build aprobados.
- Chrome en 1440, 768, 390 y 320 px: listado, modales, errores por campo, conservación de valores, casilla, Escape y foco; sin errores de consola. Asteriscos rojos comprobados también en alta, edición de ejemplo y edición vacía de vehículos. No se enviaron altas ni ediciones de cuentas desde el navegador durante esta revisión.
- Advisors informó `auth_leaked_password_protection` desactivada; revisión pendiente antes de producción. No se modificó configuración de Auth. No se repitió `check:auth` con las cuentas reales incompletas: sus contactos se deben completar explícitamente antes de esa prueba.

No se verificaron dispositivos físicos, otros motores de navegador, expiración prolongada de sesiones ni recuperación por email. No hay despliegue ni tablas comerciales integradas.

Observación técnica pendiente: durante el recorrido de producción, Node emitió `MaxListenersExceededWarning` sobre listeners `close` de `ServerResponse`. Las acciones y el recorrido terminaron correctamente, sin errores del navegador; no se verificó si hay retención de memoria. Investigar con trazas antes del despliegue. No se ocultó la advertencia aumentando el límite de listeners. El ejecutor local de pruebas TypeScript también informa detección de módulos ESM, sin fallas de tests.

Referencias técnicas: [SSR con Supabase](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [alta administrativa de usuarios](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) y [tokens con alcance limitado](https://supabase.com/docs/guides/platform/personal-access-tokens). Se consultaron las habilidades locales `supabase` y `supabase-postgres-best-practices` instaladas a pedido del usuario.
