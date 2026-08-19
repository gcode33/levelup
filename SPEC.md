# Spec: LevelUp — Interactive Career Roadmap App

## Summary

LevelUp turns a resume into a personalized, game-like career roadmap. A user uploads their resume (PDF/DOCX), states their current role and pay (or lets the app infer their level from the resume), then picks a target role and wage. The app generates an ordered roadmap from the user's current level to that target, where each level contains lessons, a quiz, a short study sheet, and — as the user advances — project ideas. As the user progresses, the app surfaces job postings matched to their level progress. Users can personalize the roadmap's look (themes/backgrounds). All roadmap and lesson content is LLM-generated per user and cached.

## Requirements

- **R1 — Authentication**: Users can sign up, log in, and log out via email/password and OAuth.
- **R2 — Authorization**: Each user can read and write only their own data (profiles, roadmaps, progress, preferences), enforced with database-level Row Level Security. `job_postings` is readable by all authenticated users (separate read-only policy). Resumes are in a **private** Storage bucket readable only by their owner.
- **R3 — Resume upload**: Users can upload a resume as PDF or DOCX, capped at 5 MB and restricted to `application/pdf` / `.pdf` / `.docx` via a MIME + extension allow-list. Files are stored in a private, owner-only bucket.
- **R4 — Resume parsing**: Uploaded resume text is extracted and turned into structured data (current role, level band, skills, years of experience, current pay if supplied) via an LLM call with structured output.
- **R5 — Level inference**: If a user does not provide a role or pay, the app infers their level band from the resume using a fixed taxonomy (`Junior → Mid → Senior → Staff`).
- **R6 — Target selection**: Users specify an aspiring role (required) and target wage (optional). Current pay is also optional.
- **R7 — Roadmap generation**: Given the parsed profile and target, an LLM generates an ordered sequence of 3–8 levels, each containing lessons, a quiz, a study sheet, and project ideas. The result is stored and reused; generation is asynchronous (pending → ready/failed).
- **R8 — Interactive roadmap UI**: The roadmap renders as an interactive, auto-laid-out node graph (draggable, animated, progress-gated).
- **R9 — Level loop**: Each level is completed by taking a server-scored quiz; a score ≥70% unlocks the next node and reveals the study sheet and project ideas. Lesson reading is not gated.
- **R10 — Job matching**: Job postings matched to the user's current level index are surfaced (seeded/mock data first; optionally a real jobs API later).
- **R11 — Personalization**: Users can customize the roadmap's appearance (preset themes + accent background), persisted per account.
- **N1 — Performance**: LLM generation is slow; generate once, cache, and surface progress via a `pending` status and polling/streaming rather than blocking the UI.
- **N2 — Cost control**: LLM generation is rate-limited per user and capped; seeded demo resumes are provided so testing does not incur repeated API cost.
- **N3 — Security**: LLM API keys live only on the server; never shipped to the client. User data is isolated via RLS; Storage uses a private bucket with owner-only policies; untrusted resume text is length-capped before reaching the LLM.
- **N4 — UX quality**: The UI is modern, responsive, and accessible, with the interactive map as the visual centerpiece.

## Design

### Data Model

Postgres tables (Supabase). `id`/timestamps omitted for brevity.

- **profiles** — `user_id` (FK → auth.users, PK), `resume_path`, `current_role`, `level_band` (`Junior` | `Mid` | `Senior` | `Staff`), `current_pay int null`, `skills jsonb`, `years_exp int null`. Holds the user's *current* state only (no target fields). Extracted resume text is used transiently for parsing and not persisted.
- **roadmaps** — `id`, `user_id`, `target_role`, `target_pay int null`, `levels jsonb`, `status` (`pending` | `ready` | `failed`), `is_active boolean`, `created_at`. The generated roadmap is stored as a single JSON document — generated once, read often, immutable except for regeneration. A user may have multiple roadmaps (history); exactly one is `is_active`. Only `target_role` is required.
- **progress** — `user_id`, `roadmap_id`, `current_level_index int`, `completed jsonb` (per-level: `best_score`, `passed`, `attempts`), `updated_at`. One row per user+roadmap.
- **user_preferences** — `user_id` (PK), `theme` (preset theme id), `background` (accent color / preset). Created on onboarding; updated via upsert.
- **job_postings** — `id`, `title`, `company`, `url`, `min_level_index int`, `source`. Seeded/mock rows; read-only to all authenticated users.

**Level structure** (shape of the `levels` JSON document) — the LLM output contract. The array has 3–8 entries:

```json
{
  "target_role": "Senior Frontend Engineer",
  "levels": [
    {
      "index": 0,
      "title": "Solidify JavaScript fundamentals",
      "description": "One or two sentences framing this level.",
      "lessons": [
        { "title": "Closures and scope", "content": "Markdown lesson body", "key_points": ["…"] }
      ],
      "quiz": [
        { "question": "…", "options": ["…"], "answer_index": 0, "explanation": "…" }
      ],
      "study_sheet": "Short markdown summary of the whole level.",
      "projects": [
        { "title": "…", "description": "…", "skills_used": ["…"] }
      ]
    }
  ]
}
```

**Parse output contract** (resume → structured profile). Shared TS/zod type `ParsedProfile`:

```ts
type ParsedProfile = {
  current_role: string | null;
  level_band: "Junior" | "Mid" | "Senior" | "Staff";
  skills: string[];
  years_exp: number | null;
  current_pay: number | null;
};
```

### API / Interfaces

Next.js route handlers (server-side). The LLM is called only from these server routes, never from the client. Every route enforces auth + RLS.

- `POST /api/resume/upload` — accept a PDF/DOCX (size + MIME/extension allow-list), store in the private bucket, return `resume_path`.
- `POST /api/resume/parse` — accept a `resume_path` **or** pasted raw text (manual-entry fallback); extract text, call the LLM for `ParsedProfile`, validate, write `profiles`, return the parsed profile. Resume text is length-capped (e.g. 20k chars) before the LLM call.
- `POST /api/roadmap/generate` — pre-write a `roadmaps` row with `status='pending'`, return its `id`; generation runs server-side, then the row is set to `ready` (levels validated) or `failed`. The client polls `GET /api/roadmap/:id` until `ready`/`failed`.
- `GET /api/roadmaps` — list the current user's roadmaps (history), newest first.
- `GET /api/roadmap/:id` — return a stored roadmap (RLS-scoped to the owner).
- `POST /api/roadmap/:id/regenerate` — re-run generation, replace `levels`, reset `progress`, keep the row's `id`/`status` transition.
- `POST /api/progress` — **client submits the quiz answers for a level; the server computes the score.** If ≥70% correct, mark the level passed (store best score; later attempts never re-lock), advance `current_level_index`, and return the resulting unlock state. The client never sends a self-reported score.
- `GET /api/jobs?level=N` — return job postings with `min_level_index <= N`.
- `PATCH /api/preferences` — upsert theme/background.

**LLM contract**: all LLM calls use **structured output** against fixed zod schemas (`ParsedProfile` and the roadmap `levels` shape). The resume is classified into the fixed `level_band` taxonomy rather than free-text. Roadmap validation rules: 3–8 levels; non-empty `lessons` and `quiz` per level; `answer_index` within `options` bounds; required fields present and correctly typed. Invalid output → retry once, then mark `failed`.

### Flow

1. **Onboarding** → user signs up (R1); a `profiles` row and a `user_preferences` row are created.
2. **Resume in** → upload (R3) or paste text → `/api/resume/parse` (R4) → if no role/pay supplied, infer level band (R5). Profile stored.
3. **Target in** → user picks target role (required) + wage (optional) (R6).
4. **Generate** → `/api/roadmap/generate` pre-writes a `pending` roadmap and returns its id; the client polls until `ready` (R7, N1).
5. **Explore** → React Flow renders the active roadmap with auto-layout; node 0 unlocked, the rest locked (R8).
6. **Advance** → user reads lessons, takes the quiz; the server scores it; ≥70% unlocks the next node and reveals the study sheet + project ideas (R9).
7. **Jobs** → as `current_level_index` advances, matched job postings appear (R10).
8. **Personalize** → theme/background changes persist (R11).

Error paths: unparseable resume (fall back to paste/manual entry); LLM generation failure or invalid JSON (retry once, then mark the roadmap `failed` with a regenerate affordance); unrealistic target wage jump (warn but allow, only when both `current_pay` and `target_pay` are present).

## Edge Cases

- User has no resume / is unemployed → infer from a short self-description; allow skipping resume upload.
- Career change (unrelated skills) → roadmap emphasizes transferable skills; flag a longer path.
- Scanned/image PDFs with no extractable text → fall back to manual entry.
- LLM timeout or rate limit → retry once; otherwise mark roadmap `failed`, offer regenerate.
- Duplicate generation / repeated clicks → `generate` pre-writes a `pending` row (idempotent on the target); the client polls instead of re-submitting.
- Quiz retries → allowed; store the **best** score, and a later worse score never re-locks a passed level.
- Empty target or no wage → `target_role` required; `target_pay` optional.
- Concurrent progress updates → single `progress` row per user+roadmap, updated atomically with server-side scoring.

## Dependencies & Risks

- **Supabase** (Auth, Postgres, Storage, RLS) → free-tier limits could be hit; risk low for a portfolio. Mitigation: stay within free tier, local Supabase for development.
- **LLM API** (OpenAI/Anthropic/DeepSeek) → cost, latency, and hallucination risk. Mitigation: structured output + validation, generate-once caching, a smaller/faster model, per-user rate limits, and a "regenerate" affordance. Resume text is untrusted input → length-capped and treated as data, not instructions.
- **Resume parsing libraries** (`unpdf`/`pdf-parse` for PDF, `mammoth` for DOCX) → scanned PDFs yield no text. Mitigation: manual paste fallback (R4 error path).
- **Jobs API** (optional, e.g. Arbeitnow/Remotive/Adzuna) → API keys and rate limits. Mitigation: ship with seeded/mock postings first.
- **React Flow (`@xyflow/react`)** → complex interactions (locking, animation, progress). Mitigation: prototype the map first against a fixed 5-level fixture; it is the highest-risk UI piece.
- **Async generation vs. serverless timeout** → if LLM latency can exceed the deployment's function timeout, move generation to a background worker (Supabase Edge Functions / Queues / `pg_cron`). The `pending → ready/failed` contract already isolates this decision.

## Acceptance Criteria

- [ ] A new user can sign up, log in, and log out; their session persists.
- [ ] Uploading a real PDF resume stores the file (private bucket) and produces a structured profile (role, level band, skills, years).
- [ ] Pasting resume text (no file) produces the same structured profile.
- [ ] Providing a target role produces a stored roadmap with 3–8 ordered levels, each containing lessons, a quiz, a study sheet, and projects; the roadmap passes schema validation.
- [ ] The roadmap renders as an interactive, auto-laid-out, draggable node graph with locked/unlocked states.
- [ ] Submitting quiz answers is scored **server-side**; a ≥70% score unlocks the next node and reveals the study sheet and project ideas; a wrong/failing submission does not.
- [ ] A later, worse quiz score never re-locks a passed level.
- [ ] Job postings appear and update as the user advances levels.
- [ ] Theme/background changes persist across sessions for the signed-in user.
- [ ] One user cannot read or modify another user's roadmap, progress, or resume file.
- [ ] Regenerating a roadmap replaces the old content and resets progress.
- [ ] A failed generation surfaces an error state with a regenerate affordance.
