import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max, `Usá hasta ${max} caracteres.`).transform((value) => value || null);
const optionalInteger = (min: number, max: number) => z.string().trim().refine((value) => value === "" || (/^\d+$/.test(value) && Number(value) >= min && Number(value) <= max), `Ingresá un entero entre ${min} y ${max}, o dejá el campo vacío.`).transform((value) => value === "" ? null : Number(value));
export const vehicleSchema = z.object({
  brand: z.string().trim().min(1, "Completá la marca.").max(80, "Usá hasta 80 caracteres."),
  model: z.string().trim().min(1, "Completá el modelo.").max(120, "Usá hasta 120 caracteres."),
});
export const unitSchema = z.object({
  model_year: optionalInteger(1000, 9999),
  version: optionalText(120), transmission: optionalText(60), mileage_km: optionalInteger(0, 2147483647),
  listed_price: z.string().trim().transform((value) => value.replace(",", ".")).refine((value) => value === "" || (/^\d{1,12}(\.\d{1,2})?$/.test(value) && Number(value) > 0), "Ingresá un precio mayor a cero, con hasta 2 decimales y sin separadores de miles.").transform((value) => value || null),
  currency: z.enum(["", "ARS", "USD"]).transform((value) => value || null),
  status: z.enum(["available", "withdrawn"]),
  received_at: z.union([z.literal(""), z.iso.date("Ingresá una fecha válida.")]).transform((value) => value || null),
}).superRefine((value, ctx) => {
  if (value.listed_price !== null && value.currency === null) ctx.addIssue({ code: "custom", path: ["currency"], message: "Elegí la moneda del precio." });
  if (value.listed_price === null && value.currency !== null) ctx.addIssue({ code: "custom", path: ["listed_price"], message: "Completá el precio o dejá también la moneda vacía." });
});
export const editIdentity = z.object({ id: z.guid(), updated_at: z.iso.datetime({ offset: true }) });
export function inventoryFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) result[String(issue.path[0])] ??= issue.message;
  return result;
}
