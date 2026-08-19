"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateRoadmap } from "@/lib/roadmap";
import type { ParsedProfile } from "@/lib/schemas";

export type RoadmapState = {
  error: string | null;
  levelsCount: number | null;
};

export async function generateRoadmapAction(
  _prev: RoadmapState,
  formData: FormData,
): Promise<RoadmapState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", levelsCount: null };

  const targetRole = ((formData.get("target_role") as string) ?? "").trim();
  const targetPayRaw = ((formData.get("target_pay") as string) ?? "").trim();

  if (!targetRole) return { error: "Target role is required", levelsCount: null };

  let targetPay: number | null = null;
  if (targetPayRaw) {
    targetPay = Number(targetPayRaw);
    if (Number.isNaN(targetPay)) {
      return { error: "Target pay must be a number", levelsCount: null };
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile?.level_band) {
    return { error: "Parse your resume first", levelsCount: null };
  }

  const parsed: ParsedProfile = {
    current_title: profile.current_title,
    level_band: profile.level_band,
    skills: profile.skills ?? [],
    years_exp: profile.years_exp,
    current_pay: profile.current_pay,
  };

  // Deactivate any existing active roadmap.
  await supabase
    .from("roadmaps")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("is_active", true);

  const { data: roadmap, error: insertError } = await supabase
    .from("roadmaps")
    .insert({
      user_id: user.id,
      target_role: targetRole,
      target_pay: targetPay,
      status: "pending",
      is_active: true,
    })
    .select()
    .single();

  if (insertError || !roadmap) {
    return { error: insertError?.message ?? "Failed to create roadmap", levelsCount: null };
  }

  try {
    const generated = await generateRoadmap(parsed, targetRole, targetPay);
    const { error: updateError } = await supabase
      .from("roadmaps")
      .update({ levels: generated.levels, status: "ready" })
      .eq("id", roadmap.id);
    if (updateError) return { error: updateError.message, levelsCount: null };

    revalidatePath("/dashboard");
    return { error: null, levelsCount: generated.levels.length };
  } catch (e) {
    await supabase.from("roadmaps").update({ status: "failed" }).eq("id", roadmap.id);
    return {
      error: e instanceof Error ? e.message : "Failed to generate roadmap",
      levelsCount: null,
    };
  }
}
