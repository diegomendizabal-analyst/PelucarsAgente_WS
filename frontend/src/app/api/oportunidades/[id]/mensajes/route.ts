import { z } from "zod";
import { getLead, leadMessagePage } from "@/lib/crm/data";

const cursorSchema = z.object({
  before:z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  cutoff:z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  beforeId:z.guid().optional(),
  kind:z.enum(["conversation","unconfirmed"]).default("conversation"),
}).strict().refine(value => value.kind === "unconfirmed"
  ? value.before === undefined && value.cutoff === undefined
  : value.beforeId === undefined && value.before !== undefined && value.cutoff !== undefined && value.before <= value.cutoff);
const headers = {"Cache-Control":"private, no-store"};

export async function GET(request: Request, {params}: {params: Promise<{id:string}>}) {
  const {id} = await params;
  const parsed = cursorSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if(!z.guid().safeParse(id).success || !parsed.success) return Response.json({error:"Cursor inválido"},{status:400,headers});
  // Checks enabled session, current source mode and row access on every page.
  // Reads always use the caller's session and invoker-view RLS.
  const {lead,error} = await getLead(id);
  if(error) return Response.json({error:"No se pudo verificar el acceso"},{status:503,headers});
  if(!lead) return Response.json({error:"Oportunidad no disponible"},{status:404,headers});
  const page = await leadMessagePage(id,{...parsed.data,unconfirmed:parsed.data.kind === "unconfirmed"});
  return Response.json(page,{status:page.state === "ready" ? 200 : 503,headers});
}
