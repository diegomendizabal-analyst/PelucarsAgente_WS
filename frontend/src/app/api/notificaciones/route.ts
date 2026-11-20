import { requireAccount } from "@/lib/auth/session";
import { createSessionClient } from "@/lib/supabase/server";

export async function GET() {
  await requireAccount();
  const client = await createSessionClient();
  const result = await client.from("lead_notifications")
    .select("id,lead_id,created_at,leads!inner(reference_number)", {count:"exact"})
    .is("read_at",null).order("created_at",{ascending:false}).order("id").limit(10);
  return Response.json({rows:result.data ?? [],count:result.count ?? 0,error:!!result.error}, {
    status:result.error ? 503 : 200, headers:{"Cache-Control":"private, no-store"},
  });
}
