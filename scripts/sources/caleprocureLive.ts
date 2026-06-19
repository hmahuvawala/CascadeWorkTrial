import { chromium, type Browser } from "playwright";
import { createLogger } from "../../lib/logger";
import {
  extractCaleProcureEventId,
  fetchCaleProcureEventDetailText,
} from "../../lib/caleprocureDetail";

export { extractCaleProcureEventId, fetchCaleProcureEventDetailText };

const log = createLogger("src:caleprocure-live");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export type CaleProcureEvent = {
  eventId: string;
  title: string;
  department: string;
};

const EVENT_SEARCH_URL =
  "https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx";

/** Reuse one Playwright result per crawl run (caleprocure + ca_hhs). */
let crawlSessionCache: CaleProcureEvent[] | null = null;
let inflightFetch: Promise<CaleProcureEvent[]> | null = null;

export function clearCaleProcureSessionCache(): void {
  crawlSessionCache = null;
  inflightFetch = null;
}

async function scrapeEvents(browser?: Browser): Promise<CaleProcureEvent[]> {
  const ownBrowser = browser ?? (await chromium.launch({ headless: true }));
  try {
    const page = await ownBrowser.newPage({ userAgent: USER_AGENT });
    log.info("loading Cal eProcure event search (Playwright)");
    await page.goto(EVENT_SEARCH_URL, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForTimeout(2500);

    const events = await page.evaluate(() => {
      const rows: { eventId: string; title: string; department: string }[] = [];
      document.querySelectorAll("tr").forEach((tr) => {
        const cells = [...tr.querySelectorAll("td")].map((td) =>
          (td.textContent ?? "").replace(/\s+/g, " ").trim()
        );
        if (cells.length < 2) return;

        const eventId =
          cells.find((c) => /^\d{5,}/.test(c) || /^\d+-\d+/.test(c)) ?? "";
        const title =
          cells.find(
            (c) =>
              c.length > 12 &&
              c !== eventId &&
              !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(c) &&
              !/^\d{1,2}:\d{2}/.test(c)
          ) ?? cells[1] ?? "";
        if (!eventId || !title || title.length < 8) return;

        rows.push({
          eventId,
          title,
          department: cells[2] && cells[2] !== title ? cells[2] : "",
        });
      });

      const seen = new Set<string>();
      return rows.filter((r) => {
        const key = `${r.eventId}|${r.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });

    log.info(`Cal eProcure live scrape returned ${events.length} event(s)`);
    crawlSessionCache = events;
    return events;
  } finally {
    if (!browser) await ownBrowser.close();
  }
}

/** Scrape the live Cal eProcure event search table (PeopleSoft/InFlight SPA). */
export async function fetchCaleProcureEvents(
  browser?: Browser
): Promise<CaleProcureEvent[]> {
  if (crawlSessionCache) {
    log.info(
      `reusing Cal eProcure session cache (${crawlSessionCache.length} events)`
    );
    return crawlSessionCache;
  }
  if (!inflightFetch) {
    inflightFetch = scrapeEvents(browser).finally(() => {
      inflightFetch = null;
    });
  }
  return inflightFetch;
}
