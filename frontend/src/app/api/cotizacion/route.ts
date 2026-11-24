import { requireAccount } from "@/lib/auth/session";
import { quoteSchema } from "@/lib/exchange";

export async function GET(request: Request) {
  await requireAccount();
  const casa = process.env.DOLAR_API_CASA || "oficial";
  if (!["oficial", "blue"].includes(casa)) return Response.json({ error: "Cotización sin configurar." }, { status: 503 });
  try {
    const manual = new URL(request.url).searchParams.get("refresh") === "1";
    const response = await fetch(`https://dolarapi.com/v1/dolares/${casa}`, { ...(manual ? { cache: "no-store" as const } : { next: { revalidate: 300 } }), signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error("Quote unavailable");
    const parsed = quoteSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.casa !== casa) throw new Error("Invalid quote");
    return Response.json(parsed.data, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "Cotización no disponible." }, { status: 503, headers: { "Cache-Control": "private, no-store" } }); }
}
