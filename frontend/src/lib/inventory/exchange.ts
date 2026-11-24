import "server-only";
import { cache } from "react";
import { quoteSchema } from "@/lib/exchange";

// Una cotización por render: mismo valor para filtrar y mostrar equivalencias.
// Decisión provisional del cliente: siempre Oficial / Venta para inventario.
export const getInventoryQuote = cache(async () => {
  try {
    const response = await fetch("https://dolarapi.com/v1/dolares/oficial", { cache:"no-store", signal:AbortSignal.timeout(6000) });
    if (!response.ok) return null;
    const parsed = quoteSchema.safeParse(await response.json());
    return parsed.success && parsed.data.casa === "oficial" ? parsed.data : null;
  } catch { return null; }
});
