import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import ResumeForm from "./resume-form";
import RoadmapForm from "./roadmap-form";
import RoadmapViewer from "@/components/roadmap-viewer";

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

  const { data: jobs } = await supabase
    .from("job_postings")
    .select("*")
    .lte("min_level_index", currentLevelIndex)
    .order("min_level_index", { ascending: false })
    .limit(10);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      <p>
        Signed in as <span className="font-medium">{user.email}</span>
      </p>

      {hasResume ? (
        <>
          <section className="flex flex-col gap-2 rounded-xl border border-black/10 p-6">
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
            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-medium">
                Roadmap: {roadmap.target_role}
              </h2>
              <RoadmapViewer
                roadmapId={roadmap.id}
                levels={roadmap.levels}
                currentLevelIndex={currentLevelIndex}
              />
            </section>
          )}

          {jobs && jobs.length > 0 && (
            <section className="flex flex-col gap-3 rounded-xl border border-black/10 p-6">
              <h2 className="text-xl font-medium">Jobs you're ready for</h2>
              <ul className="flex flex-col gap-2">
                {jobs.map((job) => (
                  <li key={job.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      <span className="font-medium">{job.title}</span> — {job.company}
                    </span>
                    {job.url && (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600"
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
          className="rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
