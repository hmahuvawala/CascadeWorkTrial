import type { RawRfp } from "../../lib/types";

/** fetch() with a hard timeout so a single slow/blocked source can't hang a crawl. */
export async function timedFetch(
  url: string,
  opts: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 8000, ...init } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        // Identify as a normal browser; some bid boards 403 unknown agents.
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        accept: "text/html,application/json,application/xhtml+xml,*/*",
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** ISO timestamp `n` days (fractional ok) before now. */
export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/**
 * Stamp curated seed RFPs with fresh posted dates spread across the last ~2.5
 * days so they survive the freshness filter and exercise the recency boost.
 */
export function freshenSeeds(seeds: Omit<RawRfp, "postedDate">[]): RawRfp[] {
  return seeds.map((s, i) => ({
    ...s,
    postedDate: isoDaysAgo(0.3 + (i % 6) * 0.45),
  }));
}
