"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import { ArrowUpRight, CarFront, ChevronRight, Inbox, LayoutGrid, LogOut, ShieldCheck, Users, UserRoundCog } from "lucide-react";
import { logout } from "@/app/auth/actions";
import type { CurrentAccount } from "@/lib/auth/types";

type PreviewRole = "vendedor" | "admin";
const PreviewContext = createContext<PreviewRole>("vendedor");
export const usePreviewRole = () => useContext(PreviewContext);
const navigation = [
  { href: "/", label: "Oportunidades", icon: Inbox },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/vehiculos", label: "Vehículos", icon: CarFront },
];

export function AppShell({ children, account }: { children: ReactNode; account: CurrentAccount }) {
  const pathname = usePathname();
  const role: PreviewRole = account.role === "admin" ? "admin" : "vendedor";
  const userManagement = pathname.startsWith("/usuarios");
  const realInventory = pathname.startsWith("/vehiculos");
  const section = userManagement ? "Usuarios" : pathname.startsWith("/clientes") ? "Clientes" : pathname.startsWith("/vehiculos") ? "Vehículos" : "Oportunidades";
  const visibleNavigation = role === "admin" ? [...navigation, { href: "/usuarios", label: "Usuarios", icon: UserRoundCog }] : navigation;
  return <PreviewContext.Provider value={role}>
    <a href="#contenido" className="skip-link">Ir al contenido</a>
    <div className="app-frame">
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="Pelucars, inicio"><span className="brand-symbol"><CarFront size={25} /></span><span>pelucars<span className="brand-dot">.</span><small>GESTIÓN COMERCIAL</small></span></Link>
        <div className="workspace-label"><LayoutGrid size={15} /> Espacio de trabajo</div>
        <nav aria-label="Navegación principal">{visibleNavigation.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" || pathname.startsWith("/oportunidades") : pathname.startsWith(href);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`nav-item ${active ? "active" : ""}`}><Icon size={19} /><span>{label}</span>{active && <ChevronRight size={15} />}</Link>;
        })}</nav>
        <div className="sidebar-bottom"><div className="sidebar-note"><span className="eyebrow">CADA CONSULTA CUENTA</span><p>Un lugar para acompañar<br />cada oportunidad.</p><ArrowUpRight size={20} /></div><div className="internal-label"><ShieldCheck size={16} /> Uso interno · Pelucars</div></div>
      </aside>
      <div className="main-frame">
        <header className="topbar"><div className="breadcrumb">Comercial <ChevronRight size={14} /><span>{section}</span></div><div className="account-menu"><div><strong>{account.full_name}</strong><span>{role === "admin" ? "Administrador" : "Vendedor"}</span></div><form action={logout}><button className="button secondary logout-button" title="Cerrar sesión"><LogOut size={15} /><span>Salir</span></button></form></div></header>
        {!userManagement && !realInventory && <div className="preview-banner"><span className="status-dot" /><span>Datos comerciales ficticios <span className="banner-detail">· Muestra visual compartida. No representa tu cartera real.</span></span><span className="preview-tag">DEMO</span></div>}
        <main id="contenido" className="page-content" tabIndex={-1}>{children}</main>
        <footer className="page-footer"><span>Pelucars / Gestión comercial</span><span>Acceso autenticado · {userManagement ? "Administración de cuentas" : realInventory ? "Catálogo e inventario" : "Datos comerciales de demostración"}</span></footer>
      </div>
    </div>
  </PreviewContext.Provider>;
}
