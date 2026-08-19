"use client";

import { useActionState } from "react";
import { generateRoadmapAction, type RoadmapState } from "./roadmap-actions";

const initialState: RoadmapState = { error: null, levelsCount: null };
const inputCls =
  "rounded border border-black/10 bg-white px-3 py-2 text-black dark:bg-black dark:text-white";

export default function RoadmapForm() {
  const [state, action, pending] = useActionState(
    generateRoadmapAction,
    initialState,
  );

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-black/10 p-6">
      <h2 className="text-xl font-medium">Generate your roadmap</h2>
      <form action={action} className="flex flex-col gap-4">
        <input
          name="target_role"
          required
          placeholder="Target role (e.g. Senior Frontend Engineer)"
          className={inputCls}
        />
        <input
          name="target_pay"
          type="number"
          placeholder="Target salary (optional)"
          className={inputCls}
        />
        <button
          disabled={pending}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "Generating…" : "Generate roadmap"}
        </button>
      </form>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.levelsCount != null && (
        <p className="text-sm text-green-600">
          Roadmap ready with {state.levelsCount} levels.
        </p>
      )}
    </section>
  );
}
