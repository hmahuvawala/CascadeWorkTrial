/**
 * Shared domain types. The DB row shapes mirror the SQLite schema in lib/db.ts
 * (snake_case columns) so query results can be used without remapping.
 */

/** A row in the `rfps` table. */
export type Rfp = {
  id: string;
  source: string;
  url: string;
  view_url: string | null;
  title: string;
  description: string | null;
  owner_company: string | null;
  location: string | null;
  posted_date: string; // ISO
  estimated_value_usd: number | null;
  raw_text: string;
  fetched_at: string; // ISO
};

/** A row in the `contacts` table. */
export type Contact = {
  id: string;
  rfp_id: string;
  name: string;
  title: string | null;
  company: string | null;
  source: "this_rfp" | "relevant";
  source_url: string | null;
  source_title: string | null;
  relevance_note: string | null;
  role_tier: "decision_maker" | "influencer" | "peripheral" | null;
  found_at: string; // ISO
};

/**
 * What a crawler source returns before it is normalized + persisted.
 * `postedDate` must be ISO; rows older than 3 days are dropped on ingest.
 */
export type RawRfp = {
  source: string;
  url: string;
  title: string;
  description?: string | null;
  ownerCompany?: string | null;
  location?: string | null;
  postedDate: string; // ISO
  estimatedValueUSD?: number | null;
  rawText: string;
};

/** Lightweight contact shape used by extraction + filtering before persistence. */
export type ExtractedContact = {
  name: string;
  title?: string | null;
  company?: string | null;
  relevanceNote?: string | null;
};

/**
 * What a source returns: the rows plus whether they came from a real live fetch
 * or a curated-seed fallback (and a short human note explaining which/why).
 */
export type SourceOutcome = {
  rows: RawRfp[];
  live: boolean;
  note: string;
};
