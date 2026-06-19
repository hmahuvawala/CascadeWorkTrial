/**
 * Source-agnostic listing hydration: expand thin crawl stubs into full text
 * and resolve a working "view solicitation" URL when the stored link is broken.
 */
import * as cheerio from "cheerio";
import {
  extractCaleProcureEventId,
  fetchCaleProcureEventDetail,
  isBrokenCaleProcureDetailUrl,
} from "./caleprocureDetail";
import { createLogger } from "./logger";
import type { Rfp } from "./types";

const log = createLogger("listingHydrate");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export type HydratedListing = {
  text: string;
  viewUrl: string | null;
};

function listingAlreadyRich(rawText: string): boolean {
  return (
    rawText.length > 450 ||
    /contacts\s*:/i.test(rawText) ||
    /\bContact [A-Z][a-z]+ [A-Z]/.test(rawText)
  );
}

async function fetchHtmlText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": USER_AGENT },
    });
    if (!res.ok) return "";
    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer, header, aside").remove();
    return ($("main").text() || $("body").text() || "")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function hydrateCaleProcure(rfp: Rfp): Promise<HydratedListing | null> {
  const eventId = extractCaleProcureEventId(rfp.url, rfp.raw_text);
  if (!eventId) return null;
  log.info(`hydrate Cal eProcure event ${eventId}`);
  const detail = await fetchCaleProcureEventDetail(eventId);
  if (detail.text.length < 200) {
    return detail.viewUrl ? { text: rfp.raw_text, viewUrl: detail.viewUrl } : null;
  }
  return {
    text: `${rfp.raw_text}\n\nCal eProcure event detail:\n${detail.text}`,
    viewUrl: detail.viewUrl,
  };
}

async function hydrateHtmlPage(rfp: Rfp): Promise<HydratedListing | null> {
  if (!/^https?:\/\//i.test(rfp.url) || /\.pdf(\?|$)/i.test(rfp.url)) return null;
  const pageText = await fetchHtmlText(rfp.url);
  if (pageText.length < 100) return null;
  return {
    text: `${rfp.raw_text}\n\n${pageText}`,
    viewUrl: rfp.url,
  };
}

/**
 * Expand thin listing text and resolve a working view URL. Tries source-specific
 * hydrators first, then a generic HTML fetch for any remaining thin listings.
 */
export async function hydrateListing(rfp: Rfp): Promise<HydratedListing> {
  if (rfp.view_url && listingAlreadyRich(rfp.raw_text)) {
    return { text: rfp.raw_text, viewUrl: rfp.view_url };
  }

  if (listingAlreadyRich(rfp.raw_text) && !isBrokenCaleProcureDetailUrl(rfp.url)) {
    return { text: rfp.raw_text, viewUrl: rfp.view_url ?? rfp.url };
  }

  if (/caleprocure\.ca\.gov/i.test(rfp.url) || rfp.source === "caleprocure") {
    const cal = await hydrateCaleProcure(rfp);
    if (cal) return cal;
  }

  if (!listingAlreadyRich(rfp.raw_text)) {
    const html = await hydrateHtmlPage(rfp);
    if (html) return html;
  }

  if (isBrokenCaleProcureDetailUrl(rfp.url)) {
    const cal = await hydrateCaleProcure(rfp);
    if (cal?.viewUrl) return { text: rfp.raw_text, viewUrl: cal.viewUrl };
  }

  return { text: rfp.raw_text, viewUrl: rfp.view_url ?? rfp.url };
}
