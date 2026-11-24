import { getDataMode } from "@/lib/demo-mode";
import { requireAccount } from "@/lib/auth/session";
import { createSessionClient } from "@/lib/supabase/server";

export async function GET() {
  await requireAccount();
  const mode = await getDataMode();
  if(mode.empty) return Response.json({rows:[],count:0,error:false},{headers:{"Cache-Control":"private, no-store"}});
  const client = await createSessionClient();
  const result = await client.from("lead_notifications")
    .select("id,lead_id,created_at,leads!inner(reference_number)", {count:"exact"})
    .eq("leads.source",mode.leadSource).is("read_at",null).order("created_at",{ascending:false}).order("id").limit(10);
  return Response.json({rows:result.data ?? [],count:result.count ?? 0,error:!!result.error}, {
    status:result.error ? 503 : 200, headers:{"Cache-Control":"private, no-store"},
  });
}
