import { NextResponse } from "next/server";
import { extractContacts } from "@/lib/extract";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api/extract-contacts");

export async function POST(req: Request) {
  const { rawText } = (await req.json()) as { rawText?: string };
  log.info("POST extract-contacts", { chars: rawText?.length ?? 0 });
  if (!rawText) {
    log.warn("missing rawText → 400");
    return NextResponse.json({ error: "rawText required" }, { status: 400 });
  }
  const contacts = await extractContacts(rawText);
  log.info(`extract-contacts response sent: ${contacts.length} contact(s)`);
  return NextResponse.json(contacts);
}
