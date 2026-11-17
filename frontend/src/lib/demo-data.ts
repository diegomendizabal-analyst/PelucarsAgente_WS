// Datos ficticios de presentación, autorizados para esta maqueta.
// No son un seed ni representan el futuro contrato de la base de datos.
export type DemoVehicle = {
  id: string;
  brand: string;
  model: string;
  version: string;
  year: number;
  price: number;
  currency: "ARS" | "USD";
  stock: number;
};

export const demoVehicles: DemoVehicle[] = [
  { id: "demo-corolla", brand: "Toyota", model: "Corolla", version: "XEI 2.0 CVT", year: 2022, price: 24500, currency: "USD", stock: 1 },
  { id: "demo-cronos", brand: "Fiat", model: "Cronos", version: "Drive 1.3", year: 2023, price: 18500000, currency: "ARS", stock: 0 },
];

export const demoClients = [
  { id: "demo-ana", name: "Ana Martínez", initials: "AM", email: "ana@example.test", phone: "Sin teléfono real", zone: "Zona demo A" },
  { id: "demo-bruno", name: "Bruno López", initials: "BL", email: "bruno@example.test", phone: "Sin teléfono real", zone: "Zona demo B" },
];

export type DemoMessage = { id: string; sender: "Cliente" | "Bot" | "Vendedor"; at: string; text: string };
export type DemoOpportunity = {
  id: string;
  clientId: string;
  vehicleId: string;
  assigned: boolean;
  state: string;
  budget: string;
  timeframe: string;
  score: number;
  evidence: { messageId: string; quote: string; reason: string };
  messages: DemoMessage[];
  history: { at: string; text: string }[];
};

export const demoOpportunities: DemoOpportunity[] = [
  {
    id: "demo-consulta-ana", clientId: "demo-ana", vehicleId: "demo-corolla", assigned: false,
    state: "Nueva consulta", budget: "Hasta USD 25.000", timeframe: "Este mes", score: 82,
    evidence: { messageId: "demo-mensaje-ana-1", quote: "Quiero comprar este mes y tengo hasta 25.000 dólares.", reason: "Plazo de compra y presupuesto expresados en la consulta." },
    messages: [
      { id: "demo-mensaje-ana-1", sender: "Cliente", at: "2026-11-17T09:10:00-03:00", text: "Hola, me interesa un Corolla automático. Quiero comprar este mes y tengo hasta 25.000 dólares." },
      { id: "demo-mensaje-ana-2", sender: "Bot", at: "2026-11-17T09:11:00-03:00", text: "Gracias por contarnos. Un vendedor va a continuar con tu consulta." },
    ],
    history: [{ at: "2026-11-17T09:10:00-03:00", text: "Ingreso en espera · Nueva consulta · Recepción de demostración." }],
  },
  {
    id: "demo-consulta-bruno", clientId: "demo-bruno", vehicleId: "demo-cronos", assigned: true,
    state: "En seguimiento", budget: "Hasta ARS 20.000.000", timeframe: "Próximos dos meses", score: 64,
    evidence: { messageId: "demo-mensaje-bruno-1", quote: "Estoy comparando opciones para los próximos dos meses.", reason: "Interés definido y plazo de compra exploratorio." },
    messages: [
      { id: "demo-mensaje-bruno-1", sender: "Cliente", at: "2026-11-16T15:00:00-03:00", text: "Busco un Cronos y tengo hasta 20 millones de pesos. Estoy comparando opciones para los próximos dos meses." },
      { id: "demo-mensaje-bruno-2", sender: "Bot", at: "2026-11-16T15:01:00-03:00", text: "Gracias, voy a derivar la consulta a un vendedor para que pueda ayudarte." },
      { id: "demo-mensaje-bruno-3", sender: "Vendedor", at: "2026-11-16T15:20:00-03:00", text: "Hola Bruno, soy tu asesor de Pelucars. ¿Preferís que te llame mañana por la tarde?" },
      { id: "demo-mensaje-bruno-4", sender: "Cliente", at: "2026-11-16T15:24:00-03:00", text: "Sí, después de las 17 me queda bien." },
    ],
    history: [
      { at: "2026-11-16T15:00:00-03:00", text: "Ingreso en espera · Nueva consulta · Recepción de demostración." },
      { at: "2026-11-16T15:15:00-03:00", text: "Sin responsable → Vendedor de demostración · Asignación Admin de ejemplo." },
      { at: "2026-11-16T15:20:00-03:00", text: "Nueva consulta → En seguimiento · Vendedor de demostración." },
    ],
  },
];

export const demoFollowups = [
  { id: "demo-tarea-1", opportunityId: "demo-consulta-bruno", at: "2026-11-17T17:30:00-03:00", text: "Llamar para conocer sus preferencias y próximos pasos.", owner: "Vendedor de demostración" },
];
export const demoAttempts = [
  { id: "demo-intento-1", opportunityId: "demo-consulta-bruno", at: "2026-11-16T15:20:00-03:00", channel: "WhatsApp", result: "Respondió; acordó una llamada", owner: "Vendedor de demostración", messageIds: ["demo-mensaje-bruno-3", "demo-mensaje-bruno-4"] },
];
export const demoPurchases = [
  { id: "demo-compra-1", clientId: "demo-bruno", date: "2025-06-12", description: "Fiat Cronos Drive 1.3 · 2023", amount: 16000000, currency: "ARS", note: "Compra histórica ficticia, independiente del stock actual." },
];

export const vehicleName = (vehicle: DemoVehicle) => `${vehicle.brand} ${vehicle.model}`;
export const demoMoney = (amount: number, currency: string) => `${currency} ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(amount)}`;
export const demoDate = (date: string) => new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric",
  ...(date.includes("T") ? { hour: "2-digit", minute: "2-digit" } as const : {}),
}).format(new Date(date.includes("T") ? date : `${date}T12:00:00-03:00`));
export const demoMatches = (text: string, query: string) => {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return normalize(text).includes(normalize(query.trim()));
};
