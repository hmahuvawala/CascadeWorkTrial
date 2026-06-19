import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCrawlMeta, getCrawlRuns, getFreshRfps } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { getProfile } from "@/lib/profiles";
import { rank } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api/rank");

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profile");
  log.info(`GET ranking`, { profile: profileId });
  const profile = profileId ? getProfile(profileId) : undefined;
  if (!profile) {
    log.warn(`unknown profile "${profileId}" → 400`);
    return NextResponse.json({ error: "unknown profile" }, { status: 400 });
  }
  const ranked = rank(getFreshRfps(), profile);
  const meta = { ...getCrawlMeta(), sources: getCrawlRuns() };
  log.info(`ranked ${ranked.length} RFP(s) for ${profile.name}`, {
    top: ranked.slice(0, 3).map((r) => ({ score: r.total, title: r.title.slice(0, 40) })),
  });
  return NextResponse.json({ ranked, meta });
}
