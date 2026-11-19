import { ChevronRight, UserRound, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { demoDateParts } from "@/lib/demo-data";

export function RecordIdentity({ avatar, title, subtitle }: { avatar: ReactNode; title: string; subtitle: string }) {
  return <div className="demo-person">
    <span className="demo-avatar" aria-hidden="true">{avatar}</span>
    <span className="record-identity"><strong>{title}</strong><small>{subtitle}</small></span>
  </div>;
}

export function RecordCell({ label, children, emphasis = false }: { label: string; children: ReactNode; emphasis?: boolean }) {
  return <div className={`demo-cell${emphasis ? " emphasized" : ""}`}><span className="row-label">{label}</span>{children}</div>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" }) {
  return <span className={`demo-badge ${tone}`}><span className="badge-dot" aria-hidden="true" />{children}</span>;
}

export function RecordArrow() {
  return <span className="row-arrow" aria-hidden="true"><ChevronRight size={18} /></span>;
}

export function TimelineEvent({ at, icon: Icon, label, title, description, actor, amount, children }: {
  at: string; icon: LucideIcon; label: string; title: string; description?: string; actor?: string; amount?: string; children?: ReactNode;
}) {
  const date = demoDateParts(at);
  return <li className="timeline-event">
    <time className="event-date" dateTime={at}><span>{date.date}</span>{date.time && <strong>{date.time}<small> h</small></strong>}</time>
    <span className="event-marker" aria-hidden="true"><Icon size={17} /></span>
    <article className="event-card">
      <div className="event-heading"><span className="event-category">{label}</span>{amount && <strong className="event-amount">{amount}</strong>}</div>
      <h3>{title}</h3>
      {description && <p className="event-description">{description}</p>}
      {(actor || children) && <footer>{actor && <span className="event-actor"><UserRound size={13} />{actor}</span>}{children}</footer>}
    </article>
  </li>;
}

export function SectionIntro({ title, description, count }: { title: string; description: string; count?: number }) {
  return <div className="section-intro"><div><h2>{title}{count !== undefined && <span className="section-count">{count}</span>}</h2><p>{description}</p></div></div>;
}
