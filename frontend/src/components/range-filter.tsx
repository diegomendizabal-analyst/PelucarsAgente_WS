"use client";
import type { CSSProperties, ReactNode } from "react";

// Inputs nativos: teclado, foco y lectores de pantalla, con entrada exacta sincronizada.
export function RangeFilter({ label, name, lower, upper, min, max, step = 1, disabled = false, accessory, onChange }: {
  label: string; name: string; lower: string; upper: string; min: number; max: number; step?: number; disabled?: boolean;
  onChange: (lower: string, upper: string) => void;
  accessory?: ReactNode;
}) {
  const number = (value: string, fallback: number) => value && Number.isFinite(Number(value.replace(",", "."))) ? Number(value.replace(",", ".")) : fallback;
  const domainMin = Math.max(0, Math.min(min, number(lower, min), number(upper, min)));
  const domainMax = Math.max(max, number(lower, max), number(upper, max), domainMin + step);
  const low = Math.max(domainMin, Math.min(domainMax, number(lower, domainMin)));
  const high = Math.max(domainMin, Math.min(domainMax, number(upper, domainMax)));
  const setLow = (v: string) => onChange(v, upper && Number(v) > high ? v : upper);
  const setHigh = (v: string) => onChange(lower && Number(v) < low ? v : lower, v);
  return <fieldset className="range-filter"><legend className="sr-only">{label}</legend>
    <div className="range-filter-header"><strong>{label}</strong>{accessory}{(lower || upper) && <button type="button" className="text-link" disabled={disabled} aria-label={`Quitar rango de ${label.toLowerCase()}`} onClick={() => onChange("", "")}>Quitar</button>}</div>
    <div className="range-filter-fields">
      <label>Desde<input disabled={disabled} name={`${name}_min`} inputMode={step < 1 ? "decimal" : "numeric"} value={lower} placeholder="Sin mínimo" maxLength={15} autoComplete="off" onChange={e => onChange(e.target.value, upper)} /></label>
      <label>Hasta<input disabled={disabled} name={`${name}_max`} inputMode={step < 1 ? "decimal" : "numeric"} value={upper} placeholder="Sin máximo" maxLength={15} autoComplete="off" onChange={e => onChange(lower, e.target.value)} /></label>
    </div>
    <div className={`range-slider ${disabled ? "is-disabled" : ""}`} style={{ "--range-start":`${100*(low-domainMin)/(domainMax-domainMin)}%`, "--range-end":`${100*(high-domainMin)/(domainMax-domainMin)}%` } as CSSProperties} onPointerDown={event => {
      if(disabled || event.target !== event.currentTarget) return;
      const bounds=event.currentTarget.getBoundingClientRect();
      const raw=domainMin + Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width))*(domainMax-domainMin);
      const v=String(Number((Math.round(raw/step)*step).toFixed(step < 1 ? 2 : 0)));
      if(Math.abs(raw-low)<=Math.abs(raw-high)) setLow(v); else setHigh(v);
    }}>
      <input disabled={disabled} type="range" aria-label={`${label}: mínimo`} min={domainMin} max={domainMax} step={step} value={low} onChange={e => setLow(e.target.value)} />
      <input disabled={disabled} type="range" aria-label={`${label}: máximo`} min={domainMin} max={domainMax} step={step} value={high} onChange={e => setHigh(e.target.value)} />
    </div>
  </fieldset>;
}
