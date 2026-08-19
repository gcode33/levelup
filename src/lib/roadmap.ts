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
        { "title": "lesson title", "content": "2-3 sentence lesson body", "key_points": ["point"] }
      ],
      "quiz": [
        { "question": "question text", "options": ["A", "B", "C", "D"], "answer_index": 0, "explanation": "why" }
      ],
      "study_sheet": "2-3 sentence summary of this level",
      "projects": [
        { "title": "project title", "description": "what to build", "skills_used": ["skill"] }
      ]
    }
  ]
}

Rules:
- Each level must have exactly 2 lessons, 2 quiz questions, a study_sheet, and 1-2 projects.
- Every quiz question has exactly 4 options; answer_index is the 0-based index of the single correct option.
- lessons[].key_points is a non-empty array of strings.
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
    maxTokens: 8000,
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
