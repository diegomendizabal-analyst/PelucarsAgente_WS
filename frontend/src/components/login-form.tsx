"use client";

import { useActionState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { login } from "@/app/auth/actions";

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(login, {});
  return <form action={action} className="form-stack login-form">
    <label htmlFor="login-email">Correo electrónico<input id="login-email" name="email" type="email" required autoComplete="username" maxLength={254} placeholder="Tu correo de acceso" disabled={!configured} /></label>
    <label htmlFor="login-password">Contraseña<input id="login-password" name="password" type="password" required autoComplete="current-password" maxLength={128} placeholder="Tu contraseña" disabled={!configured} /></label>
    {!configured && <p className="form-feedback" role="status">El acceso todavía no está configurado. Contactá al administrador.</p>}
    {state.error && <p className="form-feedback error" role="alert">{state.error}</p>}
    <button className="button primary" type="submit" disabled={pending || !configured}>{pending ? "Ingresando…" : "Ingresar"}<ArrowRight size={17} /></button>
    <p className="login-help"><LockKeyhole size={14} /> Las cuentas las habilita la administración. Si necesitás acceso o recuperar tu contraseña, contactá a un administrador.</p>
  </form>;
}
