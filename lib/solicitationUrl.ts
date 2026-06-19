/**
 * Resolve a working "View solicitation" URL for any source.
 * Caches the result in rfps.view_url so repeat clicks are instant.
 */
import {
  CALEPROCURE_EVENT_SEARCH_URL,
  extractCaleProcureEventId,
  fetchCaleProcureEventDetail,
  isBrokenCaleProcureDetailUrl,
} from "./caleprocureDetail";
import { getRfpById, updateRfpViewUrl } from "./db";
import { createLogger } from "./logger";
import type { Rfp } from "./types";

const log = createLogger("solicitationUrl");

export function effectiveSolicitationUrl(rfp: Pick<Rfp, "url" | "view_url">): string {
  return rfp.view_url ?? rfp.url;
}

/** Resolve (and cache) a browser-openable solicitation URL. */
export async function resolveSolicitationUrl(rfpId: string): Promise<string | null> {
  const rfp = getRfpById(rfpId);
  if (!rfp) return null;
  if (rfp.view_url) return rfp.view_url;
  if (!isBrokenCaleProcureDetailUrl(rfp.url)) return rfp.url;

  const eventId = extractCaleProcureEventId(rfp.url, rfp.raw_text);
  if (!eventId) return rfp.url;

  log.info(`resolving Cal eProcure view URL for ${eventId}`);
  const { viewUrl } = await fetchCaleProcureEventDetail(eventId);
  if (viewUrl) {
    updateRfpViewUrl(rfpId, viewUrl);
    return viewUrl;
  }
  // Broken event-details.aspx — fall back to live search page (not a dead link).
  return CALEPROCURE_EVENT_SEARCH_URL;
}
