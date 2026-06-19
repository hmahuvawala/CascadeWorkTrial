import { deleteSeedRfps, recordCrawlRun, upsertRfp } from "../lib/db";
import { createLogger } from "../lib/logger";
import type { SourceOutcome } from "../lib/types";
import { clearCaleProcureSessionCache } from "./sources/caleprocureLive";
import * as sam from "./sources/sam";
import * as caleprocure from "./sources/caleprocure";
import * as caHhs from "./sources/ca_hhs";
import * as constructiondive from "./sources/constructiondive";

type Source = { name: string; fetch: () => Promise<SourceOutcome> };

const SOURCES: Source[] = [
  { name: "sam.gov", fetch: sam.fetch },
  { name: "caleprocure", fetch: caleprocure.fetch },
  { name: "ca_hhs", fetch: caHhs.fetch },
  { name: "constructiondive", fetch: constructiondive.fetch },
];

export type SourceResult = {
  source: string;
  /** "live" = real fetch succeeded; "seeds" = failed / no live data (legacy key). */
  mode: "live" | "seeds";
  note: string;
  fetched: number;
  inserted: number;
  error?: string;
};

/**
 * Run every source in isolation (a broken source can't take down the others),
 * persist fresh, deduped rows, and report per-source counts.
 */
const log = createLogger("crawl");

export async function runCrawl(): Promise<{
  results: SourceResult[];
  total: number;
}> {
  log.info(`starting crawl across ${SOURCES.length} sources`);
  clearCaleProcureSessionCache();
  const results = await Promise.all(
    SOURCES.map(async (s): Promise<SourceResult> => {
      const start = Date.now();
      try {
        log.info(`[${s.name}] fetching…`);
        const outcome = await s.fetch();
        const mode: SourceResult["mode"] = outcome.live ? "live" : "seeds";
        let inserted = 0;
        for (const r of outcome.rows) if (upsertRfp(r)) inserted++;
        log.info(
          `[${s.name}] done [${mode.toUpperCase()}]: ${inserted} inserted / ${
            outcome.rows.length
          } fetched (${Date.now() - start}ms) — ${outcome.note}`
        );
        const result: SourceResult = {
          source: s.name,
          mode,
          note: outcome.note,
          fetched: outcome.rows.length,
          inserted,
        };
        recordCrawlRun(result);
        return result;
      } catch (err) {
        log.error(`[${s.name}] failed (${Date.now() - start}ms)`, err);
        const result: SourceResult = {
          source: s.name,
          mode: "seeds",
          note: `crawler error: ${err instanceof Error ? err.message : String(err)}`,
          fetched: 0,
          inserted: 0,
          error: err instanceof Error ? err.message : String(err),
        };
        recordCrawlRun(result);
        return result;
      }
    })
  );
  const total = results.reduce((n, r) => n + r.inserted, 0);
  const liveCount = results.filter((r) => r.mode === "live").length;
  if (liveCount > 0) deleteSeedRfps();
  log.info(`crawl complete: ${total} fresh RFP(s) inserted`);
  return { results, total };
}

// CLI entrypoint: `npm run crawl` / `npx tsx scripts/crawl.ts`
const isCli =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /crawl\.ts$/.test(process.argv[1]);

if (isCli) {
  runCrawl()
    .then(({ results, total }) => {
      console.log("\nCrawl complete:\n");
      for (const r of results) {
        const tag = r.mode === "live" ? "LIVE " : "FAILED";
        console.log(
          `  [${tag}] ${r.source.padEnd(18)} ${r.inserted} inserted (${r.fetched} fetched) — ${r.note}`
        );
      }
      const liveCount = results.filter((r) => r.mode === "live").length;
      console.log(
        `\n  ${liveCount}/${results.length} sources live · Total fresh RFPs inserted: ${total}\n`
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("Crawl failed:", err);
      process.exit(1);
    });
}
