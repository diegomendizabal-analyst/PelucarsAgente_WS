import { notFound } from "next/navigation";
import { DemoClientDetail } from "@/components/demo-details";
import { demoClients } from "@/lib/demo-data";

export const metadata = { title: "Cliente de demostración" };
export function generateStaticParams() {
  return demoClients.map(({ id }) => ({ id }));
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!demoClients.some((item) => item.id === id)) notFound();
  return <DemoClientDetail key={id} clientId={id} />;
}
