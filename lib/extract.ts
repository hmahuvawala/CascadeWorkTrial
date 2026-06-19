/**
 * Extraction with LLM-first, rule-based fallback. Used directly server-side by
 * the enrichment pipeline and exposed via /api/extract-rfp and /api/extract-contacts.
 */
import { callAnthropicJSON } from "./llm";
import { createLogger } from "./logger";
import {
  extractArticleContactsPrompt,
  extractContactsPrompt,
  extractOrgPeoplePrompt,
  extractRfpPrompt,
} from "./prompts";
import type { ExtractedContact } from "./types";

const log = createLogger("extract");

export type ExtractedRfp = {
  title: string | null;
  description: string | null;
  ownerCompany: string | null;
  location: string | null;
  estimatedValueUSD: number | null;
  postedDate: string | null;
};

/** Phrases the rule-based fallback mis-identifies as person names. */
const NON_PERSON_PHRASES = new Set([
  "information blocking",
  "final rule",
  "american federation",
  "general assembly",
  "louisiana senate",
  "louisiana bill",
  "quality care",
  "senate bill",
  "multifamily housing",
  "the national",
  "top owners",
  "top managers",
  "top builders",
  "top developers",
  "mobile generators",
  "davis health",
  "while california",
  "security rules",
  "security rule",
  "software for",
  "act on",
  "safe harbor",
  "civil rights",
  "act sponsors",
  "nurses association",
  "developers the",
  "owners based",
  "managers based",
  "top syndicators",
  "see all",
  "housing council",
  "health program",
  "consulting pool",
  "master plan",
  "study no",
  "retaining wall",
  "disposal services",
  "incidental repair",
  "medical waste",
  "waste pick",
  "not allowed",
  "multiple bids",
  "submitted bids",
  "my bids",
]);

/** First tokens that start headlines or RFP titles, not person names. */
const NON_PERSON_FIRST = new Set([
  "the",
  "a",
  "an",
  "while",
  "top",
  "see",
  "all",
  "act",
  "based",
  "new",
  "home",
  "biggest",
  "national",
  "multifamily",
  "health",
  "master",
  "study",
  "retaining",
  "disposal",
  "incidental",
  "consulting",
  "medical",
  "specification",
  "chiller",
  "bio",
  "pharmaceutical",
  "west",
  "valley",
  "temporary",
  "supportive",
  "knights",
  "landing",
  "request",
  "event",
  "bid",
  "not",
  "multiple",
  "submitted",
  "my",
]);

/** Second tokens common in RFP titles, not surnames. */
const NON_PERSON_SECOND = new Set([
  "program",
  "pool",
  "plan",
  "services",
  "repair",
  "wall",
  "waste",
  "maintenance",
  "rehabilitation",
  "disposal",
  "consulting",
  "center",
  "system",
  "study",
  "specification",
  "equipment",
  "management",
  "support",
  "renewal",
  "extension",
  "housing",
  "generators",
  "blocking",
  "rule",
  "harbor",
  "rights",
  "care",
  "based",
  "syndicators",
  "no",
  "pick",
  "up",
  "allowed",
  "bids",
]);

const NON_PERSON_TOKENS = new Set([
  "information",
  "blocking",
  "final",
  "rule",
  "federation",
  "assembly",
  "senate",
  "bill",
  "mobile",
  "generators",
  "multifamily",
  "housing",
  "national",
  "quality",
  "care",
  "security",
  "rules",
  "software",
  "while",
  "california",
  "top",
  "owners",
  "managers",
  "builders",
  "developers",
  "syndicators",
  "based",
  "act",
  "safe",
  "harbor",
  "civil",
  "rights",
  "american",
  "general",
  "louisiana",
  "senator",
  "sponsors",
  "nurses",
  "association",
  "council",
  "syndicator",
]);

/** Scraped page copy mis-identified as a job title. */
const JOB_TITLE_REJECT = [
  "authoritative",
  "rankings",
  "top 50",
  "top owners",
  "top managers",
  "top builders",
  "top developers",
  "see all",
  "housing council",
  "based on",
  "homebuyers",
  "purchasing an existing",
  "nation's top",
  "biggest developers",
];

/** Reject legal/policy phrases and other non-person strings masquerading as names. */
export function isLikelyPersonName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 4 || trimmed.length > 48) return false;
  const lower = trimmed.toLowerCase();
  if (NON_PERSON_PHRASES.has(lower)) return false;

  const parts = trimmed.split(/\s+/);
  if (parts.length < 2 || parts.length > 4) return false;
  if (NON_PERSON_FIRST.has(parts[0].toLowerCase())) return false;
  if (parts.length === 2 && NON_PERSON_SECOND.has(parts[1].toLowerCase())) return false;
  if (parts.some((p) => NON_PERSON_TOKENS.has(p.toLowerCase()))) return false;

  return parts.every((p) => isNameToken(p));
}

const NAME_TOKEN =
  /^([A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]{1,24}(-[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]{1,24})?|[A-Z]\.?)$/u;

function isNameToken(part: string): boolean {
  return NAME_TOKEN.test(part);
}

const RANK_PREFIX =
  /^(?:(?:Mr|Mrs|Ms|Dr|SSgt|Sgt|Capt|Lt|Col|Maj|CPT|LT|LCDR|CDR)\.?\s+)+/i;

function stripRankPrefix(name: string): string {
  return name.replace(RANK_PREFIX, "").trim();
}

/** Parse SAM.gov `Contacts:` lines and explicit POC phrasing in solicitation text. */
export function extractStructuredContacts(rawText: string): ExtractedContact[] {
  const out: ExtractedContact[] = [];

  const contactsMatch =
    rawText.match(/Contacts:\s*(.+?)\.\s*$/i) ??
    rawText.match(/Contacts:\s*(.+)$/i);
  if (contactsMatch) {
    for (const piece of contactsMatch[1].split(/;/)) {
      const parsed = parseContactSegment(piece);
      if (parsed) out.push(parsed);
    }
  }

  const pocPatterns = [
    /(?:primary\s+)?point of contact:\s*([^,\n.]+?)(?:,\s*([^.\n]+))?/gi,
    /(?:technical questions to|owner'?s? representative:|facilities lead:|developer contact:|construction lead:|capital projects contact:)\s*([^,\n.]+?)(?:,\s*([^.\n]+))?/gi,
  ];
  for (const re of pocPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawText)) !== null) {
      const parsed = parseContactSegment(
        m[2] ? `${m[1].trim()}, ${m[2].trim()}` : m[1].trim()
      );
      if (parsed) out.push(parsed);
    }
  }

  // Cal eProcure PeopleSoft detail: "Contact Molly Porter Phone ... Email:"
  const calMatches = rawText.matchAll(
    /\bContact\s+([A-Z][a-z]+(?: [A-Z]\.)? [A-Z][a-z'-]+)/g
  );
  for (const m of calMatches) {
    const name = m[1].trim();
    if (!isLikelyPersonName(name)) continue;
    out.push({ name, title: "Procurement Contact", company: null });
  }

  return dedupe(filterPersonContacts(out));
}

function parseContactSegment(piece: string): ExtractedContact | null {
  const segment = piece.trim().replace(/\s+/g, " ");
  if (segment.length < 4) return null;
  if (/phone|email|@|\d{3}[-\s)]\d{3}/i.test(segment)) return null;

  // Last, First[, Title]
  const inverted = segment.match(
    /^([A-Z][A-Za-z'-]+),\s*([A-Z][A-Za-z'.-]+?)(?:,\s*(.+))?$/
  );
  if (inverted && !inverted[1].includes(" ")) {
    const name = stripRankPrefix(`${inverted[2].trim()} ${inverted[1].trim()}`);
    if (!isLikelyPersonName(name)) return null;
    return {
      name,
      title: inverted[3]?.trim() || null,
      company: null,
    };
  }

  // Name, Title
  const withTitle = segment.match(/^(.+?),\s*(Contracting Officer|Contract Specialist|Buyer|Purchasing Agent|Director[^,]*|VP[^,]*|Vice President[^,]*|Manager[^,]*|.+)$/i);
  if (withTitle) {
    const name = stripRankPrefix(withTitle[1].trim());
    if (!isLikelyPersonName(name)) return null;
    return { name, title: withTitle[2].trim(), company: null };
  }

  const nameOnly = stripRankPrefix(segment);
  if (!isLikelyPersonName(nameOnly)) return null;
  return { name: nameOnly, title: null, company: null };
}

/** Reject long narrative scrapes stored as titles. */
export function isLikelyJobTitle(title: string | null | undefined): boolean {
  if (!title?.trim()) return true;
  const t = title.trim();
  if (t.length > 80) return false;
  const lower = t.toLowerCase();
  if (lower === "procurement" || lower === "purchasing") return false;
  if (JOB_TITLE_REJECT.some((p) => lower.includes(p))) return false;
  if (t.split(/\s+/).length > 10) return false;
  return true;
}

/** Rule-based extractor sets bare "procurement" with no company when it mis-parsed an RFP title. */
export function isRegexFallbackArtifact(
  c: Pick<ExtractedContact, "title" | "company">
): boolean {
  const t = (c.title ?? "").toLowerCase().trim();
  return (t === "procurement" || t === "purchasing") && !c.company?.trim();
}

/** PeopleSoft bid UI copy — has "Contact" labels but rarely a named POC. */
function looksLikeCalEprocureDetail(rawText: string): boolean {
  return (
    /Cal eProcure event detail:/i.test(rawText) ||
    /multiple bids not allowed/i.test(rawText) ||
    /edits to submitted bids/i.test(rawText) ||
    /AUC_RESP_INQ_DTL/i.test(rawText)
  );
}

/** Bid-board listings rarely embed names; regex fallback turns title phrases into fake contacts. */
function looksLikeRfpListing(rawText: string): boolean {
  const lower = rawText.toLowerCase();
  const listingSignals = [
    "event id",
    "rfp ",
    "request for information",
    "request for proposal",
    "solicitation",
    "specification no",
    "bid number",
    "state procurement",
    "sb only",
    "cal eprocure",
  ];
  const hasPersonSignal =
    /contacts\s*:/i.test(rawText) ||
    /\b(contact|poc|point of contact)\b/i.test(rawText) ||
    /@[a-z0-9.-]+\.[a-z]{2,}/i.test(rawText) ||
    /\(\d{3}\)\s*\d{3}[-\s]?\d{4}/.test(rawText);
  return listingSignals.some((s) => lower.includes(s)) && !hasPersonSignal;
}

function filterPersonContacts(contacts: ExtractedContact[]): ExtractedContact[] {
  return contacts.filter((c) => {
    if (!isLikelyPersonName(c.name)) {
      log.info(`dropped non-person name "${c.name}"`);
      return false;
    }
    if (!isLikelyJobTitle(c.title)) {
      log.info(`dropped invalid job title for "${c.name}"`, { title: c.title });
      return false;
    }
    if (isRegexFallbackArtifact(c)) {
      log.info(`dropped regex fallback artifact "${c.name}"`, { title: c.title });
      return false;
    }
    return true;
  });
}

// ---------- RFP field extraction ----------

export async function extractRfp(rawText: string): Promise<ExtractedRfp> {
  log.info("extractRfp: parsing RFP fields", { chars: rawText.length });
  const llm = await callAnthropicJSON<Partial<ExtractedRfp>>(
    extractRfpPrompt(rawText)
  );
  if (llm && (llm.title || llm.ownerCompany)) {
    log.info("extractRfp: used LLM result");
    return {
      title: llm.title ?? null,
      description: llm.description ?? null,
      ownerCompany: llm.ownerCompany ?? null,
      location: llm.location ?? null,
      estimatedValueUSD:
        typeof llm.estimatedValueUSD === "number"
          ? llm.estimatedValueUSD
          : null,
      postedDate: llm.postedDate ?? null,
    };
  }
  log.info("extractRfp: using rule-based fallback");
  return extractRfpFallback(rawText);
}

export function extractRfpFallback(rawText: string): ExtractedRfp {
  const dateMatch = rawText.match(
    /(?:Posted|Date|Issued)\s*:?\s*([A-Za-z0-9,\/\-\s]{6,20})/i
  );
  const valueMatch = rawText.match(/\$\s?([\d,.]+)\s*(million|m|k|thousand)?/i);
  let estimatedValueUSD: number | null = null;
  if (valueMatch) {
    const base = parseFloat(valueMatch[1].replace(/,/g, ""));
    const unit = (valueMatch[2] ?? "").toLowerCase();
    estimatedValueUSD = unit.startsWith("m")
      ? Math.round(base * 1_000_000)
      : unit.startsWith("k") || unit.startsWith("thous")
        ? Math.round(base * 1000)
        : Math.round(base);
  }
  const titleMatch =
    rawText.match(/<h1[^>]*>([^<]+)<\/h1>/i) ??
    rawText.match(/<title[^>]*>([^<]+)<\/title>/i);
  const firstSentence = rawText.split(/[.\n]/)[0]?.trim() ?? "";
  return {
    title: titleMatch ? titleMatch[1].trim() : firstSentence.slice(0, 140),
    description: firstSentence.slice(0, 240) || null,
    ownerCompany: null,
    location: null,
    estimatedValueUSD,
    postedDate: dateMatch ? dateMatch[1].trim() : null,
  };
}

// ---------- Contact extraction ----------

export async function extractContacts(
  rawText: string
): Promise<ExtractedContact[]> {
  log.info("extractContacts: extracting named contacts", { chars: rawText.length });

  const structured = extractStructuredContacts(rawText);
  if (structured.length) {
    log.info(`extractContacts: structured POC parse found ${structured.length} contact(s)`, {
      names: structured.map((c) => c.name),
    });
    return structured;
  }

  const llm = await callAnthropicJSON<ExtractedContact[]>(
    extractContactsPrompt(rawText)
  );
  if (Array.isArray(llm)) {
    const cleaned = filterPersonContacts(
      llm
        .filter((c) => c && typeof c.name === "string" && c.name.trim().length > 3)
        .map((c) => ({
          name: c.name.trim(),
          title: c.title?.trim() || null,
          company: c.company?.trim() || null,
        }))
    );
    if (cleaned.length) {
      const result = dedupe(cleaned);
      log.info(`extractContacts: LLM found ${result.length} contact(s)`, {
        names: result.map((c) => c.name),
      });
      return result;
    }
  }
  if (looksLikeRfpListing(rawText) || looksLikeCalEprocureDetail(rawText)) {
    log.info(
      "extractContacts: skipping rule fallback — listing/detail page without named POC"
    );
    return [];
  }
  const fallback = dedupe(filterPersonContacts(extractContactsFallback(rawText)));
  log.info(`extractContacts: rule-based fallback found ${fallback.length} contact(s)`, {
    names: fallback.map((c) => c.name),
  });
  return fallback;
}

/** Stage B article extraction — LLM only; rule-based fallback mis-parses list pages. */
export async function extractContactsFromArticle(
  rawText: string
): Promise<ExtractedContact[]> {
  log.info("extractContactsFromArticle: LLM-only extraction", {
    chars: rawText.length,
  });
  const llm = await callAnthropicJSON<
    (ExtractedContact & { relevanceNote?: string | null })[]
  >(extractArticleContactsPrompt(rawText));
  if (!Array.isArray(llm)) {
    log.info("extractContactsFromArticle: LLM returned no array");
    return [];
  }
  const cleaned = filterPersonContacts(
    llm
      .filter((c) => c && typeof c.name === "string" && c.name.trim().length > 3)
      .map((c) => ({
        name: c.name.trim(),
        title: c.title?.trim() || null,
        company: c.company?.trim() || null,
        relevanceNote: c.relevanceNote?.trim() || null,
      }))
  );
  const result = dedupe(cleaned);
  log.info(`extractContactsFromArticle: ${result.length} contact(s)`, {
    names: result.map((c) => c.name),
  });
  return result;
}

/**
 * Open-web "people at this organization" extraction — LLM only. Tuned for
 * directory/profile/news/snippet text (not just project-announcement articles),
 * scoped to a specific owner organization.
 */
export async function extractOrgPeople(
  rawText: string,
  org: string
): Promise<ExtractedContact[]> {
  log.info("extractOrgPeople: LLM-only extraction", {
    chars: rawText.length,
    org,
  });
  const llm = await callAnthropicJSON<
    (ExtractedContact & { relevanceNote?: string | null })[]
  >(extractOrgPeoplePrompt(rawText, org));
  if (!Array.isArray(llm)) {
    log.info("extractOrgPeople: LLM returned no array");
    return [];
  }
  const cleaned = filterPersonContacts(
    llm
      .filter((c) => c && typeof c.name === "string" && c.name.trim().length > 3)
      .map((c) => ({
        name: c.name.trim(),
        title: c.title?.trim() || null,
        company: c.company?.trim() || null,
        relevanceNote: c.relevanceNote?.trim() || null,
      }))
  );
  const result = dedupe(cleaned);
  log.info(`extractOrgPeople: ${result.length} contact(s)`, {
    names: result.map((c) => c.name),
  });
  return result;
}

const TITLE_KEYWORDS = [
  "director of construction",
  "director of development",
  "director of real estate",
  "director of facilities",
  "vp of development",
  "vice president",
  "vp",
  "director",
  "manager",
  "president",
  "officer",
  "specialist",
  "representative",
  "owner",
  "developer",
  "facilities",
  "procurement",
  "purchasing",
  "principal",
];

/**
 * Rule-based contact extraction. Finds "First Last" name tokens and reads a
 * short window after each to recover a title and (optionally) a company via
 * "at X" / ", X". Handles the common bid-board and project-announcement phrasings.
 */
export function extractContactsFallback(rawText: string): ExtractedContact[] {
  const text = rawText.replace(/\s+/g, " ");
  const out: ExtractedContact[] = [];
  const nameRe = /\b([A-Z][a-z]+(?:\s[A-Z]\.)?\s[A-Z][a-z]+)\b/g;
  let m: RegExpExecArray | null;
  while ((m = nameRe.exec(text)) !== null) {
    const name = m[1];
    if (!isLikelyPersonName(name)) continue;

    const after = text.slice(m.index + name.length, m.index + name.length + 90);
    const window = after.toLowerCase();
    const titleKw = TITLE_KEYWORDS.find((k) => window.includes(k));
    if (!titleKw) continue;

    const titleSeg =
      after.match(/^[,\s-]*([^.,;]*\b(?:director|vp|vice president|manager|president|officer|specialist|representative|owner|developer|facilities|procurement|purchasing|principal)[^.,;]*)/i)?.[1] ??
      titleKw;
    const companySeg =
      after.match(/\bat\s+([A-Z][A-Za-z0-9&'.\- ]{2,60})/)?.[1] ??
      after.match(/,\s*([A-Z][A-Za-z0-9&'.\- ]{2,60}(?:System|Authority|Group|Holdings|Partners|Corporation|Division|Garrison|Center|District|Affairs))/)?.[1] ??
      null;

    out.push({
      name,
      title: titleSeg?.trim() || titleKw,
      company: companySeg?.trim() || null,
    });
  }
  return out;
}

function dedupe(contacts: ExtractedContact[]): ExtractedContact[] {
  const seen = new Set<string>();
  const out: ExtractedContact[] = [];
  for (const c of contacts) {
    const key = `${c.name.toLowerCase()}|${(c.company ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}
