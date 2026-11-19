"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSessionClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { loginSchema } from "@/lib/auth/validation";
import type { FormState } from "@/lib/auth/types";

export async function login(_previous: FormState, form: FormData): Promise<FormState> {
  if (!supabaseConfig()) return { error: "El acceso todavía no está configurado. Contactá al administrador." };
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Revisá el correo y la contraseña." };
  try {
    const client = await createSessionClient();
    const { data, error } = await client.auth.signInWithPassword(parsed.data);
    if (error || !data.user) return { error: "No pudimos iniciar sesión. Revisá tus datos e intentá nuevamente." };
    const profile = await client.from("profiles").select("is_enabled,role").eq("id", data.user.id).maybeSingle();
    if (profile.error || !profile.data?.is_enabled || !["admin", "seller"].includes(profile.data.role)) {
      await client.auth.signOut({ scope: "local" });
      return { error: "Tu cuenta no tiene acceso habilitado. Contactá al administrador." };
    }
  } catch { return { error: "No pudimos conectar con el servicio de acceso. Intentá nuevamente." }; }
  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout() {
  if (supabaseConfig()) {
    const client = await createSessionClient();
    await client.auth.signOut({ scope: "local" });
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
