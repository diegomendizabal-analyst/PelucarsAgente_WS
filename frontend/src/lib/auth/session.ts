import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import type { CurrentAccount, Profile } from "./types";

// cache de React: deduplicación dentro del render, nunca caché compartida de sesión.
export const requireAccount = cache(async (): Promise<CurrentAccount> => {
  if (!supabaseConfig()) redirect("/login");
  const client = await createSessionClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims.sub) redirect("/login");
  const result = await client.from("profiles")
    .select("id,full_name,role,contact_phone,contact_email,is_enabled,accepts_assignments").eq("id", data.claims.sub).maybeSingle();
  if (result.error) redirect("/acceso-denegado");
  const profile = result.data as Profile | null;
  if (!profile?.is_enabled || !["admin", "seller"].includes(profile.role)) redirect("/acceso-denegado");
  return { ...profile, email: typeof data.claims.email === "string" ? data.claims.email : "" };
});

export async function requireAdmin() {
  const account = await requireAccount();
  if (account.role !== "admin") redirect("/acceso-denegado");
  return account;
}
