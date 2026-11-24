import type { DollarQuote } from "@/lib/exchange";
import { RefreshCrm } from "./crm-controls";

export function InventoryQuote({ quote, error }: { quote: DollarQuote | null; error: boolean }) {
  if (error) return <div className="inventory-quote-error" role="alert"><p>No pudimos obtener el dólar oficial venta. Reintentá para buscar equivalencias en ambas monedas.</p><RefreshCrm /></div>;
  if (!quote) return null;
  return <p className="inventory-quote">ARS y USD · Oficial venta: <strong>1 USD = ARS {new Intl.NumberFormat("es-AR",{maximumFractionDigits:20}).format(quote.venta)}</strong><span>Fuente: <time dateTime={quote.fechaActualizacion}>{new Intl.DateTimeFormat("es-AR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Buenos_Aires"}).format(new Date(quote.fechaActualizacion))}</time></span></p>;
}
