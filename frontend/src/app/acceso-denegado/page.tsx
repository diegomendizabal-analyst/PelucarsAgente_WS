import { logout } from "@/app/auth/actions";
export const metadata = { title: "Acceso no habilitado" };
export default function AccessDenied() {
  return <main className="access-page"><section className="panel panel-body"><h1>Acceso no habilitado</h1><p>Tu cuenta no tiene permisos para esta sección o su acceso no está habilitado. Contactá al administrador.</p><form action={logout}><button className="button secondary">Volver al inicio de sesión</button></form></section></main>;
}
