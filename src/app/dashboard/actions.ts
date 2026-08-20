"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractResumeText, parseResume } from "@/lib/parse";
import type { ParsedProfile } from "@/lib/schemas";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MIN_TEXT_LENGTH = 50;

export type ResumeState = {
  error: string | null;
  profile: ParsedProfile | null;
};

export async function uploadResume(
  _prev: ResumeState,
  formData: FormData,
): Promise<ResumeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", profile: null };

  const file = formData.get("file") as File | null;
  const pasted = ((formData.get("pasted") as string | null) ?? "").trim();

  let text: string;

  if (file && file.size > 0) {
    if (file.size > MAX_FILE_SIZE) {
      return { error: "File too large (max 5 MB)", profile: null };
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      return { error: "Only PDF or DOCX files are allowed", profile: null };
    }

    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(path, file);
    if (uploadError) return { error: uploadError.message, profile: null };

    await supabase
      .from("profiles")
      .update({ resume_path: path })
      .eq("user_id", user.id);

    try {
      text = await extractResumeText(file);
    } catch {
      return {
        error: "Couldn't read that file — please paste your resume text instead",
        profile: null,
      };
    }
  } else if (pasted) {
    text = pasted;
  } else {
    return { error: "Upload a resume or paste your resume text", profile: null };
  }

  // Reject empty / near-empty text so a scanned or garbage file doesn't
  // produce a bogus "Junior, no skills" profile.
  if (text.trim().length < MIN_TEXT_LENGTH) {
    return {
      error: "We couldn't read enough text — please check the file or paste your resume text",
      profile: null,
    };
  }

  try {
    const profile = await parseResume(text);
    const { error: dbError } = await supabase
      .from("profiles")
      .update({
        current_title: profile.current_title,
        level_band: profile.level_band,
        skills: profile.skills,
        years_exp: profile.years_exp,
        current_pay: profile.current_pay,
      })
      .eq("user_id", user.id);
    if (dbError) return { error: dbError.message, profile: null };

    revalidatePath("/dashboard");
    return { error: null, profile };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to parse resume",
      profile: null,
    };
  }
}
