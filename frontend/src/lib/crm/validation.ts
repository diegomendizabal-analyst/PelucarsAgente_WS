import { z } from "zod";
export const crmIdentity = z.object({ id: z.uuid(), updated_at: z.iso.datetime({ offset: true }) });
export const assignmentSchema = crmIdentity.extend({ assignee: z.uuid("Elegí un responsable."), reason: z.string().trim().max(1000,"Usá hasta 1000 caracteres.") });
export const statusSchema = crmIdentity.extend({ status: z.enum(["new_inquiry","follow_up","awaiting_stock","lost"]), reason: z.string().trim().max(1000,"Usá hasta 1000 caracteres.") })
  .refine(value => value.status !== "lost" || value.reason.length > 0, { path: ["reason"], message: "Indicá el motivo de pérdida." });
export function crmErrors(error: z.ZodError) { const fields: Record<string,string> = {}; for (const issue of error.issues) fields[String(issue.path[0])] ??= issue.message; return fields; }
