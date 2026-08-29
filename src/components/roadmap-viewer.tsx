"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RoadmapMap from "./roadmap-map";
import Markdown from "./markdown";
import { submitQuiz, type QuizResult } from "@/app/dashboard/level-actions";

type Lesson = { title: string; content: string; key_points: string[] };
type QuizQuestion = {
  question: string;
  options: string[];
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

function LessonReader({ lesson, onBack }: { lesson: Lesson; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={onBack}
        className="self-start text-sm text-blue-600 hover:underline"
      >
        ← Back to level
      </button>
      <h3 className="text-lg font-medium">{lesson.title}</h3>
      {lesson.key_points?.length > 0 && (
        <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/40">
          <h4 className="text-sm font-semibold">Key points</h4>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {lesson.key_points.map((kp, i) => (
              <li key={i}>{kp}</li>
            ))}
          </ul>
        </div>
      )}
      <Markdown>{lesson.content}</Markdown>
    </div>
  );
}

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
  const [selectedLesson, setSelectedLesson] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [pending, setPending] = useState(false);

  const level = levels.find((l) => l.index === selectedIndex) ?? null;
  const completed = level ? level.index < currentLevelIndex : false;
  const unlocked = level ? level.index <= currentLevelIndex : false;

  const lessons = level?.lessons ?? [];
  const quiz = level?.quiz ?? [];
  const studySheet = level?.study_sheet ?? "";
  const projects = level?.projects ?? [];

  function selectLevel(index: number) {
    setSelectedIndex(index);
    setSelectedLesson(null);
    setAnswers({});
    setResult(null);
  }

  async function handleSubmit() {
    if (!level || pending) return;
    setPending(true);
    const answerArr = quiz.map((_, i) => answers[i] ?? -1);
    const res = await submitQuiz(roadmapId, level.index, answerArr);
    setResult(res);
    setPending(false);
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
          {!unlocked ? (
            <p className="mt-3 text-sm text-zinc-500">
              🔒 Complete the previous level to unlock this one.
            </p>
          ) : selectedLesson !== null && lessons[selectedLesson] ? (
            <LessonReader
              lesson={lessons[selectedLesson]}
              onBack={() => setSelectedLesson(null)}
            />
          ) : (
            <>
              <h3 className="text-lg font-medium">{level.title}</h3>
              <p className="text-sm text-zinc-600">{level.description}</p>

              <h4 className="mt-4 text-sm font-semibold">Lessons</h4>
              <ul className="mt-2 flex flex-col gap-2">
                {lessons.map((ls, i) => (
                  <li key={i}>
                    <button
                      onClick={() => setSelectedLesson(i)}
                      className="flex w-full flex-col gap-1 rounded-lg border border-black/10 p-3 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <span className="font-medium">{ls.title}</span>
                      {ls.key_points?.[0] && (
                        <span className="text-xs text-zinc-500">{ls.key_points[0]}</span>
                      )}
                    </button>
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
                disabled={pending}
                className="mt-4 rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {pending ? "Checking…" : "Submit quiz"}
              </button>

              {result?.error ? (
                <p className="mt-2 text-sm text-red-600">
                  Something went wrong scoring your quiz — please try again.
                </p>
              ) : result ? (
                <p className="mt-2 text-sm">
                  {result.passed
                    ? `✅ Passed (${result.correct}/${result.total})`
                    : `❌ ${result.correct}/${result.total} — need at least 70%`}
                </p>
              ) : null}

              {(completed || result?.passed) && (
                <>
                  <h4 className="mt-4 text-sm font-semibold">Study sheet</h4>
                  <Markdown>{studySheet}</Markdown>
                  <h4 className="mt-4 text-sm font-semibold">Project ideas</h4>
                  <ul className="list-disc pl-6 text-sm">
                    {projects.map((p, i) => (
                      <li key={i}>
                        <span className="font-medium">{p.title}:</span> {p.description}
                        {p.skills_used?.length > 0 && (
                          <span className="text-xs text-zinc-500">
                            {" "}
                            ({p.skills_used.join(", ")})
                          </span>
                        )}
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
