# Spec Critique — LevelUp

## Verdict
NEEDS_REVISION

## Blockers

1. **Quiz scoring and "passing score" are never defined.** R9 states each level is completed by "passing a quiz," and the acceptance criteria require that "completing a quiz with a passing score unlocks the next node," but the spec never says what "passing" means (threshold, per-question weighting, or how retries interact with the unlock). `POST /api/progress` is only described as "record quiz completion for a level, advance `current_level_index`" (line 71) with no request/response contract. The core progression mechanic cannot be implemented as written. → Define a concrete threshold (e.g., ≥70% of questions correct), whether score is count-correct or weighted, and the full `/api/progress` input/output.

2. **Target wage is simultaneously required and optional — a direct contradiction.** R6 says users "specify an aspiring role and target wage," but the Edge Cases say "Empty target or no wage → require target role; wage optional" (line 98). `/api/roadmap/generate` takes `target_pay` (line 68), and the error path "unrealistic target wage jump (warn but allow)" (line 88) assumes a wage is present. The spec never resolves whether `target_pay` is nullable, so validation cannot be implemented both ways. → Pick one. If wage is optional, make `target_pay` nullable and specify how the "wage jump" warning behaves when `current_pay` or `target_pay` is absent.

## High

1. **Synchronous route handler conflicts with the "pending" state and serverless timeouts.** `/api/roadmap/generate` is specified to "call the LLM, validate the JSON, write a `roadmaps` row, return it" (line 68), but the error path says "LLM timeout or rate limit → retry, then persist a 'pending' roadmap" (line 95). A serverless route that times out cannot execute a later "persist pending" step; there is no background job/queue, and no mention of writing a `pending` row *before* starting generation. → Specify either (a) pre-write a `status='pending'` row and complete it asynchronously via a worker/queue, or (b) a synchronous contract with a bounded timeout, and enumerate `status` values.

2. **Quiz scoring authority is unstated (security).** `answer_index` lives in the server-side `levels` JSON, so the server *can* score — but `/api/progress` never says whether the client submits raw answers (server scores) or a self-reported score. If self-reported, a client can POST a passing score for a level it never passed, bypassing the entire unlock gate. RLS protects data isolation (R2) but not this integrity gap. → Client submits answers; the server computes the score, enforces the threshold, and returns the resulting unlock state.

3. **Target/pay is duplicated across `profiles` and `roadmaps`, and the cardinality is ambiguous.** `profiles` holds `target_role`/`target_pay` (line 31) while `roadmaps` also holds `target_role`/`target_pay` (line 32). `roadmaps` has `id` + `user_id` (implying many per user), but `profiles` holds a single target (implying one current target), and there is no endpoint to list a user's roadmaps. → Decide: one-roadmap-per-user (drop the duplicate columns from `profiles`, or treat them as "latest") or many (add a list endpoint and an "active" roadmap notion), and state which is the source of truth on regeneration.

4. **Job matching contradicts its own schema.** R10 says postings are "matched to what they've learned so far" (i.e., skills), but `job_postings` only has `min_level_index` (line 35), and `GET /api/jobs?level=N` matches on `min_level_index <= N` (line 72). There is no mechanism to match by skills learned through level N. → Clarify that v1 matching is level-index-only and explicitly defer skill-based matching, or add a skills mapping to support it.

5. **Storage/upload security is unspecified.** R2 covers *database* RLS only, but resumes are files in Supabase Storage. There is no Storage bucket policy (can another user read someone's `resume_path` via a URL?), no max file size, no MIME/extension allow-list on `POST /api/resume/upload` (line 66), and no length cap on `resume_text` before it is sent to the LLM (cost abuse + prompt injection — a resume is untrusted input). → Add Storage-level RLS (private bucket, owner-only reads), a file-size limit, a PDF/DOCX allow-list, and a resume-text length cap enforced before the LLM call.

6. **The resume-parse LLM schema is promised but never defined.** Line 75 promises "structured output against a fixed JSON schema," but only the level taxonomy is given. The parse endpoint's output contract (field types, the enum for `level`, how `skills`/`years_exp`/`current_pay` map) is unspecified, and "validate the JSON" (line 68) has no stated rules. The `levels` shape is given (lines 37–60) but the parse output is not. → Specify the parse JSON schema (as a shared TS type, e.g. zod) and the roadmap validation rules (e.g., ≥3 levels, non-empty lessons/quiz, `answer_index` within `options` bounds).

## Medium

1. **Lesson completion is not modeled.** R9 says a level is "completed by studying lessons, passing a quiz," but `progress.completed` only stores "per-level quiz scores" (line 33). Nothing tracks whether lessons were read, so a user can skip lessons and go straight to the quiz. → Either add per-lesson completion to `progress`, or state explicitly that lesson reading is untracked.

2. **`roadmaps.status` values are undefined** (line 32), yet the error path relies on a "pending" state (line 95). → Enumerate statuses (e.g., `pending`, `ready`, `failed`).

3. **The quiz-retry rule is a literal open decision.** Edge case line 97: "store best or latest score (decide and document)." This interacts with unlock — does a later worse score re-lock a node? → Resolve it; recommend "best" with no re-lock.

4. **Taxonomy vs. roadmap levels are never mapped.** The taxonomy is four values (`Junior → Mid → Senior → Staff`, line 75), but roadmap levels are `index: 0..N` with N LLM-determined (lines 42–44). The spec claims the taxonomy gives roadmaps "consistent coordinates" but never maps taxonomy level to the number or ordering of roadmap levels. → State whether roadmap length is LLM-fixed or capped, and how the start/end levels map onto the taxonomy.

5. **The manual-entry fallback has no endpoint.** Error paths and edge cases say "fall back to a manual paste form" (line 88) / manual entry (line 92), but the only profile writer is `/api/resume/parse`. → Add a `POST /api/profile` (manual entry) or state that `parse` accepts pasted text without a stored file.

6. **`job_postings` needs a distinct RLS policy.** R2 says users read/write "only their own data" (line 10), but `job_postings` must be readable by all authenticated users — a separate read-only policy that is not stated. → Document a read-only-for-all-authenticated policy on `job_postings`.

7. **React Flow map behavior is underspecified despite being flagged the highest-risk piece** (line 107). There is no layout strategy (auto-layout for a variable LLM-produced level count), no node/edge semantics, no locked-node interaction (can a locked node be previewed?), and no definition of "animated" (line 16). → Specify auto-layout (e.g., dagre/elk), locked-node behavior, and the target animation states.

8. **`background` in `user_preferences` is ambiguous** (line 34): a color, a preset theme, a URL, or an uploaded image (which would require Storage + policies)? → Define its type and whether custom image upload is in scope.

## Low

1. **`resume_text` stores raw PII** (name/phone/address/salary) in plaintext with no retention/deletion policy mentioned. → Note data-retention intent, or drop `resume_text` after parsing.

2. **Terminology drift.** "level" is used for at least four distinct things: `profiles.level` (taxonomy), `roadmaps.levels` (JSON), `current_level_index`, `min_level_index`. → Normalize names (e.g., `current_level` vs `roadmap_levels` vs `level_band`).

3. **`PATCH /api/preferences` assumes the row already exists** (line 73), but no onboarding step creates `user_preferences`. → State that onboarding creates the row, or make the endpoint an upsert.

4. **Acceptance criteria omit several listed edge cases** — scanned PDF, no-resume path, career change, quiz retry, idempotency, resume-parse fallback — so "done" is ambiguous. → Add acceptance criteria for the fallback paths.

5. **No endpoint to delete/abandon a roadmap** or clear progress other than regenerate. → Optional; note if in scope.

## Suggested improvements

- Define all LLM output schemas as shared TypeScript/zod types, reused for server validation and client typing.
- Add server-side per-user rate limiting on `generate`/`parse` (complements N2 cost control).
- Wire a seeded demo-resume library (N2) behind a dev-only "load sample resume" affordance to avoid paid LLM calls during testing.
- Consider a background queue (Supabase Edge Functions / Queues / `pg_cron`) if real LLM latency exceeds the deployment's function timeout.
- Prototype the React Flow map first (per line 107) against a fixed 5-level fixture before wiring live generation.
