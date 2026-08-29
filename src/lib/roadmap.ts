import { roadmapSchema, type ParsedProfile, type Roadmap } from "./schemas";
import { completeChat, parseJsonFromLLM } from "./llm";

function buildPrompt(
  profile: ParsedProfile,
  targetRole: string,
  targetPay: number | null,
): string {
  return `You are an expert career coach. Given a person's current profile and a target role, produce a step-by-step learning roadmap as a JSON object.

Current profile:
- Current title: ${profile.current_title ?? "Unknown"}
- Level: ${profile.level_band}
- Skills: ${profile.skills.join(", ") || "none listed"}
- Years experience: ${profile.years_exp ?? "unknown"}

Target role: ${targetRole}
Target salary: ${targetPay ?? "not specified"}

Generate exactly 4-5 ordered levels that take this person from their current level to the target role. Return ONLY a JSON object (no markdown, no commentary) with this shape:

{
  "target_role": "the target role",
  "levels": [
    {
      "index": 0,
      "title": "short milestone title",
      "description": "one sentence framing this level",
      "lessons": [
        { "title": "lesson title", "content": "a detailed markdown lesson body (see rules)", "key_points": ["takeaway 1", "takeaway 2", "takeaway 3"], "resources": [{ "title": "authoritative source title", "url": "https://example.com", "description": "what it covers" }] }
      ],
      "quiz": [
        { "question": "question text", "options": ["A", "B", "C", "D"], "answer_index": 0, "explanation": "why this answer is correct", "lesson_ref": 0 }
      ],
      "study_sheet": "2-3 sentence summary of this level",
      "projects": [
        { "title": "project title", "description": "what to build", "skills_used": ["skill"] }
      ]
    }
  ]
}

Rules:
- Each level must have exactly 2 lessons, 8 quiz questions, a study_sheet, and 1-2 projects.
- Each lesson's "content" is a detailed markdown body (600-900 words) teaching that specific topic: use "##" subsections (e.g. core concepts, a worked example, common pitfalls, a short practice task), bullet lists, and fenced code blocks for code examples where relevant.
- lessons[].key_points is a non-empty array of 3-5 short strings summarizing the most important takeaways.
- Each lesson's "resources" is a list of 2-4 authoritative sources for further reading (official documentation, MDN, reputable books/articles), ordered primary-first. Only include URLs you are confident exist; when unsure of an exact deep link, use the well-known top-level URL for that source.
- Every quiz question has exactly 4 options; answer_index is the 0-based index of the single correct option.
- Quiz questions must test the lessons: each question's "lesson_ref" is the 0-based index of the lesson it covers; distribute the 8 questions across the 2 lessons and make each question specific to that lesson's material.
- Content must be specific and educational for the target role, not generic filler.
- Return valid JSON only.`;
}

export async function generateRoadmap(
  profile: ParsedProfile,
  targetRole: string,
  targetPay: number | null,
): Promise<Roadmap> {
  const prompt = buildPrompt(profile, targetRole, targetPay);

  const first = await completeChat(prompt, {
    maxTokens: 16000,
    temperature: 0.3,
  });
  try {
    return roadmapSchema.parse(parseJsonFromLLM(first));
  } catch {
    const retry = await completeChat(
      prompt + "\n\nReturn ONLY valid JSON matching the schema exactly. No markdown, no prose.",
      { maxTokens: 8000, temperature: 0.1 },
    );
    return roadmapSchema.parse(parseJsonFromLLM(retry));
  }
}
