import { Suspense } from "react";
import Loading from "@/app/loading";
import { notFound } from "next/navigation";
import { DemoClientDetail } from "@/components/demo-details";
import { demoClients } from "@/lib/demo-data";

export const metadata = { title: "Cliente de demostración" };
export function generateStaticParams() {
  return demoClients.map(({ id }) => ({ id }));
}
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<Loading />}><Details params={params} /></Suspense>;
}

async function Details({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!demoClients.some((item) => item.id === id)) notFound();
  return <DemoClientDetail key={id} clientId={id} />;
}
