import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";

// Herramienta temporal del equipo. En entrega: flag false y purga revisada de muestras.
export const getDataMode = cache(async () => {
  const toolsEnabled = process.env.PELUCARS_DEMO_TOOLS === "true";
  const visible = (await cookies()).get("pelucars-demo-visible")?.value !== "0";
  return { toolsEnabled, visible, empty: toolsEnabled && !visible,
    leadSource: toolsEnabled ? "demo" as const : "whatsapp_bot" as const,
    vehicleSource: toolsEnabled ? "demo" as const : "real" as const };
});
