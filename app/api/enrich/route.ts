import { NextResponse } from "next/server";
import { enrichRfp } from "@/lib/enrich";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const log = createLogger("api/enrich");

export async function POST(req: Request) {
  const { rfpId, profileId, force } = (await req.json()) as {
    rfpId?: string;
    profileId?: string;
    force?: boolean;
  };
  log.info("POST enrich", { rfpId, profileId, force: force ?? false });
  if (!rfpId || !profileId) {
    log.warn("missing rfpId/profileId → 400");
    return NextResponse.json(
      { error: "rfpId and profileId required" },
      { status: 400 }
    );
  }
  const result = await enrichRfp(rfpId, profileId, force ?? false);
  if (!result) {
    log.warn("enrich returned null → 404");
    return NextResponse.json(
      { error: "unknown rfp or profile" },
      { status: 404 }
    );
  }
  log.info("enrich response sent", {
    onThisProject: result.onThisProject.length,
    relevant: result.relevant.length,
    cached: result.cached,
  });
  return NextResponse.json(result);
}
