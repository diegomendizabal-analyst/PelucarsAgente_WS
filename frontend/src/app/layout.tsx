import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import "./globals.css";
import "./records.css";

export const metadata: Metadata = {
  title: { default: "Pelucars · Gestión comercial", template: "%s · Pelucars" },
  description: "Espacio interno de gestión comercial de Pelucars. Vista previa de diseño.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es-AR"><body><AppShell>{children}</AppShell></body></html>;
}
