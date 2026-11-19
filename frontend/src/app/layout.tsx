import type { Metadata } from "next";
import "./globals.css";
import "./records.css";
import "./auth.css";

export const metadata: Metadata = {
  title: { default: "Pelucars · Gestión comercial", template: "%s · Pelucars" },
  description: "Espacio interno de gestión comercial de Pelucars.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es-AR"><body>{children}</body></html>;
}
