import { NextResponse } from "next/server";
import { getCrawlMeta, getCrawlRuns } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { runCrawl } from "@/scripts/crawl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api/crawl");

// Live "run the crawler now" button. Re-runs every source and returns per-source counts.
export async function POST() {
  log.info("POST crawl — refresh requested");
  const { results, total } = await runCrawl();
  const meta = { ...getCrawlMeta(), sources: getCrawlRuns() };
  const liveCount = results.filter((r) => r.mode === "live").length;
  log.info(
    `crawl response: ${liveCount}/${results.length} sources live, ${total} inserted, ${meta.count} total cached`,
    { perSource: results }
  );
  return NextResponse.json({ results, total, meta });
}
