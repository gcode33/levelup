export type Job = {
  id: string;
  title: string;
  company: string;
  url: string;
  min_level_index: number;
  source: string;
  location: string;
};

const REMOTIVE_URL = "https://remotive.com/api/remote-jobs";

// Rough seniority → level index, so real job postings can be matched against
// the user's current roadmap level.
function levelOf(title: string): number {
  const t = title.toLowerCase();
  if (/\b(junior|entry.?level|intern|graduate|trainee|associate)\b/.test(t)) return 0;
  if (/\b(staff|principal|architect)\b/.test(t)) return 3;
  if (/\b(manager|director|head of|vp|vice president|cto|chief)\b/.test(t)) return 4;
  if (/\b(senior|sr\.?|lead)\b/.test(t)) return 2;
  return 1;
}

// Keep the list tech-relevant — Remotive also returns sales/marketing roles.
const TECH =
  /(developer|engineer|front.?end|back.?end|full.?stack|software|web|devops|react|node|data|qa|android|ios|mobile|cloud|security|machine learning)/i;

export async function fetchRemoteJobs(level: number, limit = 10): Promise<Job[]> {
  try {
    const res = await fetch(`${REMOTIVE_URL}?limit=100`, {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { jobs?: Array<Record<string, unknown>> };
    return (data.jobs ?? [])
      .map((j) => ({
        id: String(j.id ?? j.url ?? ""),
        title: String(j.title ?? ""),
        company: String(j.company_name ?? ""),
        url: String(j.url ?? ""),
        min_level_index: levelOf(String(j.title ?? "")),
        source: "remotive",
        location: String(j.candidate_required_location ?? ""),
      }))
      .filter(
        (j) =>
          TECH.test(j.title) &&
          j.min_level_index <= level &&
          j.url.startsWith("https://"),
      )
      .sort((a, b) => b.min_level_index - a.min_level_index)
      .slice(0, limit);
  } catch {
    return [];
  }
}
