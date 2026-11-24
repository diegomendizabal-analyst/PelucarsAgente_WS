"use server";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { createSessionClient } from "@/lib/supabase/server";
import { getDataMode } from "@/lib/demo-mode";

export async function readNotification(id:string):Promise<{id?:string;error?:string}> {
  await requireAccount();
  if(!z.uuid().safeParse(id).success)return {error:"Aviso no válido."};
  const client=await createSessionClient();
  const mode=await getDataMode();
  if(mode.empty)return {error:"Los datos demo están ocultos."};
  const visible=await client.from("lead_notifications").select("id,leads!inner(source)").eq("id",id).eq("leads.source",mode.leadSource).maybeSingle();
  if(visible.error || !visible.data)return {error:"Aviso no disponible en esta vista."};
  const result=await client.rpc("read_lead_notification",{p_id:id});
  if(result.error || !result.data)return {error:"El aviso ya no está disponible. Actualizá las notificaciones."};
  return {id:result.data as string};
}
