import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import RoadmapViewer, { type LevelData } from "@/components/roadmap-viewer";

type RawLevel = LevelData & {
  quiz: Array<{
    question: string;
    options: string[];
    answer_index: number;
    explanation: string;
    lesson_ref?: number;
  }>;
};

type CompletedEntry = {
  best_score?: number;
  passed?: boolean;
  attempts?: number;
  lessons_read?: number[];
};

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: roadmap } = await supabase
    .from("roadmaps")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!roadmap || roadmap.status !== "ready") notFound();

  const { data: progress } = await supabase
    .from("progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("roadmap_id", roadmap.id)
    .maybeSingle();

  const currentLevelIndex = progress?.current_level_index ?? 0;
  const rawLevels = (roadmap.levels ?? []) as RawLevel[];
  const totalLevels = rawLevels.length;

  const completed = (progress?.completed ?? {}) as Record<string, CompletedEntry>;
  const pct = totalLevels > 0 ? Math.round((currentLevelIndex / totalLevels) * 100) : 0;
  const totalLessons = rawLevels.reduce((n, lv) => n + lv.lessons.length, 0);
  const lessonsRead = Object.values(completed).reduce(
    (n, e) => n + (e.lessons_read?.length ?? 0),
    0,
  );
  const xp = Object.values(completed).reduce(
    (n, e) => n + Math.round((e.best_score ?? 0) * 100),
    0,
  );

  // Strip the quiz answer key before it reaches the client.
  const safeLevels = rawLevels.map((lv) => ({
    ...lv,
    quiz: (lv.quiz ?? []).map((q) => ({
      question: q.question,
      options: q.options,
      lesson_ref: q.lesson_ref,
    })),
  }));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold">Roadmap</h1>
          <p className="text-sm text-zinc-600">
            {roadmap.target_role} · Level {currentLevelIndex + 1} of {totalLevels}
          </p>
        </div>
        <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">
          ← Dashboard
        </Link>
      </div>

      <section className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your progress</h2>
          <span className="text-sm font-medium">{pct}%</span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="h-2 rounded-full bg-blue-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <dt className="text-xs text-zinc-500">Levels</dt>
            <dd className="text-lg font-semibold">
              {currentLevelIndex}/{totalLevels}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Lessons read</dt>
            <dd className="text-lg font-semibold">
              {lessonsRead}/{totalLessons}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">XP</dt>
            <dd className="text-lg font-semibold">{xp}</dd>
          </div>
        </dl>
      </section>

      <RoadmapViewer
        roadmapId={roadmap.id}
        levels={safeLevels}
        currentLevelIndex={currentLevelIndex}
      />
    </main>
  );
}
