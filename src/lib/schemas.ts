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

// --- Roadmap ---

export const lessonSchema = z.object({
  title: z.string(),
  content: z.string(),
  key_points: z.array(z.string()),
});

export const quizQuestionSchema = z
  .object({
    question: z.string(),
    options: z.array(z.string()).min(2),
    answer_index: z.number().int().min(0),
    explanation: z.string(),
  })
  .refine((q) => q.answer_index < q.options.length, {
    message: "answer_index must be within options bounds",
  });

export const projectSchema = z.object({
  title: z.string(),
  description: z.string(),
  skills_used: z.array(z.string()),
});

export const levelSchema = z.object({
  index: z.number().int().min(0),
  title: z.string(),
  description: z.string(),
  lessons: z.array(lessonSchema).min(1),
  quiz: z.array(quizQuestionSchema).min(1),
  study_sheet: z.string(),
  projects: z.array(projectSchema),
});

export const roadmapSchema = z
  .object({
    target_role: z.string().min(1),
    levels: z.array(levelSchema).min(3).max(8),
  })
  .refine(
    (r) => {
      const indices = r.levels.map((l) => l.index).sort((a, b) => a - b);
      return indices.every((idx, i) => idx === i);
    },
    { message: "levels must have contiguous, zero-based indices" },
  );

export type Roadmap = z.infer<typeof roadmapSchema>;
export type Level = z.infer<typeof levelSchema>;
