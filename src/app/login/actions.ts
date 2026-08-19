"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null; message: string | null };

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message, message: null };

  redirect("/dashboard");
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message, message: null };
  if (!data.session) {
    return {
      error: null,
      message: "Account created — check your email to confirm, then sign in.",
    };
  }

  redirect("/dashboard");
}

export async function signOut(formData: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
