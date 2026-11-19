import { CarFront } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { supabaseConfig } from "@/lib/supabase/config";

export const metadata = { title: "Iniciar sesión" };
export default function LoginPage() {
  return <main className="auth-page"><section className="auth-intro">
    <div className="brand"><span className="brand-symbol"><CarFront size={25} /></span><span>pelucars<span className="brand-dot">.</span><small>GESTIÓN COMERCIAL</small></span></div>
    <div><span className="eyebrow">CADA CONSULTA CUENTA</span><h1>Tu espacio para<br />seguir cada oportunidad.</h1><p>Clientes, conversaciones y seguimiento comercial en un mismo lugar.</p></div>
    <small>Uso interno · Pelucars</small>
  </section><section className="auth-form-area"><div className="auth-card"><span className="eyebrow">BIENVENIDO</span><h2>Iniciá sesión</h2><p className="auth-description">Ingresá con la cuenta que te asignó la administración.</p><LoginForm configured={!!supabaseConfig()} /></div></section></main>;
}
