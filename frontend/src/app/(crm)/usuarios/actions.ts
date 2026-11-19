"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createSessionClient } from "@/lib/supabase/server";
import { createAuthAdminClient } from "@/lib/supabase/admin";
import { sellerFieldErrors, sellerSchema, updateSellerSchema } from "@/lib/auth/validation";
import type { FormState } from "@/lib/auth/types";

export async function createSeller(_previous: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = sellerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Revisá los campos marcados antes de crear la cuenta.", fieldErrors: sellerFieldErrors(parsed.error) };
  if (!process.env.SUPABASE_SECRET_KEY) return { error: "El alta de cuentas todavía no está configurada." };
  const { full_name, contact_phone, contact_email, email, password } = parsed.data;
  const client = await createSessionClient();
  // Verificar la operación/permisos antes de crear una identidad externa.
  const readiness = await client.rpc("list_managed_users");
  if (readiness.error) return { error: "No pudimos verificar los permisos de administración." };
  try {
    const admin = createAuthAdminClient();
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) return { error: "No se pudo crear la cuenta. Revisá si el correo ya existe y los requisitos de contraseña." };
    const result = await client.rpc("register_seller", { p_id: data.user.id, p_full_name: full_name, p_contact_phone: contact_phone, p_contact_email: contact_email });
    if (result.error) {
      // No borrar: un timeout puede llegar después del commit. Sin perfil no hay acceso.
      console.error("Perfil pendiente de conciliación para Auth ID:", data.user.id);
      return { error: "La identidad se creó, pero no pudimos confirmar su perfil. No repitas el alta: solicitá revisar la cuenta antes de usarla." };
    }
  } catch { return { error: "No pudimos confirmar el alta. Revisá la lista de cuentas antes de reintentar." }; }
  revalidatePath("/usuarios");
  return { success: "Vendedor creado. Entregale la contraseña inicial por un medio privado." };
}

export async function updateSeller(_previous: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = updateSellerSchema.safeParse({ ...Object.fromEntries(form), is_enabled: form.get("is_enabled") === "on" });
  if (!parsed.success) return { error: "Revisá los campos marcados antes de guardar.", fieldErrors: sellerFieldErrors(parsed.error) };
  const client = await createSessionClient();
  const result = await client.rpc("update_seller", {
    p_id: parsed.data.id, p_full_name: parsed.data.full_name,
    p_contact_phone: parsed.data.contact_phone, p_contact_email: parsed.data.contact_email, p_is_enabled: parsed.data.is_enabled,
  });
  if (result.error) return { error: "No se pudo actualizar el vendedor. Verificá tu acceso e intentá nuevamente." };
  revalidatePath("/usuarios");
  return { success: "Datos del vendedor actualizados." };
}
