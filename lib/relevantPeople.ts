/**
 * "Could be relevant to this project" finder (open-web).
 *
 * Strategy: use Google (via Serper) to discover public pages about the owner
 * organization's people, then read those pages and extract owner-side names.
 * No LinkedIn — we read first-party sites, agency directories, press, and news.
 *
 * Tiered for cost/latency:
 *   Tier 1 — extract from search-result snippets (cheap, no fetch).
 *   Tier 2 — if snippets are sparse, fetch the top pages (Cheerio) and extract.
 *
 * Relevance ranking is NOT done here — the enrichment layer scores every contact
 * with `scoreContact`. This module's job is recall + owner-side precision.
 */
import * as cheerio from "cheerio";
import { extractOrgPeople } from "./extract";
import { createLogger } from "./logger";
import { webSearch, type WebResult } from "./webSearch";
import type { Profile } from "./profiles";
import type { ExtractedContact, Rfp } from "./types";

const log = createLogger("relevant");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const MAX_CANDIDATES = 8;
const TIER2_THRESHOLD = 6; // fetch full pages unless snippets already yielded plenty
const MAX_RESULTS = 12;

export type RelevantContact = ExtractedContact & {
  sourceUrl: string;
  sourceTitle: string;
  relevanceNote: string;
};

/** Generic words in org names that don't help confirm a person's affiliation. */
const GENERIC_ORG_WORDS = new Set([
  "health",
  "county",
  "city",
  "state",
  "department",
  "district",
  "university",
  "system",
  "authority",
  "agency",
  "office",
  "services",
  "of",
  "the",
  "and",
]);

function normalizeOwnerOrg(rfp: Rfp): string | null {
  const owner = rfp.owner_company?.trim();
  if (owner && owner.length > 2) return owner;
  const fromTitle = rfp.title.split("—")[0]?.trim();
  return fromTitle && fromTitle.length > 3 ? fromTitle : null;
}

function buildQueries(org: string): string[] {
  const roles =
    '("director of construction" OR "capital projects" OR "facilities" OR ' +
    '"real estate" OR "development" OR "public works" OR procurement)';
  return [
    `"${org}" ${roles}`,
    `"${org}" (staff directory OR leadership OR "capital improvement program")`,
  ];
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Web";
  }
}

function distinctiveOrgTokens(org: string): string[] {
  return org
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !GENERIC_ORG_WORDS.has(w));
}

/**
 * A contact is "affiliated" if their stated company matches the org, or the page
 * they were found on clearly references the org (distinctive token present).
 */
function affiliated(
  company: string | null | undefined,
  contextText: string,
  org: string
): boolean {
  const co = (company ?? "").toLowerCase();
  const orgLower = org.toLowerCase();
  if (co && (co.includes(orgLower) || orgLower.includes(co))) return true;

  const distinctive = distinctiveOrgTokens(org);
  if (distinctive.length === 0) return true; // org name too generic to gate on
  const ctx = contextText.toLowerCase();
  return distinctive.some((t) => ctx.includes(t));
}

async function fetchPageText(url: string, timeoutMs = 10_000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
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

function toContact(c: ExtractedContact, result: WebResult): RelevantContact {
  return {
    name: c.name,
    title: c.title ?? null,
    company: c.company ?? null,
    relevanceNote: c.relevanceNote ?? `Referenced in "${result.title}".`,
    sourceUrl: result.url,
    sourceTitle: hostnameOf(result.url),
  };
}

/** Contractor/AEC vendors are the user's competitors, not owner-side targets. */
const CONTRACTOR_HINTS = [
  "construction co",
  "constructors",
  "builders",
  "contracting",
  "general contractor",
  "design-build",
  "architect",
  "engineering",
  "consultant",
];

function looksLikeContractor(text: string): boolean {
  const t = text.toLowerCase();
  return CONTRACTOR_HINTS.some((h) => t.includes(h));
}

/** Departments unrelated to building/awarding construction work. */
const NON_BUILD_TITLE_HINTS = [
  "information technology",
  "information officer",
  "marketing",
  "communications",
  "human resources",
  "nursing",
  "clinical",
  "physician",
  "pharmacy",
  "counsel",
  "compliance",
  "philanthropy",
  "advancement",
];

function isNonBuildRole(title: string | null | undefined): boolean {
  const t = (title ?? "").toLowerCase();
  return NON_BUILD_TITLE_HINTS.some((h) => t.includes(h));
}

/**
 * The LLM extractor already scopes people to the owner org in build-relevant
 * roles, so here we only (a) drop obvious contractor-side companies and (b)
 * confirm affiliation with the org. Relevance ranking is left to scoreContact.
 */
function keep(contact: RelevantContact, org: string, contextText: string): boolean {
  if (looksLikeContractor(`${contact.title ?? ""} ${contact.company ?? ""}`)) {
    return false;
  }
  if (isNonBuildRole(contact.title)) return false;
  return affiliated(contact.company, `${contextText} ${contact.company ?? ""}`, org);
}

function dedupe(list: RelevantContact[]): RelevantContact[] {
  const seen = new Set<string>();
  const out: RelevantContact[] = [];
  for (const c of list) {
    const k = `${c.name.toLowerCase()}|${(c.company ?? "").toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

/** Extract owner-side contacts from one block of text, tagged to its source. */
async function extractKept(
  text: string,
  result: WebResult,
  org: string
): Promise<RelevantContact[]> {
  if (text.trim().length < 30) return [];
  const contacts = await extractOrgPeople(text, org);
  return contacts
    .map((c) => toContact(c, result))
    .filter((c) => keep(c, org, text));
}

export async function findRelevantPeople(
  rfp: Rfp,
  profile: Profile
): Promise<RelevantContact[]> {
  const org = normalizeOwnerOrg(rfp);
  if (!org) {
    log.warn("relevant: owner org unavailable — skipping");
    return [];
  }
  log.info(`relevant: open-web search for people at "${org}"`, {
    profile: profile.id,
  });

  // --- Discovery ---
  const queries = buildQueries(org);
  const nested = await Promise.all(queries.map((q) => webSearch(q)));
  const seen = new Set<string>();
  const candidates: WebResult[] = [];
  for (const r of nested.flat()) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    candidates.push(r);
  }
  const top = candidates.slice(0, MAX_CANDIDATES);
  log.info(`relevant: ${top.length} candidate page(s)`, {
    urls: top.map((t) => t.url),
  });
  if (!top.length) return [];

  // --- Tier 1: snippets (cheap, no fetch) ---
  const tier1 = (
    await Promise.all(top.map((c) => extractKept(c.snippet, c, org)))
  ).flat();
  let kept = tier1;
  log.info(`relevant: tier-1 (snippets) kept ${kept.length}`);

  // --- Tier 2: fetch the candidate pages when snippets were sparse ---
  // Snippets rarely contain full names, so we fetch all candidates (org
  // directories, bios, news) rather than just the first few.
  if (kept.length < TIER2_THRESHOLD) {
    const pages = await Promise.all(
      top.map(async (c) => ({ c, text: await fetchPageText(c.url) }))
    );
    const tier2 = (
      await Promise.all(pages.map(({ c, text }) => extractKept(text, c, org)))
    ).flat();
    kept = [...kept, ...tier2];
    log.info(`relevant: tier-2 (pages) added ${tier2.length}`);
  }

  const out = dedupe(kept).slice(0, MAX_RESULTS);
  log.info(`relevant: ${out.length} relevant person(s) for "${org}"`, {
    names: out.map((c) => c.name),
  });
  return out;
}
