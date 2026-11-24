import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./records.css";
import "./auth.css";
import "./inventory.css";
import "./crm.css";
import "./reports.css";

const manrope = localFont({
  src: "./fonts/manrope-latin-variable.woff2",
  weight: "200 800",
  style: "normal",
  display: "swap",
  variable: "--font-manrope",
  adjustFontFallback: "Arial",
});

export const metadata: Metadata = {
  title: { default: "Pelucars · Gestión comercial", template: "%s · Pelucars" },
  description: "Espacio interno de gestión comercial de Pelucars.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es-AR" className={manrope.variable}><body>{children}</body></html>;
}
