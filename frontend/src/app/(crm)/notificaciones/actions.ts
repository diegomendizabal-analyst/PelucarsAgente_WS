"use server";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { createSessionClient } from "@/lib/supabase/server";

export async function readNotification(id:string):Promise<{id?:string;error?:string}> {
  await requireAccount();
  if(!z.uuid().safeParse(id).success)return {error:"Aviso no válido."};
  const client=await createSessionClient();
  const result=await client.rpc("read_lead_notification",{p_id:id});
  if(result.error || !result.data)return {error:"El aviso ya no está disponible. Actualizá las notificaciones."};
  return {id:result.data as string};
}
