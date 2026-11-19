import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Info, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function RequiredMark() { return <span className="required-mark" aria-hidden="true">*</span>; }

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{action && <div className="heading-action">{action}</div>}</div>;
}
export function EmptyState({ icon: Icon, title, description, children, compact = false }: { icon: LucideIcon; title: string; description: string; children?: ReactNode; compact?: boolean }) {
  return <div className={`empty-state ${compact ? "compact" : ""}`}><div className="empty-icon"><Icon size={28} strokeWidth={1.5} /></div><h3>{title}</h3><p>{description}</p>{children}</div>;
}
export function PreviewLink({ href, children = "Explorar ficha vacía" }: { href: string; children?: ReactNode }) {
  return <Link className="button secondary" href={href}>{children}<ArrowUpRight size={16} /></Link>;
}
export function PendingButton({ children }: { children: ReactNode }) {
  return <button type="button" className="button" disabled>{children}<span className="pending-label">Pendiente</span></button>;
}
export function Notice({ children }: { children: ReactNode }) {
  return <div className="notice"><Info size={17} /><p>{children}</p></div>;
}
export function Panel({ title, description, children, action }: { title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return <section className="panel"><div className="panel-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>{children}</section>;
}
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link className="back-link" href={href}><ArrowLeft size={15} />{children}</Link>;
}
export function BlankDetails({ labels }: { labels: string[] }) {
  return <dl className="details-grid">{labels.map((label) => <div key={label}><dt>{label}</dt><dd>Sin información</dd></div>)}</dl>;
}
export function Metric({ label, caption, icon: Icon, value }: { label: string; caption: string; icon: LucideIcon; value?: number }) {
  return <div className="metric"><div className="metric-top"><span>{label}</span><Icon size={18} /></div><strong aria-label={value === undefined ? "Sin datos" : undefined}>{value ?? "—"}</strong><small>{caption}</small></div>;
}
