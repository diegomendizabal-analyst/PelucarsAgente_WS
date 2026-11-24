import { z } from "zod";
export const quoteSchema = z.object({ moneda: z.literal("USD"), casa: z.enum(["oficial", "blue"]), nombre: z.string().min(1), compra: z.number().positive().finite(), venta: z.number().positive().finite(), fechaActualizacion: z.iso.datetime() });
export type DollarQuote = z.infer<typeof quoteSchema>;

export function parseConversionAmount(value: string): number | null {
  const text = value.trim();
  if (!/^\d{1,12}([.,]\d{1,2})?$/.test(text)) return null;
  return Number(text.replace(",", "."));
}

// Cotización expresada en ARS por USD. Sólo cálculo informativo, sin persistencia.
export function convertCurrency(amount: string, from: "ARS" | "USD", rate: number | undefined): number | null {
  const value = parseConversionAmount(amount);
  if (value === null || rate === undefined || !Number.isFinite(rate) || rate <= 0) return null;
  return from === "ARS" ? value / rate : value * rate;
}
