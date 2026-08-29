"use client";

import { useActionState } from "react";
import { uploadResume, type ResumeState } from "./actions";

const initialState: ResumeState = { error: null, profile: null };

export default function ResumeForm() {
  const [state, action, pending] = useActionState(uploadResume, initialState);

  return (
    <section className="flex flex-col gap-4 card p-6">
      <h2 className="text-xl font-medium">Add your resume</h2>
      <form action={action} className="flex flex-col gap-4">
        <input
          type="file"
          name="file"
          accept=".pdf,.docx"
          className="input text-sm"
        />
        <textarea
          name="pasted"
          rows={6}
          placeholder="...or paste your resume text here"
          className="input"
        />
        <button
          disabled={pending}
          className="btn-primary"
        >
          {pending ? "Parsing…" : "Parse resume"}
        </button>
      </form>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      {state.profile && (
        <div className="flex flex-col gap-1 text-sm">
          <p>
            <span className="font-medium">Role:</span>{" "}
            {state.profile.current_title ?? "—"}
          </p>
          <p>
            <span className="font-medium">Level:</span> {state.profile.level_band}
          </p>
          <p>
            <span className="font-medium">Years experience:</span>{" "}
            {state.profile.years_exp ?? "—"}
          </p>
          <p>
            <span className="font-medium">Skills:</span>{" "}
            {state.profile.skills.join(", ") || "—"}
          </p>
        </div>
      )}
    </section>
  );
}
