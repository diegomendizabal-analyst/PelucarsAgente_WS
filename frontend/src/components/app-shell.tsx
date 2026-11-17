"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { ArrowUpRight, CarFront, ChevronRight, FlaskConical, Inbox, LayoutGrid, ShieldCheck, Users } from "lucide-react";

type PreviewRole = "vendedor" | "admin";
const PreviewContext = createContext<PreviewRole>("vendedor");
export const usePreviewRole = () => useContext(PreviewContext);
const navigation = [
  { href: "/", label: "Oportunidades", icon: Inbox },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/vehiculos", label: "Vehículos", icon: CarFront },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState<PreviewRole>("vendedor");
  const section = pathname.startsWith("/clientes") ? "Clientes" : pathname.startsWith("/vehiculos") ? "Vehículos" : "Oportunidades";
  return <PreviewContext.Provider value={role}>
    <a href="#contenido" className="skip-link">Ir al contenido</a>
    <div className="app-frame">
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="Pelucars, inicio"><span className="brand-symbol"><CarFront size={25} /></span><span>pelucars<span className="brand-dot">.</span><small>GESTIÓN COMERCIAL</small></span></Link>
        <div className="workspace-label"><LayoutGrid size={15} /> Espacio de trabajo</div>
        <nav aria-label="Navegación principal">{navigation.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" || pathname.startsWith("/oportunidades") : pathname.startsWith(href);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`nav-item ${active ? "active" : ""}`}><Icon size={19} /><span>{label}</span>{active && <ChevronRight size={15} />}</Link>;
        })}</nav>
        <div className="sidebar-bottom"><div className="sidebar-note"><span className="eyebrow">CADA CONSULTA CUENTA</span><p>Un lugar para acompañar<br />cada oportunidad.</p><ArrowUpRight size={20} /></div><div className="internal-label"><ShieldCheck size={16} /> Uso interno · Pelucars</div></div>
      </aside>
      <div className="main-frame">
        <header className="topbar"><div className="breadcrumb">Comercial <ChevronRight size={14} /><span>{section}</span></div><div className="role-preview"><FlaskConical size={16} /><label htmlFor="preview-role">Vista de demostración</label><select id="preview-role" value={role} onChange={(event) => setRole(event.target.value as PreviewRole)}><option value="vendedor">Vendedor</option><option value="admin">Admin</option></select></div></header>
        <div className="preview-banner"><span className="status-dot" /><span>Datos ficticios de demostración <span className="banner-detail">· Ejemplos locales. Los cambios no se guardan.</span></span><span className="preview-tag">DEMO</span></div>
        <main id="contenido" className="page-content" tabIndex={-1}>{children}</main>
        <footer className="page-footer"><span>Pelucars / Gestión comercial</span><span>Demostración visual · Sin autenticación</span></footer>
      </div>
    </div>
  </PreviewContext.Provider>;
}
