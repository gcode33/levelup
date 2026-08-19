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
  const jsonText = content.replace(/```json|```/g, "").trim();
  return JSON.parse(jsonText) as T;
}
