import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchRemoteJobs } from "@/lib/jobs";
import { signOut } from "@/app/login/actions";
import ResumeForm from "./resume-form";
import RoadmapForm from "./roadmap-form";
import PersonalizeForm from "./personalize-form";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const hasResume = Boolean(profile?.level_band);

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const { data: roadmap } = await supabase
    .from("roadmaps")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let currentLevelIndex = 0;
  if (roadmap?.status === "ready") {
    const { data: progress } = await supabase
      .from("progress")
      .select("*")
      .eq("user_id", user.id)
      .eq("roadmap_id", roadmap.id)
      .maybeSingle();
    currentLevelIndex = progress?.current_level_index ?? 0;
  }

  const jobs = await fetchRemoteJobs(currentLevelIndex);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      <p>
        Signed in as <span className="font-medium">{user.email}</span>
      </p>

      <PersonalizeForm
        theme={prefs?.theme ?? null}
        background={prefs?.background ?? null}
      />

      {hasResume ? (
        <>
          <section className="flex flex-col gap-2 card p-6">
            <h2 className="text-xl font-medium">Your profile</h2>
            <p>
              Role: <span className="font-medium">{profile.current_title ?? "—"}</span>
            </p>
            <p>
              Level: <span className="font-medium">{profile.level_band}</span>
            </p>
            <p>
              Years experience:{" "}
              <span className="font-medium">{profile.years_exp ?? "—"}</span>
            </p>
            <p>
              Skills:{" "}
              <span className="font-medium">{profile.skills?.join(", ") || "—"}</span>
            </p>
          </section>

          <RoadmapForm />

          {roadmap?.status === "ready" && (
            <section className="flex flex-col gap-3 card p-6">
              <h2 className="text-xl font-medium">Your roadmap</h2>
              <p>
                Target: <span className="font-medium">{roadmap.target_role}</span>
              </p>
              <p className="text-sm text-zinc-600">
                Level {currentLevelIndex + 1} of {roadmap.levels?.length ?? 0}
              </p>
              <Link
                href={`/roadmap/${roadmap.id}`}
                className="btn-primary w-full"
              >
                Continue learning →
              </Link>
            </section>
          )}

          {jobs.length > 0 && (
            <section className="flex flex-col gap-3 card p-6">
              <h2 className="text-xl font-medium">Jobs you&apos;re ready for</h2>
              <p className="text-xs text-zinc-500">Remote roles via Remotive</p>
              <ul className="flex flex-col gap-2">
                {jobs.map((job) => (
                  <li key={job.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      <span className="font-medium">{job.title}</span> — {job.company}
                      {job.location && (
                        <span className="text-zinc-500"> · {job.location}</span>
                      )}
                    </span>
                    {job.url && (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600"
                      >
                        Apply
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <ResumeForm />
      )}

      <form action={signOut}>
        <button
          type="submit"
          className="btn-primary"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
