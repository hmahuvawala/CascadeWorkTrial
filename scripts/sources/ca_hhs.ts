import * as cheerio from "cheerio";
import { createLogger } from "../../lib/logger";
import type { RawRfp, SourceOutcome } from "../../lib/types";
import { fetchCaleProcureEvents } from "./caleprocureLive";
import { timedFetch } from "./util";

const log = createLogger("src:ca_hhs");

const HEALTHCARE_TERMS = [
  "health",
  "hospital",
  "clinic",
  "medical",
  "ambulatory",
  "outpatient",
  "behavioral",
  "dental",
  "surgery",
  "patient",
  "nursing",
  "pharmacy",
  "laboratory",
  "radiology",
  "rehab",
  "MOB",
  "OSHPD",
];

function isHealthcare(text: string): boolean {
  const lower = text.toLowerCase();
  return HEALTHCARE_TERMS.some((t) => lower.includes(t.toLowerCase()));
}

/** Pull a human project label from UC Davis PDF paths (often more specific than link text). */
function projectLabelFromUrl(href: string, linkTitle: string): string {
  const decoded = decodeURIComponent(href);
  const folder =
    decoded.match(/\/documents\/pdfs\/([^/]+)\/[^/]+\.pdf/i)?.[1] ?? "";
  const file =
    decoded.match(/\/([^/]+)\.pdf/i)?.[1]?.replace(/[-_]+/g, " ") ?? "";
  const hint = [folder, file]
    .join(" ")
    .replace(/%20/g, " ")
    .replace(/\b\d{5,}\b/g, "")
    .trim();
  if (hint.length > 8 && !/^advertisement$/i.test(hint)) return hint;
  return linkTitle;
}

/** UC Davis Health publishes server-rendered bid advertisements. */
async function fetchUcDavisHealthBids(): Promise<RawRfp[]> {
  const url =
    "https://health.ucdavis.edu/facilities/work-with-us/contractors/out-to-bid";
  log.info("fetching UC Davis Health out-to-bid (live)");
  const res = await timedFetch(url, { timeoutMs: 12_000 });
  if (!res.ok) throw new Error(`ucdavis health ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const rows: RawRfp[] = [];
  const seen = new Set<string>();

  $("a").each((_, el) => {
    const title = $(el).text().trim();
    let href = $(el).attr("href") ?? "";
    if (!title || title.length < 8) return;
    if (!/advertisement|announcement|rfp|prequal|bid|proposal/i.test(title)) return;
    if (!href.startsWith("http"))
      href = href.startsWith("/")
        ? `https://health.ucdavis.edu${href}`
        : `https://health.ucdavis.edu/${href}`;
    if (seen.has(href)) return;
    seen.add(href);
    const projectLabel = projectLabelFromUrl(href, title);
    rows.push({
      source: "ca_hhs",
      url: href,
      title: `UC Davis Health — ${projectLabel}`,
      description: `${projectLabel}. Healthcare facilities / construction procurement (UC Davis Health).`,
      ownerCompany: "UC Davis Health",
      location: "Sacramento, California",
      postedDate: new Date().toISOString(),
      estimatedValueUSD: null,
      rawText: `${projectLabel}. ${title}. UC Davis Health outpatient clinic and hospital facilities construction. Contact: hs-contracts@ucdavis.edu. Sacramento, California.`,
    });
  });

  log.info(`UC Davis Health returned ${rows.length} bid link(s)`);
  return rows;
}

/**
 * California healthcare construction opportunities. Combines:
 * - UC Davis Health bid board (static HTML)
 * - Healthcare-filtered Cal eProcure events (Playwright)
 *
 * The old DGS "Find-a-Bid" URL now 404s.
 */
export async function fetch(): Promise<SourceOutcome> {
  const rows: RawRfp[] = [];
  const notes: string[] = [];

  try {
    rows.push(...(await fetchUcDavisHealthBids()));
    notes.push(`UC Davis ${rows.length}`);
  } catch (err) {
    log.error("UC Davis Health fetch failed", err);
    notes.push(
      `UC Davis failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  try {
    log.info("filtering Cal eProcure events for healthcare (live)");
    const events = await fetchCaleProcureEvents();
    const healthcare = events.filter((e) =>
      isHealthcare(`${e.title} ${e.department}`)
    );
    for (const e of healthcare) {
      rows.push({
        source: "ca_hhs",
        url: `https://caleprocure.ca.gov/pages/Events-BS3/event-details.aspx?EventId=${encodeURIComponent(e.eventId)}`,
        title: e.title,
        description: e.department || null,
        ownerCompany: e.department || null,
        location: "California",
        postedDate: new Date().toISOString(),
        estimatedValueUSD: null,
        rawText: `${e.title}. Event ID ${e.eventId}. California healthcare-related state procurement.`,
      });
    }
    notes.push(`Cal eProcure healthcare ${healthcare.length}`);
  } catch (err) {
    log.error("Cal eProcure healthcare filter failed", err);
    notes.push(
      `Cal eProcure failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (rows.length) {
    log.info(`ca_hhs live sources returned ${rows.length} healthcare row(s)`);
    return {
      rows,
      live: true,
      note: `live · ${notes.join(" · ")}`,
    };
  }

  return {
    rows: [],
    live: false,
    note: notes.length ? notes.join(" · ") : "no healthcare rows from live sources",
  };
}
