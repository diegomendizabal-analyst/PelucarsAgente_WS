import { z } from "zod";

// Reject malformed stored results instead of rendering a fabricated score.
export const leadScoreSchema = z.object({
  id:z.string(),score:z.number().int().min(0).max(100),rules_version:z.string(),evaluated_at:z.string(),
  cutoff_message_id:z.string(),cutoff_position:z.number(),cutoff_at:z.string(),
  result:z.object({banda:z.string(),informacion_limitada:z.boolean(),motivos_limitacion:z.array(z.string()),
    desglose:z.record(z.string(),z.object({puntos:z.number(),motivo:z.string()}))}),
  evidence:z.array(z.object({signal_code:z.string(),message_id:z.string(),quoted_text:z.string()})),
});
