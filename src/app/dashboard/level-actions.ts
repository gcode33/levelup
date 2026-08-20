"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { scoreQuiz, type QuizQuestion } from "@/lib/scoring";

export type QuizResult = {
  error: string | null;
  correct: number;
  total: number;
  score: number;
  passed: boolean;
};

export async function submitQuiz(
  roadmapId: string,
  levelIndex: number,
  answers: number[],
): Promise<QuizResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { error: "Not authenticated", correct: 0, total: 0, score: 0, passed: false };

  const { data: roadmap } = await supabase
    .from("roadmaps")
    .select("levels")
    .eq("id", roadmapId)
    .eq("user_id", user.id)
    .single();

  const level = ((roadmap?.levels as unknown[]) ?? []).find(
    (l) => (l as { index: number }).index === levelIndex,
  ) as { index: number; quiz: QuizQuestion[] } | undefined;

  if (!level)
    return { error: "Level not found", correct: 0, total: 0, score: 0, passed: false };

  const { data: progress } = await supabase
    .from("progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("roadmap_id", roadmapId)
    .maybeSingle();

  const currentLevelIndex = progress?.current_level_index ?? 0;

  // Only the currently unlocked level can be scored; reject locked levels.
  if (levelIndex > currentLevelIndex) {
    return { error: "This level is locked", correct: 0, total: 0, score: 0, passed: false };
  }

  const { correct, total, score, passed } = scoreQuiz(level.quiz, answers);

  const completed: Record<string, { best_score: number; passed: boolean; attempts: number }> = {
    ...(progress?.completed ?? {}),
  };
  const prev = completed[levelIndex] ?? { best_score: 0, passed: false, attempts: 0 };
  const updatedCompleted = {
    ...completed,
    [levelIndex]: {
      best_score: Math.max(prev.best_score, score),
      passed: prev.passed || passed,
      attempts: prev.attempts + 1,
    },
  };
  const newCurrentIndex = passed ? Math.max(currentLevelIndex, levelIndex + 1) : currentLevelIndex;

  const { error } = await supabase.from("progress").upsert(
    {
      user_id: user.id,
      roadmap_id: roadmapId,
      current_level_index: newCurrentIndex,
      completed: updatedCompleted,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,roadmap_id" },
  );
  if (error) return { error: error.message, correct, total, score, passed };

  revalidatePath("/dashboard");
  return { error: null, correct, total, score, passed };
}
