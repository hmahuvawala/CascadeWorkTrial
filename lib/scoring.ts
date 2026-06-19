/**
 * RFP-vs-profile matching. Same influence × relevance × reachability backbone
 * as v1, adapted to project-vs-profile matching: vertical × region × size ×
 * recency, each 0–1, multiplied. Multiply (not add) — an RFP must fit on every
 * dimension. The four sub-scores double as the explainability payload shown on
 * each card.
 */
import { textMatchesProfileRegion } from "./location";
import type { Profile } from "./profiles";
import type { Rfp } from "./types";

export type ScoreBreakdown = {
  total: number;
  vertical: number;
  region: number;
  size: number;
  recency: number;
};

export type ScoredRfp = Rfp & ScoreBreakdown;

function rfpText(rfp: Rfp): string {
  return `${rfp.title} ${rfp.description ?? ""} ${rfp.owner_company ?? ""} ${rfp.raw_text}`.toLowerCase();
}

/** Substrings that imply a profile vertical when the exact token is absent. */
const VERTICAL_ALIASES: Record<string, string[]> = {
  restaurant: ["dining", "dining venue", "food service", "cafeteria", "kitchen"],
  qsr: ["drive-thru", "drive thru", "quick-service", "quick service", "fast food"],
  "fast food": ["drive-thru", "drive thru", "qsr"],
  multifamily: ["apartment", "housing", "residential", "units", "mid-rise", "midrise"],
  apartment: ["multifamily", "housing", "residential"],
  residential: ["multifamily", "apartment", "housing"],
  healthcare: ["health", "healthcare", "health care", "medical", "clinical"],
  clinic: ["clinical", "outpatient", "ambulatory"],
  hospital: ["medical center", "health system"],
  "medical office": ["mob", "medical office building"],
  ambulatory: ["outpatient", "clinic"],
  outpatient: ["ambulatory", "clinic"],
};

function verticalHits(text: string, verticals: readonly string[]): number {
  let hits = 0;
  for (const v of verticals) {
    if (text.includes(v)) {
      hits++;
      continue;
    }
    if ((VERTICAL_ALIASES[v] ?? []).some((alias) => text.includes(alias))) hits++;
  }
  return hits;
}

function verticalScore(rfp: Rfp, p: Profile): number {
  const text = rfpText(rfp);
  const vHits = verticalHits(text, p.verticals);
  const keywordHits = p.keywords.filter((k) => text.includes(k.toLowerCase())).length;
  const hitCount = vHits + keywordHits;
  if (hitCount >= 4) return 1.0;
  if (hitCount === 3) return 0.88;
  if (hitCount === 2) return 0.74;
  if (hitCount === 1) return 0.52;
  return 0.08;
}

function regionScore(rfp: Rfp, p: Profile): number {
  const haystack = `${rfp.location ?? ""} ${rfpText(rfp)}`;
  if (textMatchesProfileRegion(haystack, p.regions)) return 1.0;
  if (!rfp.location && !haystack.trim()) return 0.45;
  // National / multi-state news without a conflicting state still gets partial credit.
  if (!rfp.location) return 0.35;
  return 0.12;
}

/** Parse $ amounts embedded in titles/descriptions when `estimated_value_usd` is null. */
function valueFromText(rfp: Rfp): number | null {
  if (rfp.estimated_value_usd != null) return rfp.estimated_value_usd;
  const m = rfpText(rfp).match(/\$\s?([\d,.]+)\s*(million|mil|m|billion|b|k|thousand)?/i);
  if (!m) return null;
  const base = parseFloat(m[1].replace(/,/g, ""));
  const unit = (m[2] ?? "").toLowerCase();
  if (unit.startsWith("b")) return Math.round(base * 1_000_000_000);
  if (unit.startsWith("m")) return Math.round(base * 1_000_000);
  if (unit.startsWith("k") || unit.startsWith("thous")) return Math.round(base * 1000);
  return Math.round(base);
}

function sizeScore(rfp: Rfp, p: Profile): number {
  const v = valueFromText(rfp);
  if (v == null) return 0.55;
  if (v >= p.projectSizeUSD.min && v <= p.projectSizeUSD.max) return 1.0;
  const mid = (p.projectSizeUSD.min + p.projectSizeUSD.max) / 2;
  return Math.max(0.18, 1 - Math.abs(v - mid) / (mid * 2));
}

function recencyBoost(rfp: Rfp): number {
  const days = (Date.now() - new Date(rfp.posted_date).getTime()) / 86_400_000;
  if (days <= 1) return 1.0;
  if (days <= 2) return 0.88;
  if (days <= 3) return 0.75;
  return 0.6;
}

export function score(rfp: Rfp, p: Profile): ScoreBreakdown {
  const vertical = verticalScore(rfp, p);
  const region = regionScore(rfp, p);
  const size = sizeScore(rfp, p);
  const recency = recencyBoost(rfp);
  const total = +(vertical * region * size * recency).toFixed(3);
  return { total, vertical, region, size, recency };
}

export function rank(rfps: Rfp[], p: Profile): ScoredRfp[] {
  return rfps
    .map((r) => ({ ...r, ...score(r, p) }))
    .filter((r) => r.total > 0.08)
    .sort((a, b) => b.total - a.total);
}
