import { extractText } from "unpdf";
import mammoth from "mammoth";
import { parsedProfileSchema, type ParsedProfile } from "./schemas";
import { completeChat, parseJsonFromLLM } from "./llm";

const MAX_TEXT_LENGTH = 20000;

export async function extractResumeText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    const { text } = await extractText(new Uint8Array(buffer));
    return text.join("\n");
  }
  if (name.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  throw new Error("Unsupported file type. Use PDF or DOCX.");
}

export async function parseResume(text: string): Promise<ParsedProfile> {
  const clamped = text.slice(0, MAX_TEXT_LENGTH);

  const prompt = `You are a resume parser. Extract structured data from the resume text below and return ONLY a JSON object (no markdown, no commentary) with exactly these keys:
- "current_title": the person's current or most recent job title as a string, or null if unknown
- "level_band": exactly one of "Junior", "Mid", "Senior", "Staff", inferred from title and years of experience
- "skills": an array of strings (technical and professional skills)
- "years_exp": total years of professional experience as a number, or null
- "current_pay": annual salary as a number if mentioned, otherwise null

Resume text:
"""
${clamped}
"""

Return only the JSON object.`;

  const content = await completeChat(prompt, { maxTokens: 2000 });
  return parsedProfileSchema.parse(parseJsonFromLLM(content));
}
