import { createLogger } from "../../lib/logger";
import type { RawRfp, SourceOutcome } from "../../lib/types";
import { fetchCaleProcureEvents } from "./caleprocureLive";

const log = createLogger("src:caleprocure");

const EVENT_DETAIL_BASE =
  "https://caleprocure.ca.gov/pages/Events-BS3/event-details.aspx?EventId=";

/**
 * California eProcure event search. The old public-search.aspx URL 404'd;
 * the live board is a PeopleSoft/InFlight SPA and requires a headless browser.
 */
export async function fetch(): Promise<SourceOutcome> {
  try {
    log.info("fetching Cal eProcure events (live, Playwright)");
    const events = await fetchCaleProcureEvents();
    const rows: RawRfp[] = events.map((e) => ({
      source: "caleprocure",
      url: `${EVENT_DETAIL_BASE}${encodeURIComponent(e.eventId)}`,
      title: e.title,
      description: e.department || null,
      ownerCompany: e.department || null,
      location: "California",
      postedDate: new Date().toISOString(),
      estimatedValueUSD: null,
      rawText: `${e.title}. Event ID ${e.eventId}. Department: ${
        e.department || "California state agency"
      }. California state procurement via Cal eProcure.`,
    }));

    if (rows.length) {
      log.info(`live Cal eProcure returned ${rows.length} event(s)`);
      return {
        rows,
        live: true,
        note: `live Playwright · ${rows.length} active events`,
      };
    }
    log.warn("Cal eProcure returned 0 events");
    return { rows: [], live: false, note: "live scrape returned 0 events" };
  } catch (err) {
    log.error("Cal eProcure fetch failed", err);
    return {
      rows: [],
      live: false,
      note: `live fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
