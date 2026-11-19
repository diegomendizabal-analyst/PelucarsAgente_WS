import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().trim().max(254),
  password: z.string().min(1).max(128),
});
export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Ingresá un nombre de al menos 2 caracteres.").max(120, "Usá hasta 120 caracteres."),
  contact_phone: z.string().trim().min(1, "Completá el teléfono de contacto.").regex(/^\+[1-9]\d{7,14}$/, "Usá formato internacional, con + y entre 8 y 15 dígitos."),
  contact_email: z.string().trim().min(1, "Completá el correo de contacto.").pipe(z.email("Ingresá un correo de contacto válido.").max(254, "Usá hasta 254 caracteres.")),
});
export const sellerSchema = profileSchema.extend({
  email: z.string().trim().min(1, "Completá el correo de acceso.").pipe(z.email("Ingresá un correo de acceso válido.").max(254, "Usá hasta 254 caracteres.")),
  password: z.string().min(12, "La contraseña debe tener al menos 12 caracteres.").max(128, "Usá hasta 128 caracteres."),
});
export const updateSellerSchema = profileSchema.extend({ id: z.uuid(), is_enabled: z.boolean() });

export function sellerFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const name = String(issue.path[0]);
    errors[name] ??= issue.message;
  }
  return errors;
}
