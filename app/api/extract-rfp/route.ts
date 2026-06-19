import { NextResponse } from "next/server";
import { extractRfp } from "@/lib/extract";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api/extract-rfp");

export async function POST(req: Request) {
  const { rawText } = (await req.json()) as { rawText?: string };
  log.info("POST extract-rfp", { chars: rawText?.length ?? 0 });
  if (!rawText) {
    log.warn("missing rawText → 400");
    return NextResponse.json({ error: "rawText required" }, { status: 400 });
  }
  const fields = await extractRfp(rawText);
  log.info("extract-rfp response sent", { title: fields.title });
  return NextResponse.json(fields);
}
