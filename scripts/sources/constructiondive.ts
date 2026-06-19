import { createLogger } from "../../lib/logger";
import { inferLocationFromText } from "../../lib/location";
import type { RawRfp, SourceOutcome } from "../../lib/types";
import { timedFetch } from "./util";
import { parseRss, rssPubDateToIso } from "./rss";

const log = createLogger("src:constructiondive");

const RSS_URL = "https://www.constructiondive.com/feeds/news/";

/** Project / development signals — skip pure policy or HR-only headlines. */
const PROJECT_SIGNALS = [
  "construction",
  "build",
  "ground",
  "renovation",
  "project",
  "developer",
  "contractor",
  "data center",
  "hospital",
  "clinic",
  "multifamily",
  "mixed-use",
  "apartment",
  "restaurant",
  "qsr",
  "drive-thru",
  "drive thru",
  "franchise",
  "infrastructure",
  "tower",
  "facility",
  "campus",
  "awarded",
  "breaks ground",
  "wins",
  "picked",
  "jv",
];

function isProjectNews(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  return PROJECT_SIGNALS.some((s) => text.includes(s));
}

/**
 * Construction Dive news RSS — the old /topic/projects/ URL 404s; the RSS feed
 * is the supported, server-rendered source of fresh project announcements.
 */
export async function fetch(): Promise<SourceOutcome> {
  try {
    log.info("fetching Construction Dive RSS (live)");
    const res = await timedFetch(RSS_URL, { timeoutMs: 12_000 });
    if (!res.ok) throw new Error(`constructiondive RSS ${res.status}`);
    const xml = await res.text();
    const items = parseRss(xml).filter((item) =>
      isProjectNews(item.title, item.description)
    );

    const rows: RawRfp[] = items.slice(0, 25).map((item) => {
      const description = item.description.slice(0, 280) || null;
      const location =
        inferLocationFromText(item.title, item.description) ?? null;
      return {
        source: "constructiondive",
        url: item.link,
        title: item.title,
        description,
        ownerCompany: null,
        location,
        postedDate: rssPubDateToIso(item.pubDate),
        estimatedValueUSD: null,
        rawText: `${item.title}. ${item.description}${
          item.author ? ` By ${item.author}.` : ""
        }${location ? ` Location signal: ${location}.` : ""}`,
      };
    });

    if (rows.length) {
      log.info(`live Construction Dive RSS returned ${rows.length} article(s)`);
      return {
        rows,
        live: true,
        note: `live RSS · ${rows.length} project articles`,
      };
    }
    log.warn("Construction Dive RSS returned 0 project articles");
    return {
      rows: [],
      live: false,
      note: "live RSS parsed 0 project-matching articles",
    };
  } catch (err) {
    log.error("Construction Dive fetch failed", err);
    return {
      rows: [],
      live: false,
      note: `live fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
