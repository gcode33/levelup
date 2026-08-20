import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars for tests");
  return createClient(url, key);
}

export async function createTestUser(email: string, password: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user;
}

export async function deleteTestUser(userId: string) {
  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(userId);
}

export async function seedProfile(userId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      current_title: "Frontend Developer",
      level_band: "Mid",
      skills: ["React", "TypeScript"],
      years_exp: 3,
    })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function seedRoadmap(userId: string, levels: unknown[]) {
  const admin = createAdminClient();
  const { error } = await admin.from("roadmaps").insert({
    user_id: userId,
    target_role: "Senior Frontend Engineer",
    levels,
    status: "ready",
    is_active: true,
  });
  if (error) throw error;
}
