# Datos persistentes para probar el CRM

El 20/11/2026 el usuario autorizó cargar ejemplos en Supabase para probar sin depender del bot. Esto **no habilita el alta manual de clientes u oportunidades desde el panel**, que sigue pendiente de revisar con el alcance.

**Actualización 24/11:** se agregó una carga aditiva de Reportes en `supabase/demo/reports.sql`, sin reiniciar ni sobrescribir la muestra inicial. El interruptor temporal alterna muestras/vacío, controlado por servidor. Ver [demo-temporal.md](demo-temporal.md). No usar el reset descrito más abajo para este incremento; se conserva como procedimiento histórico y no incluye la nueva carga.

La migración `20261120150439_crm_demo_source.sql` permite `leads.source = 'demo'` además de `whatsapp_bot`. La carga vive separada en `supabase/demo/crm.sql`; no forma parte de las migraciones ni se ejecuta al iniciar la aplicación.

## Muestra inicial

| Cliente ficticio | Oportunidad | Estado inicial | Responsable inicial |
| --- | --- | --- | --- |
| DEMO · Lucía Torres | Sedán automático desde 2020 | Nueva consulta recurrente | Administrador Demo, por consulta anterior |
| DEMO · Mateo Rivas | Compacto para uso diario | Nueva consulta recurrente | Vendedor de su consulta anterior |
| DEMO · Paula Méndez | Modelo existente del catálogo, si hay uno activo | En seguimiento | Administrador Demo |
| DEMO · Mateo Rivas | Camioneta diésel desde 2018 | En espera de stock | Primer vendedor habilitado existente |
| DEMO · Lucía Torres | Búsqueda anterior de auto familiar | Perdido, con motivo | Administrador Demo |
| DEMO · Clara Silva | Primer auto manual | Nueva consulta | Sin asignar |
| DEMO · Nicolás Vega | SUV automático familiar | Nueva consulta | Sin asignar |

Si no hay vendedor habilitado, la cuarta consulta queda a cargo del administrador. La carga nunca habilita ni crea cuentas. El vínculo al catálogo no crea vehículos, unidades ni modifica stock.

Cinco clientes, siete consultas, siete intereses y eventos iniciales de asignación/estado. Los históricos se insertan antes de los retornos para ejercitar la regla de recurrencia real. Quedan dos avisos sin leer, por los retornos de Lucía y Mateo; los avisos históricos se marcan leídos. Los nombres llevan `DEMO`, los resúmenes aclaran que son ficticios y los teléfonos pertenecen al bloque de ejemplo `+1 202 555 01xx`. No se inventan conversaciones, score, actividades ni ventas. Las fechas relativas se fijan al cargar/reiniciar, no cambian al refrescar la página.

## Cómo probar

1. Como administrador, abrir **Oportunidades → En espera** y luego **Mis oportunidades** o **Todas las oportunidades**.
2. Abrir a Paula para revisar datos, interés vinculado e historial. Cambiar el estado o reasignarla; el evento debe quedar guardado.
3. Abrir **Clientes → DEMO · Lucía Torres**: hay una consulta anterior perdida y una nueva asignada al mismo responsable. Revisar la campana: el aviso abre esa ficha y queda leído. Mateo conserva de igual forma a su vendedor anterior.
4. Con un vendedor habilitado, abrir **En espera**: sólo identificador, ingreso/espera y Sin asignar. **Tomar oportunidad** debe abrir el detalle y moverla a **Mis oportunidades**. Al reasignarla, el anterior pierde acceso a nuevas lecturas.
5. Probar Perdido sin motivo (debe rechazarlo) y con motivo (cierra y registra). Las consultas perdidas no pueden reabrirse en esta etapa.

Las operaciones sobre estas muestras **se guardan realmente** y cambian la distribución de las bandejas. Las pestañas abiertas necesitan **Actualizar** cuando otro usuario realiza cambios.

## Comandos explícitos

Desde la raíz, con las credenciales locales ya configuradas:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/supabase-admin.ps1 -Action LoadCrmDemo
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/supabase-admin.ps1 -Action ResetCrmDemo
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/supabase-admin.ps1 -Action CrmDemoStatus
```

En Windows, desde `frontend/`, los atajos son `npm run demo:load` y **`npm run demo:reset`**.

`LoadCrmDemo` agrega los ejemplos faltantes sin sobrescribir ediciones. **`ResetCrmDemo` elimina las pruebas hechas sobre los siete UUID de demo y sus intereses, historiales y avisos, y reconstruye el escenario inicial**. No toca vehículos ni perfiles. Valida UUID, origen demo, clientes/teléfonos y ausencia de oportunidades ajenas vinculadas antes de borrar; las claves foráneas adicionales también bloquean un reinicio incompatible. Todo ocurre en una transacción con bloqueo. Los UUID quedan estables; las referencias OP siguen su secuencia, sin reiniciarla globalmente. No se ejecuta automáticamente al desplegar. Antes de integrar contactos reales, revisar y retirar explícitamente estas muestras; no deben entrar en automatizaciones comerciales.

`TestCrmSeed` ensaya reset e idempotencia en una transacción con rollback y verifica que inventario/cuentas no cambien. `TestCrmRecurrence` prueba responsables históricos, deshabilitación y avisos por destinatario. `check:ui -- ... --crm --notifications` abre un aviso real de demo; ejecutar ResetCrmDemo después para dejarlo nuevamente sin leer.

La revisión visual `check:ui -- ... --crm` recorre filas y fichas existentes en modo lectura, incluyendo estas muestras. Las escrituras y RLS se comprueban con `TestCrm`, cuyos datos aislados se revierten.
