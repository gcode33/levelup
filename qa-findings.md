# LevelUp QA Findings

Date: 2026-08-19
Scope: source review of `/Users/fota23/levelup/src` (all 6 user flows), plus `supabase/migrations`, `SPEC.md`, and existing tests. No code was modified.

Severity summary:

| Severity | Count | IDs |
|---|---|---|
| High | 4 | H1–H4 |
| Medium | 11 | M1–M11 |
| Low | 10 | L1–L10 |

---

## High

### H1 — A failed regeneration strands the user without their working roadmap

- **Flow:** Roadmap generation / regeneration (flow 3).
- **Scenario:** User already has a `ready`, active roadmap with progress. They submit a new target role and the LLM call fails (timeout, invalid JSON after retry, provider outage).
- **What currently happens:** `generateRoadmapAction` deactivates **all** active roadmaps *before* generating (`src/app/dashboard/roadmap-actions.ts` lines 54–59). On failure, only the new row is set to `status='failed'` and it remains `is_active=true` (lines 87–93). The dashboard only loads the newest active roadmap (`src/app/dashboard/page.tsx` lines 31–38) and only renders it when `status === 'ready'` (line 92). The user's previous, still-valid roadmap is now inactive and invisible — they are left with no roadmap at all, only the transient form error.
- **What should happen:** The previous roadmap must stay visible/active until the new one is successfully generated. A failed regeneration should leave the user exactly where they were, with the old roadmap intact and a clear error on the new attempt.
- **Fix suggestion:** Deactivate the old roadmap only after the new one is written as `ready` (or run deactivate + insert + finalize as one transactional unit). On failure, keep or restore the previous active row. Show a "generation failed, your previous roadmap is untouched" message.

### H2 — Synchronous LLM generation blocks the request; zombie `pending` rows; no timeout

- **Flow:** Roadmap generation (flow 3).
- **Scenario:** The LLM call is slow or hangs (no `AbortController`/timeout in `src/lib/llm.ts` `completeChat`). On a serverless host the function is killed after the `pending` row insert but before the status update.
- **What currently happens:** `generateRoadmapAction` awaits the full LLM call inline after inserting a `pending` row (lines 61–79). The UI shows "Generating…" for the entire duration. If the platform kills the request (e.g., a 10–30s function timeout), the `catch` never runs, so the row stays `status='pending'`, `is_active=true` forever. The dashboard has no `pending` state UI, so the user sees the Generate form again with no explanation, and each retry can create another zombie `pending` row. This also violates the spec's N1/R7 requirement of `pending → ready/failed` with polling rather than a blocking request.
- **What should happen:** Generation should be asynchronous: pre-write `pending`, return immediately, run generation in a background worker, and let the client poll until `ready`/`failed`. The LLM call should have a bounded timeout, and any interruption should transition the row to `failed`.
- **Fix suggestion:** Move generation off the request path (Supabase Edge Function / queue / `pg_cron`, or Next's post-response hooks) plus a polling endpoint and a dashboard status banner for `pending`. Add `AbortSignal.timeout(...)` to `completeChat`, and wrap the insert/generate/update lifecycle so interrupted work is marked `failed`.

### H3 — Quiz answer key is shipped to the client and locked levels can be scored

- **Flow:** Interactive map / quiz / unlock (flow 4).
- **Scenario:** Any signed-in user opens the dashboard and inspects the RSC/HTML payload, or calls the `submitQuiz` server action directly with a `levelIndex` greater than their current level.
- **What currently happens:** The dashboard passes the raw `roadmap.levels` JSONB — including every question's `answer_index` for **all** levels, locked or not — to the client component `RoadmapViewer` (`src/app/dashboard/page.tsx` lines 97–101). `submitQuiz` (`src/app/dashboard/level-actions.ts`) never checks that `levelIndex <= progress.current_level_index`; it scores against client-supplied answers and computes `newCurrentIndex = max(current, levelIndex + 1)` (lines 62–64). A user can read the correct answers from the page payload or invoke the action for a locked level and jump the entire progression gate.
- **What should happen:** The answer key must remain server-side. Only the currently unlocked level should be scorable, and scoring must be against answers the client cannot see.
- **Fix suggestion:** Strip `answer_index` (and optionally `explanation`) from the levels before passing them to `RoadmapViewer`/any client component. In `submitQuiz`, load the progress row and reject any `levelIndex > current_level_index` with an error. Optionally verify the submitted answer array length matches the quiz.

### H4 — Unparseable/empty resume text produces a bogus profile instead of an error

- **Flow:** Resume upload/parse (flow 2).
- **Scenario:** A scanned or image-only PDF has no extractable text, or the user pastes a very short/garbage string.
- **What currently happens:** `extractResumeText` can return `""` (e.g., `unpdf` returns empty pages for a scanned PDF) and `parseResume` happily sends an empty prompt to the LLM (`src/lib/parse.ts` lines 23–41). The model can return schema-valid JSON like `{"current_title": null, "level_band": "Junior", "skills": [], "years_exp": null, "current_pay": null}`. `hasResume` becomes true (it only checks `Boolean(profile?.level_band)`, `page.tsx` line 23), so the dashboard hides the resume form and shows a "Junior, no skills" profile. The user then generates a nonsense roadmap. The spec's edge case "scanned PDFs → fall back to manual entry" is not implemented.
- **What should happen:** Empty or near-empty extracted text should produce a clear error ("We couldn't read any text from that file — please paste your resume text instead") and keep the resume form visible.
- **Fix suggestion:** After extraction and before the LLM call, reject text shorter than a minimum threshold (e.g., 50 non-whitespace chars) with a friendly error; when a PDF yields zero pages of text, explicitly direct the user to the paste fallback.

---

## Medium

### M1 — Failed roadmaps are invisible; no regenerate affordance

- **Flow:** Roadmap generation failure UI.
- **Scenario:** Generation fails; the active row is `status='failed'`. The user reloads the page.
- **What currently happens:** The dashboard loads the newest active roadmap regardless of status but only renders `status === 'ready'` (`page.tsx` lines 92–103). There is no pending/failed banner, so after reload the failure disappears and the user just sees the Generate form again. Spec acceptance criteria: "A failed generation surfaces an error state with a regenerate affordance."
- **Fix:** When the active roadmap is `failed` (or `pending`), render a status banner ("Generation failed — Regenerate" / "Generating your roadmap…") instead of silently falling back to the bare form.

### M2 — Update failure after a successful LLM call leaves the row `pending`, not `failed`

- **Flow:** Roadmap generation persistence.
- **Scenario:** The LLM returns valid JSON but the `roadmaps.update` that sets `levels` + `status='ready'` fails (network/DB error).
- **What currently happens:** `roadmap-actions.ts` lines 79–83 return the update error but never set `status='failed'`; the `catch` only wraps `generateRoadmap`. The active row is left `pending` forever with no UI (same symptom as H2).
- **Fix:** In the update-failure branch, set `status='failed'` (and surface a consistent error), or do the finalize inside the same try/catch.

### M3 — Resume parse has no retry and surfaces raw zod/JSON errors

- **Flow:** Resume parsing (flow 2).
- **Scenario:** LLM returns fenced/prose-wrapped JSON, truncated JSON, a string for `years_exp`/`current_pay`, or an out-of-enum `level_band`.
- **What currently happens:** `parseResume` makes a single attempt (`src/lib/parse.ts`); roadmap generation retries once, resume parsing does not. `parsedProfileSchema.parse` failures propagate as raw ZodError text into the UI (`actions.ts` catch returns `e.message`), e.g. a multi-line `invalid_type` JSON path — confusing to end users. Note zod v4 `z.number()` rejects numeric strings, so an LLM returning `"years_exp": "5"` fails validation.
- **Fix:** Retry once with a schema reminder (mirroring `generateRoadmap`); catch schema errors and map them to a friendly message ("We couldn't read your resume — please check the file or paste your text"). Consider `z.coerce.number()` for `years_exp`/`current_pay`.

### M4 — Quiz server errors are rendered as a failing 0/0 score

- **Flow:** Quiz submission (flow 4).
- **Scenario:** `submitQuiz` returns an error (e.g., "Level not found", "Not authenticated", DB failure).
- **What currently happens:** `roadmap-viewer.tsx` lines 127–133 render `result.passed ? Passed : "❌ 0/0 — need at least 70%"`; `result.error` is never displayed. A server-side failure looks like the user scored zero.
- **Fix:** Render `result.error` distinctly ("Something went wrong scoring your quiz — try again") and keep it separate from score feedback.

### M5 — Level indices are not validated as contiguous/unique/zero-based

- **Flow:** Roadmap rendering (flow 4).
- **Scenario:** The LLM returns levels with indices `[1,2,3,4]`, `[0,2,3]`, or duplicate indices (schema only requires `index >= 0`).
- **What currently happens:** `roadmapSchema` accepts these. `RoadmapViewer` defaults to `selectedIndex=0`; if no level has index 0 the detail panel is blank (`level = levels.find(...) ?? null`). Edges are built from `index - 1 → index`, so gaps produce edges to nonexistent node ids and React Flow renders a broken graph. The user is effectively stuck.
- **Fix:** Add a `roadmapSchema.refine` that requires indices to be exactly `0..n-1` (unique, contiguous, starting at 0), or normalize/re-index levels before storing.

### M6 — Missing profile row silently loops (onboarding trigger failure path)

- **Flow:** Signup onboarding + resume upload (flows 1–2).
- **Scenario:** `handle_new_user` trigger didn't fire (or the user predates the migration), so no `profiles` row exists.
- **What currently happens:** Dashboard `.single()` returns an error → `profile` is null → `hasResume` false → ResumeForm shows. `uploadResume` then runs `profiles.update(...).eq("user_id", user.id)`; PostgREST reports success even when 0 rows matched (`actions.ts` lines 59–68), so the action returns a parsed profile. After reload the row is still missing and the user is back at the empty ResumeForm with no error — an endless silent loop.
- **Fix:** Use `upsert` (on `user_id`) for the profile write, and/or have the dashboard surface a "profile missing" error when `.single()` fails instead of treating it as a new user.

### M7 — Target pay validation is weak; no unrealistic-jump warning

- **Flow:** Target selection (flow 3).
- **Scenario:** User enters `-50`, `0`, `1e309`, or an absurd jump from their current pay.
- **What currently happens:** `Number(targetPayRaw)` accepts negative values, zero, and `Infinity` (which then fails at the Postgres integer insert with a raw DB error). No minimum, no sane maximum, and the spec's "unrealistic target wage jump (warn but allow)" path is not implemented anywhere.
- **Fix:** Validate `target_pay` as a finite positive number within a sane range before insert; when both `current_pay` and `target_pay` exist and the jump is extreme, show a warning but allow submission.

### M8 — OAuth failure is silent

- **Flow:** Signup/signin with GitHub (flow 1).
- **Scenario:** GitHub OAuth fails or the `/auth/callback` exchange fails.
- **What currently happens:** `signInWithGitHub` only does `console.error(error)` (`login/page.tsx` line 27); the user sees nothing. The callback redirects to `/login?error=auth`, but the login page never reads that query param — the user lands on a normal login page with no explanation of what went wrong.
- **Fix:** Read `?error=auth` (via `useSearchParams` in a Suspense boundary) and show a message; surface OAuth client errors in the UI too.

### M9 — Quiz submit has no pending state and can double-fire

- **Flow:** Quiz submission (flow 4).
- **Scenario:** User clicks "Submit quiz" twice (slow network), or clicks while a submit is in flight.
- **What currently happens:** `handleSubmit` (`roadmap-viewer.tsx` lines 56–62) never disables the button or tracks pending. Two concurrent submissions both read the same progress row, both increment `attempts`, and race on the upsert — attempts can be double-counted and progress updates can be lost/overwritten.
- **Fix:** Add a `pending` state; disable the button and show "Checking…" while awaiting; ignore re-entry.

### M10 — "Jobs you're ready for" appears before any ready roadmap

- **Flow:** Job matching (flow 5).
- **Scenario:** User has parsed a resume but has no ready roadmap (none generated, or generation pending/failed).
- **What currently happens:** `currentLevelIndex` defaults to 0 when the roadmap isn't `ready` (`page.tsx` lines 40–49), and the jobs section renders inside the `hasResume` branch regardless of roadmap status (lines 105–128). The user sees "Jobs you're ready for — Junior Frontend Developer" before they've done anything, including after a failed generation.
- **Fix:** Only render the jobs section when a `ready` roadmap exists, or relabel/empty-state it ("Complete roadmap levels to unlock job matches").

### M11 — No per-user rate limiting on LLM actions (N2)

- **Flow:** Resume parse + roadmap generation.
- **Scenario:** A user (or script) submits parse/generate repeatedly.
- **What currently happens:** There is no server-side rate limit or cooldown on `uploadResume`/`generateRoadmapAction`; every submission makes a paid LLM call. Spec N2 ("per-user rate limits and capped") is unmet.
- **Fix:** Add a per-user rate limit/cooldown (e.g., DB-backed counter or in-memory sliding window) on both LLM-backed actions, returning a "try again in N minutes" message.

---

## Low

### L1 — File validation is extension-only, not MIME + extension

- Spec R3 requires a MIME + extension allow-list; `uploadResume` checks only the filename extension (`actions.ts` lines 34–37). A renamed non-PDF passes the check and fails later inside `extractResumeText`. **Fix:** also validate `file.type` against `application/pdf` and the DOCX MIME types.

### L2 — Orphaned storage file and premature `resume_path` on parse failure

- `uploadResume` uploads the file and writes `resume_path` to the profile **before** parsing (`actions.ts` lines 39–48). If parsing fails, the file remains in the private bucket and the profile points at a resume that produced no profile. **Fix:** store `resume_path` only after a successful parse, or delete the object on failure.

### L3 — No 5 MB hint on the file input

- The 5 MB limit is enforced server-side only; the UI gives no hint, so users hit an error after selecting a large file. **Fix:** add helper text to the file input.

### L4 — Learning content gaps in the level view

- `key_points` from lessons are never displayed (`roadmap-viewer.tsx` lines 90–94); quiz `explanation`s are never shown, even after a wrong answer; lesson `content` is rendered as plain text despite the spec's Markdown contract (so `**bold**` appears literally); an empty `projects` array renders an empty "Project ideas" list with no empty state. **Fix:** render key points and explanations (especially on failure, revealing correct answers for review), render Markdown safely, and add an empty-state for projects.

### L5 — PersonalizeForm ignores server errors and races rapid clicks

- `apply()` (`personalize-form.tsx` lines 28–33) ignores the `{error}` returned by `updatePreferences`, gives no saved/error feedback, and rapid clicks can interleave optimistic UI updates with out-of-order persistence. **Fix:** disable buttons while saving, show a failure message, and await sequentially.

### L6 — No DB-level guarantee of one active roadmap; orphaned progress

- Deactivation is app-level only, so concurrent generation (two tabs, fast double-submit) can produce multiple `is_active=true` rows; the dashboard then picks an arbitrary one. Old `progress` rows are never cleaned up when roadmaps are replaced. **Fix:** partial unique index on `roadmaps(user_id) WHERE is_active`, and clean up or archive progress for deactivated roadmaps.

### L7 — Regeneration has no confirmation

- Submitting the Generate form when a ready roadmap exists immediately deactivates it (see H1) with no "this replaces your current roadmap" warning. **Fix:** confirm dialog when an active ready roadmap exists.

### L8 — `parseJsonFromLLM` fails on prose-before-JSON

- `parseJsonFromLLM` only strips ``` fences and trims (`llm.ts` lines 25–28). Output like "Sure! Here is the JSON: {...}" throws even though valid JSON is embedded. **Fix:** extract the first balanced `{...}` block as a fallback before `JSON.parse`.

### L9 — `/auth/callback` redirects to an unvalidated `next` param

- The callback uses `searchParams.get("next") ?? "/dashboard"` and redirects to `origin + next` without validation. Today the app only ever sets `/auth/callback` with no `next`, so impact is minimal, but any future caller could redirect to arbitrary same-origin paths or malformed URLs. **Fix:** allow-list the `next` value (e.g., must start with `/` and not `//`).

### L10 — Map node width mismatch with dagre layout

- `roadmap-map.tsx` lays out with `NODE_WIDTH = 240` but the rendered node is `w-[220px]` (line 47), so dagre spacing is 20px wider than actual nodes, causing slightly off-center edges/overlaps. **Fix:** use one width constant for both layout and CSS.

---

## Notes on things that work correctly

- Quiz scoring is genuinely server-side (`scoreQuiz` in `submitQuiz`), the 70% threshold is enforced, and a later worse score never re-locks a passed level (best-score/`passed` preserved in `level-actions.ts` lines 50–64).
- RLS policies in `supabase/migrations/0001_schema.sql` correctly isolate profiles, roadmaps, progress, and preferences; `job_postings` is read-only for all authenticated users; the storage bucket is private with owner-only policies.
- Resume text is length-capped at 20k chars before the LLM call, and pasted text is a supported fallback for the upload path.
- Roadmap JSON is schema-validated (3–8 levels, quiz option bounds) and retried once on parse failure.
