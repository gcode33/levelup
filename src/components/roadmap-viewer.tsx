"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RoadmapMap from "./roadmap-map";
import { submitQuiz, type QuizResult } from "@/app/dashboard/level-actions";

type Lesson = { title: string; content: string; key_points: string[] };
type QuizQuestion = {
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
};
type Project = { title: string; description: string; skills_used: string[] };

export type LevelData = {
  index: number;
  title: string;
  description: string;
  lessons: Lesson[];
  quiz: QuizQuestion[];
  study_sheet: string;
  projects: Project[];
};

export default function RoadmapViewer({
  roadmapId,
  levels,
  currentLevelIndex,
}: {
  roadmapId: string;
  levels: LevelData[];
  currentLevelIndex: number;
}) {
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);

  const level = levels.find((l) => l.index === selectedIndex) ?? null;
  const completed = level ? level.index < currentLevelIndex : false;
  const unlocked = level ? level.index <= currentLevelIndex : false;

  const lessons = level?.lessons ?? [];
  const quiz = level?.quiz ?? [];
  const studySheet = level?.study_sheet ?? "";
  const projects = level?.projects ?? [];

  function selectLevel(index: number) {
    setSelectedIndex(index);
    setAnswers({});
    setResult(null);
  }

  async function handleSubmit() {
    if (!level) return;
    const answerArr = quiz.map((_, i) => answers[i] ?? -1);
    const res = await submitQuiz(roadmapId, level.index, answerArr);
    setResult(res);
    if (!res.error) router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <RoadmapMap
        levels={levels.map((l) => ({
          index: l.index,
          title: l.title,
          description: l.description,
        }))}
        currentLevelIndex={currentLevelIndex}
        selectedIndex={selectedIndex}
        onNodeClick={selectLevel}
      />

      {level && (
        <section className="rounded-xl border border-black/10 p-6">
          <h3 className="text-lg font-medium">{level.title}</h3>
          <p className="text-sm text-zinc-600">{level.description}</p>

          {!unlocked ? (
            <p className="mt-3 text-sm text-zinc-500">
              🔒 Complete the previous level to unlock this one.
            </p>
          ) : (
            <>
              <h4 className="mt-4 text-sm font-semibold">Lessons</h4>
              <ul className="mt-1 flex flex-col gap-2">
                {lessons.map((ls, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{ls.title}.</span> {ls.content}
                  </li>
                ))}
              </ul>

              <h4 className="mt-4 text-sm font-semibold">Quiz</h4>
              {quiz.map((q, qi) => (
                <div key={qi} className="mt-2">
                  <p className="text-sm font-medium">
                    {qi + 1}. {q.question}
                  </p>
                  <div className="mt-1 flex flex-col gap-1">
                    {q.options.map((opt, oi) => (
                      <label key={oi} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`q-${qi}`}
                          value={oi}
                          checked={answers[qi] === oi}
                          onChange={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <button
                onClick={handleSubmit}
                className="mt-4 rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
              >
                Submit quiz
              </button>

              {result && (
                <p className="mt-2 text-sm">
                  {result.passed
                    ? `✅ Passed (${result.correct}/${result.total})`
                    : `❌ ${result.correct}/${result.total} — need at least 70%`}
                </p>
              )}

              {(completed || result?.passed) && (
                <>
                  <h4 className="mt-4 text-sm font-semibold">Study sheet</h4>
                  <p className="text-sm">{studySheet}</p>
                  <h4 className="mt-4 text-sm font-semibold">Project ideas</h4>
                  <ul className="list-disc pl-6 text-sm">
                    {projects.map((p, i) => (
                      <li key={i}>
                        {p.title}: {p.description}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
