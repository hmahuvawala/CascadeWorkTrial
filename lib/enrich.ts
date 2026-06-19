/**
 * Enrichment orchestrator for one RFP. Two categories of contacts:
 * - onThisProject: people named on the RFP listing itself.
 * - relevant: people who could be relevant to the project, discovered via
 *   open-web search of the owner organization. Relevance is determined by
 *   `scoreContact`, which ranks each contact 0-100.
 */
import {
  deleteContactsForRfp,
  getContactsForRfp,
  getRfpById,
  insertContact,
  otherCurrentRfpCount,
  updateRfpViewUrl,
} from "./db";
import {
  extractContacts,
  isLikelyJobTitle,
  isLikelyPersonName,
  isRegexFallbackArtifact,
} from "./extract";
import { hydrateListing } from "./listingHydrate";
import { effectiveSolicitationUrl } from "./solicitationUrl";
import { roleTier } from "./influence";
import { createLogger } from "./logger";
import { findRelevantPeople } from "./relevantPeople";
import { getProfile } from "./profiles";
import type { Contact, Rfp } from "./types";
import { scoreContact } from "./contactScoring";
import type { Profile } from "./profiles";

const log = createLogger("enrich");

export type ContactView = {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  relevanceNote: string | null;
  roleTier: Contact["role_tier"];
  sourceUrl: string | null;
  sourceTitle: string | null;
  otherRfpCount: number;
  relevanceScore: number;
  relevanceReasons: string[];
};

export type EnrichResult = {
  rfpId: string;
  viewUrl: string;
  onThisProject: ContactView[]; // named on the RFP
  relevant: ContactView[]; // could be relevant (open-web), ranked by score
  cached: boolean;
};

function contactCacheValid(c: Contact): boolean {
  return (
    isLikelyPersonName(c.name) &&
    isLikelyJobTitle(c.title) &&
    !isRegexFallbackArtifact(c)
  );
}

function hostnameOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function toView(c: Contact, rfp: Rfp, profile: Profile): ContactView {
  const otherCount = otherCurrentRfpCount(c.name, c.rfp_id);
  const scored = scoreContact({
    source: c.source,
    roleTier: c.role_tier,
    company: c.company,
    title: c.title,
    otherRfpCount: otherCount,
    rfp,
    profile,
  });
  return {
    id: c.id,
    name: c.name,
    title: c.title,
    company: c.company,
    relevanceNote: c.relevance_note,
    roleTier: c.role_tier,
    sourceUrl: c.source_url,
    sourceTitle: c.source_title?.trim() || hostnameOf(c.source_url),
    otherRfpCount: otherCount,
    relevanceScore: scored.relevanceScore,
    relevanceReasons: scored.relevanceReasons,
  };
}

function sortByRelevance(contacts: ContactView[]): ContactView[] {
  return contacts.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    return a.name.localeCompare(b.name);
  });
}

function buildResult(
  rfpId: string,
  rfp: Rfp,
  profile: Profile,
  cached: boolean
): EnrichResult {
  const contacts = getContactsForRfp(rfpId);
  return {
    rfpId,
    viewUrl: effectiveSolicitationUrl(rfp),
    onThisProject: sortByRelevance(
      contacts
        .filter((c) => c.source === "this_rfp")
        .map((c) => toView(c, rfp, profile))
    ),
    relevant: sortByRelevance(
      contacts
        .filter((c) => c.source === "relevant")
        .map((c) => toView(c, rfp, profile))
    ),
    cached,
  };
}

export async function enrichRfp(
  rfpId: string,
  profileId: string,
  force = false
): Promise<EnrichResult | null> {
  const startedAt = Date.now();
  let rfp = getRfpById(rfpId);
  if (!rfp) {
    log.warn(`enrichRfp: unknown rfpId ${rfpId}`);
    return null;
  }
  const profile = getProfile(profileId);
  if (!profile) {
    log.warn(`enrichRfp: unknown profileId ${profileId}`);
    return null;
  }
  log.info(`enrichRfp START "${rfp.title.slice(0, 50)}"`, {
    rfpId,
    profile: profile.name,
    force,
  });

  const existing = getContactsForRfp(rfpId);
  if (existing.length > 0) {
    const cacheValid = existing.every(contactCacheValid);
    if (!force && cacheValid) {
      log.info("enrichRfp: contacts already cached — returning cached result");
      return buildResult(rfpId, rfp, profile, true);
    }
    log.info("enrichRfp: purging contacts before re-enrichment");
    deleteContactsForRfp(rfpId);
  }

  // --- Category 1: contacts named on this RFP ---
  log.info("Category 1: extracting contacts named on this RFP");
  const hydrated = await hydrateListing(rfp);
  if (hydrated.viewUrl && hydrated.viewUrl !== rfp.view_url) {
    updateRfpViewUrl(rfpId, hydrated.viewUrl);
    rfp = { ...rfp, view_url: hydrated.viewUrl };
  }
  const stageA = await extractContacts(hydrated.text);
  for (const c of stageA) {
    insertContact({
      rfpId,
      name: c.name,
      title: c.title ?? null,
      company: c.company ?? rfp.owner_company ?? null,
      source: "this_rfp",
      sourceUrl: effectiveSolicitationUrl(rfp),
      sourceTitle: "RFP listing",
      relevanceNote: c.relevanceNote ?? null,
      roleTier: roleTier(c.title),
    });
  }
  log.info(`Category 1: stored ${stageA.length} contact(s) named on the RFP`);

  // --- Category 2: people who could be relevant (open-web discovery) ---
  log.info("Category 2: finding people relevant to the owner organization");
  const relevant = await findRelevantPeople(rfp, profile);
  for (const c of relevant) {
    insertContact({
      rfpId,
      name: c.name,
      title: c.title ?? null,
      company: c.company ?? rfp.owner_company ?? null,
      source: "relevant",
      sourceUrl: c.sourceUrl,
      sourceTitle: c.sourceTitle,
      relevanceNote: c.relevanceNote ?? null,
      roleTier: roleTier(c.title),
    });
  }
  log.info(`Category 2: stored ${relevant.length} relevant contact(s)`);

  const result = buildResult(rfpId, rfp, profile, false);
  log.info(`enrichRfp DONE (${Date.now() - startedAt}ms)`, {
    onThisProject: result.onThisProject.length,
    relevant: result.relevant.length,
  });
  return result;
}
