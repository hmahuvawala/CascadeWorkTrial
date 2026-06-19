/**
 * Generic open-web search via Serper (Google index). Used to discover public
 * pages about an organization's people. We deliberately exclude social networks
 * (LinkedIn et al.) — those are auth-walled and/or off-limits; we read public
 * first-party pages, news, and directories instead.
 */
import { createLogger } from "./logger";

const SERPER_SEARCH = "https://google.serper.dev/search";
const log = createLogger("webSearch");

export type WebResult = { url: string; title: string; snippet: string };

const SOCIAL_DOMAINS = [
  /linkedin\.com/i,
  /facebook\.com/i,
  /twitter\.com/i,
  /\bx\.com/i,
  /instagram\.com/i,
  /youtube\.com/i,
  /tiktok\.com/i,
  /reddit\.com/i,
  /pinterest\.com/i,
];

function isSocial(url: string): boolean {
  return SOCIAL_DOMAINS.some((rx) => rx.test(url));
}

export async function webSearch(
  query: string,
  num = 10,
  timeoutMs = 8000
): Promise<WebResult[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) {
    log.warn("webSearch: no SERPER_API_KEY — open-web discovery disabled");
    return [];
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(SERPER_SEARCH, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num }),
    });
    if (!res.ok) {
      log.warn(`webSearch: Serper returned ${res.status}`);
      return [];
    }
    const json = (await res.json()) as {
      organic?: { link?: string; title?: string; snippet?: string }[];
    };
    const out = (json.organic ?? [])
      .filter((o) => o.link && !isSocial(o.link))
      .map((o) => ({
        url: o.link!,
        title: o.title ?? o.link!,
        snippet: o.snippet ?? "",
      }));
    log.info(`webSearch: ${out.length} non-social result(s)`, { query });
    return out;
  } catch {
    log.warn("webSearch: request failed/timed out", { query });
    return [];
  } finally {
    clearTimeout(timer);
  }
}
