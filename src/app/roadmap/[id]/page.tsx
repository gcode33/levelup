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
  const totalLevels = (roadmap.levels ?? []).length;

  // Strip the quiz answer key before it reaches the client.
  const safeLevels = (roadmap.levels ?? []).map((lv: RawLevel) => ({
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
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
          ← Dashboard
        </Link>
      </div>

      <RoadmapViewer
        roadmapId={roadmap.id}
        levels={safeLevels}
        currentLevelIndex={currentLevelIndex}
      />
    </main>
  );
}
