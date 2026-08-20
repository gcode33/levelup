"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updatePreferences(theme: string, background: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      { user_id: user.id, theme, background, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}
