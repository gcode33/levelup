# LevelUp — QA Test Coverage Gap Analysis

Date: 2026-08-19
Scope reviewed:

- Pure logic: `src/lib/schemas.ts`, `src/lib/scoring.ts`, `src/lib/llm.ts`, `src/lib/parse.ts`, `src/lib/roadmap.ts`
- Server actions: `src/app/dashboard/actions.ts` (uploadResume), `src/app/dashboard/roadmap-actions.ts` (generateRoadmapAction), `src/app/dashboard/level-actions.ts` (submitQuiz), `src/app/dashboard/personalize-actions.ts` (updatePreferences), `src/app/login/actions.ts` (signIn/signUp/signOut)
- Supporting UI/components (for e2e gap analysis): `src/app/**/page.tsx`, `src/components/roadmap-map.tsx`, `src/components/roadmap-viewer.tsx`, `src/app/auth/callback/route.ts`, `src/proxy.ts`
- Existing tests: `tests/*.test.ts` (6 Vitest files), `e2e/*.spec.ts` (6 Playwright files)

Summary: unit tests cover only `schemas` (partially), `scoring.scoreQuiz`, and `llm` (partially). `parse.ts` and `roadmap.ts` have **zero** unit tests. **All five server actions have zero unit tests** (no Supabase mocking layer exists). E2E covers only happy-path sign-in, map render, one passing quiz, jobs list, and dark theme.

Priority legend: **P0** = core business logic with zero coverage; **P1** = important validation/error branches; **P2** = boundary/edge cases in already-covered modules; **P3** = e2e-level gaps.

---

## P0 — Core logic with zero coverage

### P0-1. `src/lib/roadmap.ts` — `generateRoadmap` retry logic (zero tests exist)

The retry/catch branch is the most valuable untested logic in the app, and no test file imports `roadmap.ts` at all.

| Case to add | Why it matters |
|---|---|
| First `completeChat` response is valid JSON matching `roadmapSchema` → returns the parsed roadmap and calls `completeChat` exactly once | Establishes the happy path and the single-call contract |
| First response is invalid (e.g. prose or schema mismatch) → asserts a second call is made with the retry prompt appended (`"...Return ONLY valid JSON matching the schema exactly..."`) and lower `temperature: 0.1` | The entire self-healing path is currently untested; a regression here silently doubles LLM cost or breaks recovery |
| Both first and retry responses are invalid → `generateRoadmap` rejects | Ensures errors surface instead of hanging/undefined |
| First call rejects (network/non-OK) → no retry is attempted and the error propagates | Confirms retry only covers parse/schema failures, not transport failures |
| Prompt building: `current_title: null` → `"Unknown"`, `years_exp: null` → `"unknown"`, empty `skills: []` → `"none listed"`, `targetPay: null` → `"not specified"` | Null-safe prompt branches in `buildPrompt` are never exercised |
| First call receives `maxTokens: 8000, temperature: 0.3` | Guards the generation budget/params |

Test location: new `tests/roadmap.test.ts` with `vi.mock` or dependency injection on `completeChat` (currently `completeChat` is imported directly, so mocking `./llm` or stubbing global `fetch` is required).

### P0-2. `src/lib/parse.ts` — entire module untested

No test imports `extractResumeText` or `parseResume`.

| Case to add | Why it matters |
|---|---|
| `extractResumeText` with a `.pdf` file → `unpdf` `extractText` called, page text joined with `\n` | PDF branch untested; corrupted PDFs throw an unhandled error today |
| `extractResumeText` with a `.docx` file → `mammoth.extractRawText` called with the buffer, returns `result.value` | DOCX branch untested |
| `extractResumeText` with `.txt` / no extension / `.PDF` (uppercase) | Unsupported-type throw is untested; uppercase is accepted via `toLowerCase()` and should be pinned by a test |
| `extractResumeText` with a file named `resume.` or `resume` (empty/no extension) | `split(".").pop()` edge produces `""`/`"resume"` → must throw the unsupported error, not crash |
| `parseResume` with text length exactly `20000` → NOT truncated; length `20001` → truncated to 20000 | Off-by-one at `MAX_TEXT_LENGTH`; also guards prompt-size budget |
| `parseResume` with empty string `""` and whitespace-only string | Currently sends empty/whitespace resume to the LLM (no early return); a test documents this behavior or drives a fix |
| `parseResume` when LLM returns invalid JSON → `parseJsonFromLLM` throws and propagates (no retry, unlike `generateRoadmap`) | Error path untested; also documents the asymmetry with roadmap generation |
| `parseResume` when LLM returns valid JSON with wrong shape → `parsedProfileSchema.parse` throws and propagates | Zod error path untested |
| `parseResume` happy path with mocked `completeChat` → returns the parsed profile | Baseline for all of the above |

Test location: new `tests/parse.test.ts` (mock `unpdf`, `mammoth`, and `./llm`).

### P0-3. `src/app/dashboard/level-actions.ts` — `submitQuiz` progression logic (zero unit tests; e2e only passes once)

This is the core gamification state machine. It currently has zero unit coverage and the single e2e test only exercises "first attempt, pass, level 0".

| Case to add | Why it matters |
|---|---|
| Not authenticated → `{ error: "Not authenticated", correct: 0, total: 0, score: 0, passed: false }` | Auth guard branch untested |
| Roadmap id not found (or belongs to another user) → `"Level not found"` | Security-relevant: cross-user access via `.eq("user_id", user.id)` untested; also note the message is misleading when the roadmap (not the level) is missing |
| `levelIndex` not present in `levels` → `"Level not found"` | Selection branch untested |
| First-ever quiz attempt (no `progress` row): `completed` defaults, `attempts: 1`, `passed` recorded; on pass `current_level_index` becomes `levelIndex + 1` | The upsert-from-scratch path is never unit-tested |
| Failing attempt: `current_level_index` stays unchanged | Fail branch untested |
| Retake with a better score: `best_score = max(prev, new)`, `attempts` increments | Best-score accumulation untested |
| Retake with a worse score: `best_score` unchanged, `passed` stays sticky (`prev.passed \|\| passed`) | Sticky-pass logic untested — a regression would relock a passed level |
| Passing a later level when `current_level_index` is already higher (e.g. pass level 0 again while at index 2) → index does not regress | `Math.max` guard untested |
| `answers` shorter than quiz, longer than quiz, and `-1` sentinel (the viewer sends `answers[i] ?? -1` for unanswered) | The UI's unanswered contract (`-1`) is never tested at action level |
| Progress upsert returns a DB error → returns error alongside `correct/total/score/passed` | Error branch untested |
| `roadmap.levels` is `null`/not an array (malformed DB row) → `"Level not found"` not a crash | Defensive `?? []` branch untested |

Test location: new `tests/level-actions.test.ts` with a mocked Supabase client (mock `@/lib/supabase/server`).

### P0-4. `src/app/dashboard/actions.ts` — `uploadResume` (zero unit tests; no e2e file-upload test)

| Case to add | Why it matters |
|---|---|
| Not authenticated → `"Not authenticated"` | Guard branch untested |
| Neither file nor pasted text → `"Upload a resume or paste your resume text"` | Empty-submission branch untested |
| File present and non-empty → pasted text is ignored (file wins); zero-byte file + pasted text → pasted is used | Precedence logic untested; zero-byte file falls through to the pasted branch |
| `file.size > 5 * 1024 * 1024` → `"File too large (max 5 MB)"`; `file.size === 5 MB` exactly → allowed | Size boundary/off-by-one untested |
| Extension `.txt`, no extension, and uppercase `.PDF`/`.DOCX` | Extension validation and case-insensitivity untested |
| Storage upload returns an error → error message returned and parse never runs | Upload-failure branch untested |
| `parseResume` throws → caught, error message returned, no rethrow | The try/catch branch untested |
| Profiles DB update of parsed fields fails → `dbError.message` returned | DB error branch untested |
| **`extractResumeText(file)` throws (corrupt PDF/DOCX)** → currently **outside** the try/catch, so the action rejects with an unhandled error instead of returning `{ error }` | This is a real bug-shaped gap: extract happens at line 50, the try/catch starts at line 57. A test will pin the desired behavior (return an error, not a 500) |
| `profiles.update({ resume_path })` result is awaited but its error is never checked | Documents a silently-ignored failure; test should pin intended behavior |

Test location: new `tests/upload-resume.test.ts` with mocked Supabase, `extractResumeText`, and `parseResume`.

---

## P1 — Important validation/error branches

### P1-1. `src/app/dashboard/roadmap-actions.ts` — `generateRoadmapAction` (zero unit tests)

| Case to add | Why it matters |
|---|---|
| Not authenticated → `"Not authenticated"` | Guard branch untested |
| `target_role` missing or whitespace-only → `"Target role is required"` | Trim-then-check branch untested |
| `target_pay` non-numeric (`"abc"`, `"12abc"`) → `"Target pay must be a number"` | NaN branch untested |
| `target_pay` `"0"`, negative (`"-5"`), `"1e3"`, `"Infinity"` → currently accepted (only NaN is rejected) | No range/positivity validation exists; tests would pin current behavior and expose that negative/Infinity pay can be written to the DB |
| No profile row / no `level_band` → `"Parse your resume first"` | Gating branch untested |
| Profile `skills` is null → defaults to `[]` when constructing `ParsedProfile` | Null-coalescing branch untested |
| Roadmap insert fails → `"Failed to create roadmap"` | Insert-error branch untested |
| `generateRoadmap` throws → roadmap status updated to `"failed"`, error message returned | Failure cleanup branch untested; also test that a failure of the `status: "failed"` update itself does not mask the original error |
| `update({ levels, status: "ready" })` fails after successful generation → error returned, but roadmap row stays `status: "pending"` with no levels | Inconsistent-state edge untested |
| Success → `levelsCount === generated.levels.length`, `revalidatePath("/dashboard")` called | Happy path untested |
| Deactivate-existing-roadmaps update error is not checked | Silently-ignored failure worth pinning |

Test location: new `tests/roadmap-actions.test.ts` with mocked Supabase and `generateRoadmap`.

### P1-2. `src/app/login/actions.ts` — `signUp`, `signOut`, `signIn` branches (e2e only covers sign-in success + invalid credentials)

| Case to add | Why it matters |
|---|---|
| `signUp` returns error (duplicate email / weak password) → `{ error, message: null }` | Sign-up error path untested in any layer |
| `signUp` succeeds but `data.session` is null (email confirmation enabled) → returns the "check your email" message | The `!data.session` branch is untested — this is the default flow when Supabase confirmations are on |
| `signUp` succeeds with a session → `redirect("/dashboard")` throws `NEXT_REDIRECT` | Redirect branch untested |
| `signOut` → `signOut()` called, `redirect("/login")` thrown | No test anywhere exercises sign-out |
| `signIn` with missing/empty email or password (client `required` bypassed) | Server-side relies entirely on Supabase validation; behavior should be pinned |
| `redirect` throws — tests must assert `rejects.toThrow` / `NEXT_REDIRECT` digest | Next.js server actions throw on redirect; a naive test would fail |

Test location: new `tests/login-actions.test.ts` (mocked Supabase; assert redirect as a thrown error).

### P1-3. `src/app/dashboard/personalize-actions.ts` — `updatePreferences` (zero unit tests; e2e only checks dark class)

| Case to add | Why it matters |
|---|---|
| Not authenticated → `{ error: "Not authenticated" }` | Guard branch untested |
| Upsert fails → `{ error: error.message }` | Error branch untested |
| Success → `{ error: null }` and `revalidatePath("/", "layout")` | Happy path untested |
| Arbitrary/invalid `theme` and `background` values are accepted and persisted (no allow-list validation) | `background` is injected into `document.body.style.backgroundColor` (client) and a `style` attr (server layout) — no validation means garbage/CSS values can be stored; pin current behavior or drive a fix |

Test location: new `tests/personalize-actions.test.ts`.

### P1-4. `src/lib/llm.ts` — remaining `completeChat`/`parseJsonFromLLM` branches

| Case to add | Why it matters |
|---|---|
| `completeChat` with `ok: true` but `choices: []` (or missing `message.content`) → returns `""`; **the existing "defaults" test never asserts the return value** | Empty-choices branch is only half-tested today |
| `completeChat` response `res.json()` rejects (invalid JSON body) → propagates | Malformed-response branch untested |
| `completeChat` fetch rejects (network error) → propagates | Transport-failure branch untested |
| `parseJsonFromLLM` with uppercase fence ` ```JSON ... ``` ` | LLMs frequently emit `JSON` with different casing; the regex only strips lowercase `json` and bare fences, so uppercase-fence input currently fails to parse |
| `parseJsonFromLLM` with prose before/after the JSON ("Here is your JSON: {...}") | Common LLM output pattern; currently throws |
| `parseJsonFromLLM` with JSON string values / arrays / `null` at top level | Cast-to-generic edge untested |
| `completeChat` with missing `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL` env vars | Produces `fetch("undefined/chat/completions")` silently; behavior should be pinned or guarded |

Test location: extend `tests/llm.test.ts`.

---

## P2 — Boundary/edge cases in already-covered modules

### P2-1. `src/lib/scoring.ts` — `scoreQuiz`

| Case to add | Why it matters |
|---|---|
| Answers array longer than quiz (extra answers ignored) | `forEach` over quiz only — behavior unpinned |
| All questions unanswered via shorter array (currently only "partially answered" is tested) | Full-miss path untested |
| `-1` sentinel answers (what `roadmap-viewer` sends for unanswered) counted as wrong | Contract between viewer and scorer untested |
| Single-question quiz (1/1 passes, 0/1 fails) | Boundary with total=1 untested |
| 3-question quiz: 2/3 = 0.666... fails, 3/3 passes | Rounding-sensitive threshold for totals not divisible into 70% untested |
| String answers (`"0"` vs number `0`) do not match | Type-strict comparison untested |
| `null`/`undefined` answers counted as wrong | Defensive behavior untested |

Test location: extend `tests/scoring.test.ts` / `tests/edge-cases.test.ts`.

### P2-2. `src/lib/schemas.ts` — schema gaps (several are also schema/prompt mismatches)

| Case to add | Why it matters |
|---|---|
| `roadmapSchema`: `target_role: ""` (empty string) is **accepted** — pin or fix | Server action trims target role, but the schema itself doesn't enforce non-empty |
| `roadmapSchema`: two levels with the **same `index`** are accepted | Duplicate indexes break `roadmap-viewer`'s `levels.find` and React keys; schema doesn't check uniqueness |
| `roadmapSchema`: **8 levels accepted** (max boundary only tested on the reject side, 9) | Accept-side boundary untested |
| `levelSchema`: `index` negative / float / missing rejected (only quiz `answer_index` negative is tested) | Level index validation untested |
| `quizQuestionSchema`: `answer_index === options.length` (equal to length) rejected — existing test only uses 5 vs 2 options | The refine boundary `>= length` untested at exactly length |
| `quizQuestionSchema`: fractional `answer_index` (`0.5`) rejected by `.int()` | Untested |
| `lessonSchema`: `key_points: []` (empty array) is **accepted**, but the roadmap prompt requires "non-empty array of strings" | Schema/prompt mismatch untested — LLM output with empty key_points would pass validation but violate the prompt contract |
| `levelSchema`: `study_sheet: ""` (empty string) is **accepted**, but prompt requires a study_sheet | Same mismatch class |
| `projectSchema`: `skills_used: []` accepted; prompt says 1–2 projects with skills | Prompt/schema mismatch untested |
| `parsedProfileSchema`: missing required keys (`level_band`/`skills` omitted) rejected; unknown extra keys stripped | Zod default strip behavior untested |
| `parsedProfileSchema`: `skills: [1]` (non-string elements) rejected; `current_pay: "85000"` (string) rejected | Element-type validation untested |
| `levelBandSchema`: `"junior"` (wrong case) rejected | Enum case-sensitivity untested |

Test location: extend `tests/schemas.test.ts`, `tests/roadmap-schema.test.ts`, `tests/edge-cases.test.ts`.

### P2-3. `src/lib/llm.ts` — `parseJsonFromLLM` regex robustness

| Case to add | Why it matters |
|---|---|
| JSON containing a literal triple-backtick inside a string value | The regex strips ```` ``` ```` anywhere, corrupting valid JSON |
| Fences with whitespace between backticks and `json` (```` ``` json ````) | Regex doesn't match; LLMs sometimes emit this |
| `parseJsonFromLLM` with only fences and no body (`"```json```"`) | Strips to empty → throws (related to existing empty-string test but distinct input) |

---

## P3 — E2E gaps (Playwright)

| Missing e2e scenario | Why it matters |
|---|---|
| **Failing a quiz** shows the "need at least 70%" message and does NOT reveal the study sheet | Only the pass path is tested (`level-loop.spec.ts`); the fail/feedback path and study-sheet gating are untested |
| **Retaking a quiz** after a pass/fail: attempts increment, best score kept, level stays unlocked | Progression persistence across attempts untested |
| **Unlocking the next level** after passing level 0 (map shows next node as current, previous as completed) | `currentLevelIndex` advancement and map status rendering untested |
| **Locked level** shows the "Complete the previous level to unlock" message and no quiz | `unlocked` branch in `roadmap-viewer` untested |
| **Submitting with unanswered questions** (sends `-1`) | The viewer→action sentinel contract untested end-to-end |
| **Sign out** returns to `/login` | No e2e covers `signOut` |
| **Sign up** with a new email (either confirmation message or redirect) | `signUp` flow completely untested e2e |
| **Resume upload** (PDF or DOCX) and **pasted resume text** | Core onboarding flow untested e2e (LLM-dependent, but could be mocked or run against a stubbed endpoint) |
| **Upload error messages**: >5MB file, `.txt` file, empty submission | File validation UI untested |
| **Roadmap generation** success (`levelsCount` message) and failure | Core value prop untested e2e |
| **Personalize**: background color applied and **persisted after reload**; light theme | Only dark class is checked; persistence (DB round-trip) untested |
| **Jobs**: user with no roadmap/`currentLevelIndex = 0` sees junior jobs; a job with no `url` hides the Apply link | `min_level_index` boundary and URL-optional branch untested |
| **Map**: clicking a node selects it (ring highlight + detail panel switch); locked/completed node styling; empty-roadmap rendering | `onNodeClick`/`selectedIndex` and status styling untested |

E2E infrastructure note: `level-loop.spec.ts` seeds level 2 with `quiz: []` and `study_sheet: ""`, which `roadmapSchema` would reject — the seed bypasses validation, so the suite doesn't prove the app handles schema-valid data only (worth a fixture cleanup or a negative test).

---

## Cross-cutting notes

1. **No server-action test infrastructure exists.** All five actions import `createClient` from `@/lib/supabase/server` directly; there is no mock/DI seam. Adding `tests/*-actions.test.ts` requires a `vi.mock("@/lib/supabase/server")` convention (or dependency injection) that doesn't exist yet — build it first.
2. **No coverage tooling is configured.** `vitest.config.mts` has no `coverage` block and there is no `@vitest/coverage-v8` dependency, so gaps can't be tracked automatically. Add coverage thresholds once the P0 tests land.
3. **Untested routes/middleware (not in the requested action scope but adjacent):** `src/app/auth/callback/route.ts` (code present/absent, exchange success/error), `src/proxy.ts` (cookie refresh `setAll`), and `src/app/dashboard/page.tsx` `currentLevelIndex` derivation from `progress`. None have any automated coverage.
4. **Test hygiene:** `tests/llm.test.ts` mutates `process.env.LLM_*` and only calls `vi.unstubAllGlobals()` in `afterEach` — env vars leak across tests/files. Add `vi.unstubAllEnvs()` or save/restore.
5. **Bug-shaped gaps worth a test-first fix:** (a) `uploadResume` extracts text outside its try/catch; (b) `generateRoadmapAction` can leave a roadmap `status: "pending"` when the post-generation update fails; (c) `roadmap-viewer` doesn't render `result.error` distinctly — an action error renders as "❌ 0/0 — need at least 70%", misleading the user.
