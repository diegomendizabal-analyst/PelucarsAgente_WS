import { notFound } from "next/navigation";
import { DemoVehicleDetail } from "@/components/demo-details";
import { demoVehicles } from "@/lib/demo-data";

export const metadata = { title: "Vehículo de demostración" };
export function generateStaticParams() {
  return demoVehicles.map(({ id }) => ({ id }));
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicle = demoVehicles.find((item) => item.id === id);
  if (!vehicle) notFound();
  return <DemoVehicleDetail key={id} vehicle={vehicle} />;
}
