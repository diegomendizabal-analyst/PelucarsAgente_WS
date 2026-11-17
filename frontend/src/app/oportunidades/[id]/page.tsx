import { notFound } from "next/navigation";
import { DemoOpportunityDetail } from "@/components/demo-details";
import { demoOpportunities } from "@/lib/demo-data";

export const metadata = { title: "Oportunidad de demostración" };
export function generateStaticParams() {
  return demoOpportunities.map(({ id }) => ({ id }));
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opportunity = demoOpportunities.find((item) => item.id === id);
  if (!opportunity) notFound();
  return <DemoOpportunityDetail key={id} opportunity={opportunity} />;
}
