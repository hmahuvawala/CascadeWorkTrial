import { createLogger } from "../../lib/logger";
import type { RawRfp, SourceOutcome } from "../../lib/types";
import { isoDaysAgo, timedFetch } from "./util";

const log = createLogger("src:sam.gov");
const SAM_API =
  "https://api.sam.gov/opportunities/v2/search";

/** MM/dd/yyyy, as the SAM.gov API expects for postedFrom/postedTo. */
function samDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

type SamOpp = {
  title?: string;
  fullParentPathName?: string;
  organizationName?: string;
  postedDate?: string;
  uiLink?: string;
  description?: string;
  placeOfPerformance?: {
    city?: { name?: string };
    state?: { name?: string; code?: string };
  };
  pointOfContact?: { fullName?: string; title?: string; email?: string }[];
};

/**
 * SAM.gov Opportunities API (free, JSON). Requires SAM_API_KEY from sam.gov →
 * Account Details → Public API Key. Without a key the API returns HTTP 404.
 */
export async function fetch(): Promise<SourceOutcome> {
  const key = process.env.SAM_API_KEY;
  if (!key) {
    log.warn("no SAM_API_KEY — SAM.gov requires a free public API key");
    return {
      rows: [],
      live: false,
      note: "no SAM_API_KEY set (register free at sam.gov → Account → Public API Key)",
    };
  }

  try {
    log.info("calling SAM.gov Opportunities API (live)");
    const params = new URLSearchParams({
      api_key: key,
      postedFrom: samDate(isoDaysAgo(7)),
      postedTo: samDate(isoDaysAgo(0)),
      limit: "100",
      offset: "0",
      active: "Yes",
      ptype: "o,k,p,r",
    });
    const res = await timedFetch(`${SAM_API}?${params.toString()}`, {
      timeoutMs: 12_000,
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      throw new Error(`SAM ${res.status}${body ? `: ${body}` : ""}`);
    }
    const json = (await res.json()) as { opportunitiesData?: SamOpp[] };
    const opps = json.opportunitiesData ?? [];
    const rows: RawRfp[] = opps
      .filter((o) => o.uiLink && o.title && o.postedDate)
      .map((o) => {
        const city = o.placeOfPerformance?.city?.name;
        const state = o.placeOfPerformance?.state?.name;
        const location = [city, state].filter(Boolean).join(", ") || null;
        const contacts = (o.pointOfContact ?? [])
          .map((c) => [c.fullName, c.title].filter(Boolean).join(", "))
          .filter(Boolean)
          .join("; ");
        return {
          source: "sam.gov",
          url: o.uiLink!,
          title: o.title!,
          description: o.fullParentPathName ?? null,
          ownerCompany: o.organizationName ?? o.fullParentPathName ?? null,
          location,
          postedDate: new Date(o.postedDate!).toISOString(),
          estimatedValueUSD: null,
          rawText: `${o.title}. ${o.fullParentPathName ?? ""}. Location: ${
            location ?? "unknown"
          }. Contacts: ${contacts || "see solicitation"}.`,
        };
      });
    if (rows.length) {
      log.info(`live SAM.gov returned ${rows.length} opportunity(ies)`);
      return { rows, live: true, note: `live API · ${rows.length} opportunities` };
    }
    log.warn("SAM.gov returned 0 rows in the fresh window");
    return {
      rows: [],
      live: true,
      note: "live API returned 0 opportunities in the last 7 days",
    };
  } catch (err) {
    log.error("SAM.gov fetch failed", err);
    return {
      rows: [],
      live: false,
      note: `live fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
