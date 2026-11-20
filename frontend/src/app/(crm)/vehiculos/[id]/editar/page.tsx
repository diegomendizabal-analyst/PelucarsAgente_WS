import { Suspense } from "react";
import Loading from "@/app/loading";
import { CarFront } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { getVehicle } from "@/lib/inventory/data";
import { CatalogForm } from "@/components/inventory-controls";
import { InventoryError } from "@/components/inventory-views";
import { BackLink, EmptyState, Notice, PageHeading, Panel } from "@/components/ui";

export const metadata = { title: "Editar vehículo" };
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<Loading />}><Details params={params} /></Suspense>;
}

async function Details({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const { vehicle, error } = await getVehicle(id);
  if (error) return <InventoryError />;
  if (!vehicle) return <><BackLink href="/vehiculos">Volver a vehículos</BackLink><EmptyState icon={CarFront} title="Vehículo no disponible" description="Volvé al catálogo para elegir una ficha." /></>;
  return <><BackLink href={`/vehiculos/${id}`}>Volver a la ficha</BackLink><PageHeading eyebrow="CATÁLOGO" title="Editar marca y modelo" description="Las características y el precio de cada auto se editan en sus unidades." />{vehicle.archived_at ? <Notice>Restaurá esta ficha desde su detalle para poder editarla.</Notice> : <Panel title="Identificación del vehículo"><CatalogForm vehicle={vehicle} /></Panel>}</>;
}
