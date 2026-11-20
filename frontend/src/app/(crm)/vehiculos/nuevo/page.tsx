import { Suspense } from "react";
import Loading from "@/app/loading";
import { requireAdmin } from "@/lib/auth/session";
import { CatalogForm } from "@/components/inventory-controls";
import { BackLink, PageHeading, Panel } from "@/components/ui";
export const metadata = { title: "Alta de vehículo" };
async function Form() {
  await requireAdmin();
  return <><BackLink href="/vehiculos">Volver a vehículos</BackLink><PageHeading eyebrow="CATÁLOGO" title="Crear vehículo" description="Registrá la marca y el modelo. Cada auto físico se agrega después como una unidad." /><Panel title="Identificación del vehículo"><CatalogForm /></Panel></>;
}
export default function Page() { return <Suspense fallback={<Loading />}><Form /></Suspense>; }
