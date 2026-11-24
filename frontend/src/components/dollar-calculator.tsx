"use client";
import { useState } from "react";
import { convertCurrency, parseConversionAmount, type DollarQuote } from "@/lib/exchange";

export function DollarCalculator({ quote, stale }: { quote: DollarQuote | null; stale: boolean }) {
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState<"ARS" | "USD">("ARS");
  const [side, setSide] = useState<"" | "compra" | "venta">("");
  const rate = quote && side ? quote[side] : undefined;
  const result = convertCurrency(amount, from, rate);
  const invalid = amount.trim() !== "" && parseConversionAmount(amount) === null;
  const to = from === "ARS" ? "USD" : "ARS";
  const format = (value: number) => new Intl.NumberFormat("es-AR", { minimumFractionDigits:2, maximumFractionDigits:2 }).format(value);
  return <fieldset className="dollar-calculator"><legend>Conversor</legend>
    <div className="dollar-calculator-fields">
      <label>Conversión<select name="conversion_from" value={from} onChange={e => setFrom(e.target.value as "ARS" | "USD")}><option value="ARS">ARS → USD</option><option value="USD">USD → ARS</option></select></label>
      <label>Cotización<select name="conversion_side" value={side} disabled={!quote} onChange={e => setSide(e.target.value as "" | "compra" | "venta")}><option value="">Elegí una</option><option value="compra">Compra</option><option value="venta">Venta</option></select></label>
    </div>
    <label>Importe en {from}<input name="conversion_amount" inputMode="decimal" autoComplete="off" placeholder="0,00" maxLength={15} value={amount} aria-invalid={invalid || undefined} aria-describedby={invalid ? "conversion-error" : undefined} onChange={e => setAmount(e.target.value)} /></label>
    {invalid && <p id="conversion-error" className="field-error" role="alert">Usá un importe desde cero, sin separadores de miles y con hasta 2 decimales.</p>}
    <div className="dollar-conversion-result"><span>Equivalente en {to}</span><output aria-label="Resultado de conversión" aria-live="polite">{result === null ? "—" : `${to} ${format(result)}`}</output></div>
    <p className="dollar-conversion-rate">{rate === undefined ? quote ? "Elegí Compra o Venta para calcular." : "Sin cotización disponible." : `1 USD = ARS ${new Intl.NumberFormat("es-AR", { minimumFractionDigits:2, maximumFractionDigits:20 }).format(rate)} · ${side === "compra" ? "Compra" : "Venta"}${stale ? " · Último dato recibido" : ""}`}</p>
  </fieldset>;
}
