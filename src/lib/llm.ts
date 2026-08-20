export async function completeChat(
  prompt: string,
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const res = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: opts.temperature ?? 0,
      max_tokens: opts.maxTokens ?? 4000,
    }),
  });

  if (!res.ok) throw new Error(`LLM request failed (${res.status})`);

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export function parseJsonFromLLM<T>(content: string): T {
  const cleaned = content
    .replace(/```[a-zA-Z]*\s*/g, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fallback: extract the first balanced { ... } object (LLMs often wrap JSON in prose).
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error("No valid JSON object found in LLM output");
  }
}
