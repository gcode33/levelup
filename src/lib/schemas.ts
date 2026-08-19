import { z } from "zod";

export const levelBandSchema = z.enum(["Junior", "Mid", "Senior", "Staff"]);

export const parsedProfileSchema = z.object({
  current_title: z.string().nullable(),
  level_band: levelBandSchema,
  skills: z.array(z.string()),
  years_exp: z.number().nullable(),
  current_pay: z.number().nullable(),
});

export type ParsedProfile = z.infer<typeof parsedProfileSchema>;
