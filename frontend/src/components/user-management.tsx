"use client";

import { useActionState, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, LockKeyhole, Pencil, Plus, Search, ShieldCheck, Users, X } from "lucide-react";
import { createSeller, updateSeller } from "@/app/(crm)/usuarios/actions";
import type { CurrentAccount } from "@/lib/auth/types";
import { StatusBadge } from "./record-ui";
import { EmptyState, PageHeading, Panel, RequiredMark } from "./ui";
import { sellerFieldErrors, sellerSchema, updateSellerSchema } from "@/lib/auth/validation";

export function UserManagement({ users, available, loadError }: { users: CurrentAccount[]; available: boolean; loadError: boolean }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editor, setEditor] = useState<CurrentAccount | "new" | null>(null);
  const editorTrigger = useRef<HTMLButtonElement>(null);
  function openEditor(value: CurrentAccount | "new", trigger: HTMLButtonElement) {
    editorTrigger.current = trigger;
    setEditor(value);
  }
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  const filtered = users.filter((user) => normalize(`${user.full_name} ${user.email} ${user.contact_email ?? ""} ${user.contact_phone ?? ""}`).includes(normalize(search.trim())) && (!status || user.is_enabled === (status === "enabled")));
  return <>
    <PageHeading eyebrow="ADMINISTRACIÓN" title="Usuarios" description="Las personas de tu equipo y su acceso a Pelucars." action={<button type="button" className="button primary" onClick={(event) => openEditor("new", event.currentTarget)} disabled={!available}><Plus size={17} />Crear vendedor</button>} />
    {!available && !loadError && <p className="form-feedback users-notice" role="status">El alta de cuentas todavía no está configurada.</p>}
    <Panel title="Equipo" description={loadError ? "Cuentas de acceso al sistema." : `${users.length} ${users.length === 1 ? "cuenta" : "cuentas"} · ${users.filter((user) => user.role === "seller").length} vendedores`}>
      {loadError ? <p className="panel-body form-feedback error" role="alert">No pudimos consultar las cuentas. Volvé a cargar la página para reintentar.</p> : <>
        <div className="filter-bar users-filters">
          <label className="search-field"><Search size={18} /><input type="search" aria-label="Buscar usuarios" placeholder="Buscar por nombre, correo o teléfono…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <select aria-label="Filtrar por acceso" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos los accesos</option><option value="enabled">Habilitados</option><option value="disabled">Deshabilitados</option></select>
        </div>
        {filtered.length ? <table className="users-table">
          <caption className="sr-only">Cuentas del equipo, rol y estado de acceso</caption>
          <thead><tr><th scope="col">Usuario</th><th scope="col">Rol</th><th scope="col">Contacto</th><th scope="col">Acceso</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody>{filtered.map((user) => <tr key={user.id}>
            <td><div className="user-identity"><span className={`user-avatar ${user.role === "admin" ? "is-admin" : ""}`} aria-hidden="true">{user.role === "admin" ? <ShieldCheck size={19} /> : user.full_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span><div><h3>{user.full_name}</h3><p>{user.email}</p></div></div></td>
            <td data-label="Rol"><span className="user-role">{user.role === "admin" ? "Administrador" : "Vendedor"}</span></td>
            <td data-label="Contacto"><div className="user-contact"><span className={user.contact_phone ? "user-phone" : "user-missing"}>{user.contact_phone ?? "Sin teléfono"}</span><span className={user.contact_email ? "user-contact-email" : "user-missing"}>{user.contact_email ?? "Sin correo de contacto"}</span>{user.role === "seller" && (!user.contact_phone || !user.contact_email) && <span className="user-contact-pending">Completar al editar</span>}</div></td>
            <td data-label="Acceso"><StatusBadge tone={user.is_enabled ? "neutral" : "accent"}>{user.is_enabled ? "Habilitado" : "Deshabilitado"}</StatusBadge></td>
            <td className="user-row-action">{user.role === "seller" ? <button type="button" className="button secondary" aria-label={`Editar a ${user.full_name}`} onClick={(event) => openEditor(user, event.currentTarget)}><Pencil size={14} />Editar</button> : <span className="user-protected"><LockKeyhole size={14} />Protegido</span>}</td>
          </tr>)}</tbody>
        </table> : <EmptyState icon={Users} compact title={users.length ? "No encontramos coincidencias" : "Todavía no hay usuarios para mostrar"} description={users.length ? "Probá con otro nombre o cambiá el filtro de acceso." : "Las cuentas del equipo aparecerán en este listado."}>{!!users.length && <button type="button" className="button secondary" onClick={() => { setSearch(""); setStatus(""); }}>Limpiar filtros</button>}</EmptyState>}
        <div className="panel-footer users-footer"><span role="status">{filtered.length} de {users.length} cuentas</span><span><LockKeyhole size={13} /> Las cuentas de administrador se gestionan mediante un alta controlada.</span></div>
      </>}
    </Panel>
    {editor !== null && <UserEditor user={editor === "new" ? undefined : editor} onClose={() => { setEditor(null); editorTrigger.current?.focus(); }} />}
  </>;
}

function UserEditor({ user, onClose }: { user?: CurrentAccount; onClose: () => void }) {
  const [state, action, pending] = useActionState(user ? updateSeller : createSeller, {});
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const accessId = useId();
  const form = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({ full_name: user?.full_name ?? "", contact_phone: user?.contact_phone ?? "", contact_email: user?.contact_email ?? "", email: "", password: "" });
  const [isEnabled, setIsEnabled] = useState(user?.is_enabled ?? true);
  const [localErrors, setLocalErrors] = useState<Record<string, string> | null>(null);
  const errors = localErrors ?? state.fieldErrors ?? {};
  function change(name: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setLocalErrors((current) => ({ ...(current ?? state.fieldErrors ?? {}), [name]: "" }));
  }
  function validate(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const result = user ? updateSellerSchema.safeParse({ ...Object.fromEntries(data), is_enabled: data.get("is_enabled") === "on" }) : sellerSchema.safeParse(Object.fromEntries(data));
    if (!result.success) {
      event.preventDefault();
      const fields = sellerFieldErrors(result.error);
      setLocalErrors(fields);
      const field = event.currentTarget.elements.namedItem(Object.keys(fields)[0]);
      if (field instanceof HTMLElement) field.focus();
    } else setLocalErrors(null);
  }
  useEffect(() => {
    if (state.fieldErrors) {
      const field = form.current?.elements.namedItem(Object.keys(state.fieldErrors)[0]);
      if (field instanceof HTMLElement) field.focus();
    }
  }, [state]);
  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    element?.querySelector<HTMLInputElement>('input[name="full_name"]')?.focus({ preventScroll: true });
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  function close() {
    if (pending) return;
    dialog.current?.close();
    onClose();
  }
  return <dialog ref={dialog} className="user-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); close(); }}>
    <header className="user-dialog-heading">
      <span className="user-dialog-icon" aria-hidden="true">{user ? <Pencil size={21} /> : <Users size={23} />}</span>
      <div><p className="eyebrow">EQUIPO · VENDEDOR</p><h2 id={titleId}>{user ? "Editar vendedor" : "Crear vendedor"}</h2><p>{user ? user.full_name : "Una nueva cuenta para tu equipo comercial."}</p></div>
      <button type="button" className="user-dialog-close" aria-label="Cerrar formulario" onClick={close} disabled={pending}><X size={20} /></button>
    </header>
    {state.success ? <div className="user-editor-success"><CheckCircle2 size={32} aria-hidden="true" /><h3>{user ? "Cambios guardados" : "Cuenta creada"}</h3><p role="status">{state.success}</p><button type="button" className="button primary" onClick={close}>Volver al equipo</button></div> : <form ref={form} action={action} onSubmit={validate} noValidate className="user-editor-form" aria-busy={pending}>
      {user && <input type="hidden" name="id" value={user.id} />}
      <p className="user-required-note"><RequiredMark /> Campos obligatorios.</p>
      <fieldset className="user-form-section" disabled={pending}>
        <legend><span>01</span> Datos personales</legend>
        <div className="form-grid">
          <SellerField name="full_name" label="Nombre completo" value={values.full_name} onChange={change} error={errors.full_name} placeholder="Nombre y apellido" minLength={2} maxLength={120} />
          <SellerField name="contact_phone" label="Teléfono de contacto" type="tel" value={values.contact_phone} onChange={change} error={errors.contact_phone} placeholder="Formato internacional: +54…" maxLength={16} help="Con +, código de país y número, sin espacios." />
          <SellerField name="contact_email" label="Correo de contacto" type="email" value={values.contact_email} onChange={change} error={errors.contact_email} placeholder="Correo que consulta el vendedor" maxLength={254} help="Puede ser personal o laboral, y coincidir con el correo de acceso. No cambia sus credenciales." fullWidth />
        </div>
      </fieldset>
      <fieldset className="user-form-section" disabled={pending}>
        <legend><span>02</span> Acceso al sistema</legend>
        <div className="form-grid">
          {user ? <>
            <div className="user-email-summary full-width"><LockKeyhole size={16} aria-hidden="true" /><div><span>Correo de acceso</span><strong>{user.email}</strong><p>El correo y el rol no se modifican desde este formulario.</p></div></div>
            <label className="check-field full-width">
              <input type="checkbox" name="is_enabled" checked={isEnabled} onChange={(event) => setIsEnabled(event.target.checked)} aria-labelledby={`${accessId}-title`} aria-describedby={`${accessId}-help`} />
              <span className="check-field-copy"><span className="check-field-title" id={`${accessId}-title`}>Cuenta habilitada</span><span className="field-help" id={`${accessId}-help`}>Permite ingresar al sistema. Al deshabilitarla se conserva el historial y no se reasignan oportunidades. El cambio se aplica al guardar.</span></span>
            </label>
          </> : <>
            <SellerField name="email" label="Correo de acceso" type="email" value={values.email} onChange={change} error={errors.email} placeholder="nombre@correo.com" maxLength={254} />
            <SellerField name="password" label="Contraseña inicial" type="password" value={values.password} onChange={change} error={errors.password} placeholder="Al menos 12 caracteres" minLength={12} maxLength={128} help="Entregala por un medio privado." />
            <p className="user-access-note full-width"><ShieldCheck size={17} aria-hidden="true" /><span>La cuenta se crea habilitada, con rol de vendedor. No se envía un correo de invitación.</span></p>
          </>}
        </div>
      </fieldset>
      {state.error && <p className="form-feedback error user-editor-feedback" role="alert">{state.error}</p>}
      <footer className="user-editor-actions"><button type="button" className="button secondary" onClick={close} disabled={pending}>Cancelar</button><button type="submit" className="button primary" disabled={pending}>{pending ? (user ? "Guardando…" : "Creando…") : (user ? "Guardar cambios" : "Crear vendedor")}</button></footer>
    </form>}
  </dialog>;
}

type SellerFieldName = "full_name" | "contact_phone" | "contact_email" | "email" | "password";
function SellerField({ name, label, type = "text", value, onChange, error, placeholder, help, minLength, maxLength, fullWidth = false }: {
  name: SellerFieldName; label: string; type?: "text" | "tel" | "email" | "password"; value: string;
  onChange: (name: SellerFieldName, value: string) => void; error?: string; placeholder: string; help?: string;
  minLength?: number; maxLength: number; fullWidth?: boolean;
}) {
  const id = useId();
  return <label className={fullWidth ? "full-width" : undefined}>
    <span>{label} <RequiredMark /></span>
    <input name={name} type={type} value={value} onChange={(event) => onChange(name, event.target.value)} required minLength={minLength} maxLength={maxLength} placeholder={placeholder} autoComplete={type === "password" ? "new-password" : "off"} aria-invalid={!!error} aria-describedby={[help ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined} />
    {help && <span className="field-help" id={`${id}-help`}>{help}</span>}
    {error && <span className="field-error" id={`${id}-error`} role="alert">{error}</span>}
  </label>;
}
