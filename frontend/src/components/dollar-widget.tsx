"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, RefreshCw, X } from "lucide-react";
import { quoteSchema, type DollarQuote } from "@/lib/exchange";
import { DollarCalculator } from "./dollar-calculator";

export function DollarWidget() {
  const [quote, setQuote] = useState<DollarQuote | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async (manual = false) => {
    if (request.current || (!manual && document.hidden)) return;
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch(`/api/cotizacion${manual ? "?refresh=1" : ""}`, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error("Unavailable");
      const data = quoteSchema.parse(await response.json());
      if (!controller.signal.aborted) { setQuote(data); setFailed(false); }
    } catch { if (!controller.signal.aborted) setFailed(true); }
    finally { if (request.current === controller) { request.current = null; if (!controller.signal.aborted) setLoading(false); } }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const onVisible = () => void refresh();
    const timer = setInterval(onVisible, 300000);
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearTimeout(initial); request.current?.abort(); request.current = null; clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);
  const money = (value: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value);
  return <aside className="dollar-widget" aria-label="Cotización de referencia">
    <details className="dollar-details" onKeyDown={event => { if(event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
      <summary><span className="dollar-name">Dólar {quote?.nombre.toLowerCase() ?? "oficial"}</span>{quote ? <span className="dollar-prices"><span>Compra <b>${money(quote.compra)}</b></span><span>Venta <b>${money(quote.venta)}</b></span></span> : <span>{failed ? "No disponible" : "Consultando…"}</span>}<ChevronDown size={13} aria-hidden="true" /></summary>
      <div className="dollar-popover">
        <div className="dollar-popover-heading"><strong>Dólar {quote?.nombre.toLowerCase() ?? "oficial"}</strong><button type="button" className="dollar-refresh" aria-label="Cerrar cotización" onClick={event => { const details = event.currentTarget.closest("details"); if(details) { details.open=false; details.querySelector("summary")?.focus(); } }}><X size={15} aria-hidden="true" /></button></div>
        {quote && <><dl className="dollar-values"><div><dt>Compra</dt><dd>ARS {money(quote.compra)}</dd></div><div><dt>Venta</dt><dd>ARS {money(quote.venta)}</dd></div></dl><p>Fecha de la fuente: <time dateTime={quote.fechaActualizacion}>{new Intl.DateTimeFormat("es-AR", { dateStyle:"short", timeStyle:"short", timeZone:"America/Buenos_Aires" }).format(new Date(quote.fechaActualizacion))}</time></p></>}
        <DollarCalculator quote={quote} stale={failed} />
        <p>Referencia informativa · <a href="https://dolarapi.com/docs/argentina/operations/get-dolares" target="_blank" rel="noreferrer">DolarAPI</a></p>
      </div>
    </details>
    <button type="button" className="dollar-refresh" aria-label="Actualizar cotización" title="Actualizar cotización" disabled={loading} onClick={() => { if (!request.current) { setLoading(true); void refresh(true); } }}><RefreshCw size={15} aria-hidden="true" className={loading ? "is-spinning" : undefined} /></button>
    <span className="sr-only" role="status">{loading ? "Actualizando cotización…" : failed ? "No se pudo actualizar la cotización." : "Cotización actualizada."}</span>
    {failed && <span className="dollar-error" role="status">{quote ? "Sin actualizar · último dato" : "Cotización no disponible"}</span>}
  </aside>;
}
