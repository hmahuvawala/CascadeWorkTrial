import { NextResponse } from "next/server";
import { resolveSolicitationUrl } from "@/lib/solicitationUrl";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const log = createLogger("api/solicitation-url");

export async function GET(req: Request) {
  const rfpId = new URL(req.url).searchParams.get("rfpId");
  if (!rfpId) {
    return NextResponse.json({ error: "rfpId required" }, { status: 400 });
  }
  log.info("GET solicitation-url", { rfpId });
  const url = await resolveSolicitationUrl(rfpId);
  if (!url) {
    return NextResponse.json({ error: "unknown rfp" }, { status: 404 });
  }
  return NextResponse.json({ url });
}
