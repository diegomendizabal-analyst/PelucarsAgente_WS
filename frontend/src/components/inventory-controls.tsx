"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, Pencil, Plus, X } from "lucide-react";
import { archiveVehicle, saveUnit, saveVehicle } from "@/app/(crm)/vehiculos/actions";
import { inventoryFieldErrors, unitSchema, vehicleSchema } from "@/lib/inventory/validation";
import { unitPrice, unitStatus, type InventoryUnit, type Vehicle } from "@/lib/inventory/types";
import { RequiredMark } from "./ui";

function Field({ label, required = false, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
  return <label><span>{label} {required && <RequiredMark />}</span>{children}{error && <span className="field-error" role="alert">{error}</span>}</label>;
}
function focusInvalid(form: HTMLFormElement, errors: Record<string, string>) {
  const input = form.elements.namedItem(Object.keys(errors)[0]);
  if (input instanceof HTMLElement) input.focus();
}

export function CatalogForm({ vehicle }: { vehicle?: Vehicle }) {
  const [state, action, pending] = useActionState(saveVehicle, {});
  const [values, setValues] = useState({ brand: vehicle?.brand ?? "", model: vehicle?.model ?? "" });
  const [localErrors, setLocalErrors] = useState<Record<string, string> | null>(null);
  const errors = localErrors ?? state.fieldErrors ?? {};
  function validate(event: FormEvent<HTMLFormElement>) {
    const parsed = vehicleSchema.safeParse(values);
    if (!parsed.success) { event.preventDefault(); const fields = inventoryFieldErrors(parsed.error); setLocalErrors(fields); focusInvalid(event.currentTarget, fields); }
    else setLocalErrors(null);
  }
  if (state.success && state.id) return <div className="inventory-success" role="status"><CheckCircle2 size={30} /><h2>{state.success}</h2><Link className="button primary" href={`/vehiculos/${state.id}`}>Ir a la ficha del vehículo</Link></div>;
  return <form action={action} onSubmit={validate} noValidate className="panel-body form-grid inventory-form" aria-busy={pending}>
    {vehicle && <><input type="hidden" name="id" value={vehicle.id} /><input type="hidden" name="updated_at" value={vehicle.updated_at} /></>}
    <p className="field-help full-width"><RequiredMark /> Campos obligatorios. El precio, año y versión se cargan después en cada unidad.</p>
    {(["brand", "model"] as const).map((name) => <Field key={name} label={name === "brand" ? "Marca" : "Modelo"} required error={errors[name]}><input name={name} required maxLength={name === "brand" ? 80 : 120} value={values[name]} onChange={(event) => { setValues({ ...values, [name]: event.target.value }); setLocalErrors({ ...errors, [name]: "" }); }} aria-invalid={!!errors[name]} disabled={pending} placeholder={name === "brand" ? "Ingresá la marca" : "Ingresá el modelo"} autoComplete="off" /></Field>)}
    {state.error && <p className="form-feedback error full-width" role="alert">{state.error}</p>}
    <div className="form-actions full-width"><Link className="button secondary" href={vehicle ? `/vehiculos/${vehicle.id}` : "/vehiculos"}>Volver</Link><button className="button primary" disabled={pending}>{pending ? "Guardando…" : vehicle ? "Guardar cambios" : "Crear vehículo"}</button></div>
  </form>;
}

export function UnitList({ vehicle, units, admin, filtered = false, budgetCurrency }: { vehicle: Vehicle; units: InventoryUnit[]; admin: boolean; filtered?: boolean; budgetCurrency?: "ARS" | "USD" }) {
  const [selected, setSelected] = useState<InventoryUnit | "new" | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  function open(value: InventoryUnit | "new", button: HTMLButtonElement) { trigger.current = button; setSelected(value); }
  const editable = admin && !vehicle.archived_at;
  return <>
    <div className="panel-heading"><div><h2>Unidades del inventario</h2><p>Cada unidad tiene su propio precio y estado. Sólo las disponibles cuentan como stock.</p></div>{editable && <button className="button primary" onClick={(event) => open("new", event.currentTarget)}><Plus size={16} />Agregar unidad</button>}</div>
    {units.length === 0 ? <div className="empty-state compact"><h3>{filtered ? "No hay unidades que coincidan" : vehicle.units_count ? "No hay unidades en esta página" : "Todavía no hay unidades"}</h3><p>{filtered ? "Podés quitar los filtros para consultar todo el inventario de esta ficha." : vehicle.units_count ? "Volvé a la página anterior para consultar las unidades registradas." : editable ? "Agregá el primer auto para registrar sus características y disponibilidad." : "Este modelo está en el catálogo, pero todavía no tiene unidades registradas."}</p></div> : <div className="inventory-units">{units.map((unit) => <article key={unit.id} className="inventory-unit">
      <div className="inventory-unit-top"><div><h3>{unit.version ?? "Versión sin informar"} <span>· {unit.model_year ?? "Año sin informar"}</span></h3><p>Código interno <strong>{unit.internal_code}</strong></p></div><span className={`inventory-status ${unit.status}`}>{unitStatus[unit.status]}</span></div>
      <dl className="inventory-unit-data"><div><dt>Precio publicado</dt><dd className="inventory-price">{unitPrice(unit)}</dd>{budgetCurrency && unit.currency !== budgetCurrency && unit.equivalent_price != null && <dd className="inventory-equivalent">≈ {unitPrice({listed_price:unit.equivalent_price,currency:budgetCurrency})}</dd>}</div><div><dt>Kilometraje</dt><dd>{unit.mileage_km === null ? "Sin informar" : `${unit.mileage_km.toLocaleString("es-AR")} km`}</dd></div><div><dt>Transmisión</dt><dd>{unit.transmission ?? "Sin informar"}</dd></div><div><dt>Ingreso</dt><dd>{unit.received_at ? unit.received_at.split("-").reverse().join("/") : "Sin informar"}</dd></div></dl>
      {editable && unit.status !== "sold" && <footer><button className="button secondary" aria-label={`Editar unidad ${unit.internal_code}`} onClick={(event) => open(unit, event.currentTarget)}><Pencil size={14} />Editar unidad</button></footer>}
    </article>)}</div>}
    {selected !== null && <UnitEditor vehicle={vehicle} unit={selected === "new" ? undefined : selected} onClose={() => { setSelected(null); trigger.current?.focus(); }} />}
  </>;
}

function UnitEditor({ vehicle, unit, onClose }: { vehicle: Vehicle; unit?: InventoryUnit; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(saveUnit, {});
  const [values, setValues] = useState({ model_year: unit?.model_year?.toString() ?? "",
    version: unit?.version ?? "", transmission: unit?.transmission ?? "", mileage_km: unit?.mileage_km?.toString() ?? "",
    listed_price: unit?.listed_price?.toString() ?? "", currency: unit?.currency ?? "", status: unit?.status ?? "available", received_at: unit?.received_at ?? "" });
  const [localErrors, setLocalErrors] = useState<Record<string, string> | null>(null);
  const errors = localErrors ?? state.fieldErrors ?? {};
  useEffect(() => { const element = dialog.current; const previous = document.body.style.overflow; element?.showModal(); element?.querySelector<HTMLInputElement>('input[name="version"]')?.focus({ preventScroll: true }); document.body.style.overflow = "hidden"; return () => { element?.close(); document.body.style.overflow = previous; }; }, []);
  function close() { if (!pending) { dialog.current?.close(); onClose(); } }
  function change(name: keyof typeof values, value: string) { setValues((current) => ({ ...current, [name]: value })); setLocalErrors({ ...errors, [name]: "" }); }
  function validate(event: FormEvent<HTMLFormElement>) {
    const parsed = unitSchema.safeParse(values);
    if (!parsed.success) { event.preventDefault(); const fields = inventoryFieldErrors(parsed.error); setLocalErrors(fields); focusInvalid(event.currentTarget, fields); }
    else setLocalErrors(null);
  }
  return <dialog ref={dialog} className="inventory-dialog" aria-labelledby="unit-editor-title" onCancel={(event) => { event.preventDefault(); close(); }}>
    <header><div><p className="eyebrow">{vehicle.brand} · {vehicle.model}</p><h2 id="unit-editor-title">{unit ? "Editar unidad" : "Agregar unidad"}</h2><p>Datos del auto y disponibilidad en el inventario.</p></div><button className="inventory-close" type="button" aria-label="Cerrar formulario de unidad" onClick={close} disabled={pending}><X size={20} /></button></header>
    {state.success ? <div className="inventory-success" role="status"><CheckCircle2 size={30} /><h3>{state.success}</h3><button className="button primary" onClick={close}>Volver al inventario</button></div> : <form action={action} onSubmit={validate} noValidate className="inventory-form" aria-busy={pending}>
      <input type="hidden" name="vehicle_id" value={vehicle.id} />{unit && <><input type="hidden" name="id" value={unit.id} /><input type="hidden" name="updated_at" value={unit.updated_at} /></>}
      <fieldset disabled={pending} className="panel-body form-grid">
        <p className="field-help full-width"><RequiredMark /> Campos obligatorios. Podés completar las características y el precio más adelante.</p>
        <Field label="Versión" error={errors.version}><input name="version" maxLength={120} placeholder="Versión, si se conoce" value={values.version} onChange={(event) => change("version", event.target.value)} aria-invalid={!!errors.version} /></Field>
        <Field label="Año" error={errors.model_year}><input name="model_year" inputMode="numeric" maxLength={4} placeholder="Año de cuatro cifras" value={values.model_year} onChange={(event) => change("model_year", event.target.value)} aria-invalid={!!errors.model_year} /></Field>
        <Field label="Transmisión" error={errors.transmission}><select name="transmission" value={values.transmission} onChange={(event) => change("transmission", event.target.value)} aria-invalid={!!errors.transmission}><option value="">Sin informar</option><option value="Manual">Manual</option><option value="Automática">Automática</option><option value="Otra">Otra</option>{unit?.transmission && !["Manual", "Automática", "Otra"].includes(unit.transmission) && <option value={unit.transmission}>{unit.transmission} (dato existente)</option>}</select></Field>
        <Field label="Kilometraje" error={errors.mileage_km}><input name="mileage_km" inputMode="numeric" maxLength={10} placeholder="Kilómetros, sin separadores" value={values.mileage_km} onChange={(event) => change("mileage_km", event.target.value)} aria-invalid={!!errors.mileage_km} /></Field>
        <Field label="Precio publicado" required={!!values.currency} error={errors.listed_price}><input name="listed_price" inputMode="decimal" maxLength={15} placeholder="Importe sin separadores de miles" value={values.listed_price} onChange={(event) => change("listed_price", event.target.value)} required={!!values.currency} aria-invalid={!!errors.listed_price} /></Field>
        <Field label="Moneda" required={!!values.listed_price} error={errors.currency}><select name="currency" value={values.currency} required={!!values.listed_price} onChange={(event) => change("currency", event.target.value)} aria-invalid={!!errors.currency}><option value="">Sin informar</option><option value="ARS">ARS · Peso argentino</option><option value="USD">USD · Dólar estadounidense</option></select></Field>
        <p className="field-help full-width">Precio y moneda se completan juntos. Si se desconocen, dejá ambos vacíos.</p>
        <Field label="Estado" required error={errors.status}><select name="status" required value={values.status} onChange={(event) => change("status", event.target.value)}><option value="available">Disponible</option><option value="withdrawn">Retirada del stock</option></select></Field>
        <Field label="Fecha de ingreso" error={errors.received_at}><input name="received_at" type="date" value={values.received_at} onChange={(event) => change("received_at", event.target.value)} aria-invalid={!!errors.received_at} /></Field>
        <p className="field-help full-width">Retirar una unidad la excluye del stock sin borrar su historial. Las ventas se registrarán desde el módulo comercial.</p>
        {state.error && <p className="form-feedback error full-width" role="alert">{state.error}</p>}
      </fieldset>
      <footer className="inventory-form-actions"><button className="button secondary" type="button" onClick={close} disabled={pending}>Cancelar</button><button className="button primary" disabled={pending}>{pending ? "Guardando…" : unit ? "Guardar cambios" : "Agregar unidad"}</button></footer>
    </form>}
  </dialog>;
}

export function ArchiveControl({ vehicle }: { vehicle: Vehicle }) {
  const [state, action, pending] = useActionState(archiveVehicle, {});
  const [confirm, setConfirm] = useState(false);
  const archived = !!vehicle.archived_at;
  return <section className="inventory-archive"><div><h2>{archived ? "Restaurar ficha" : "Baja del catálogo"}</h2><p>{archived ? "La ficha volverá al listado activo. Las unidades conservarán su estado." : "Conserva la ficha y sus unidades. Primero deben retirarse las unidades disponibles."}</p></div>
    {!confirm ? <button className="button secondary" disabled={!archived && vehicle.available_count > 0} onClick={() => setConfirm(true)}>{archived ? "Restaurar vehículo" : "Dar de baja"}</button> : <form action={action}><input type="hidden" name="id" value={vehicle.id} /><input type="hidden" name="updated_at" value={vehicle.updated_at} /><input type="hidden" name="archived" value={String(!archived)} />
      {state.success ? <p role="status">{state.success}</p> : <><p>¿Confirmás {archived ? "restaurar" : "dar de baja"} {vehicle.brand} {vehicle.model}?</p><div className="inventory-confirm-actions"><button className="button secondary" type="button" disabled={pending} onClick={() => setConfirm(false)}>Cancelar</button><button className="button primary" disabled={pending}>{pending ? "Guardando…" : "Confirmar"}</button></div>{state.error && <p className="field-error" role="alert">{state.error}</p>}</>}
    </form>}
  </section>;
}
