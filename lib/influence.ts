/**
 * Classify a contact's title into an influence tier. Used to badge contacts
 * as decision-makers vs. influencers in the UI. Mirrors the v1 influence
 * backbone, narrowed to AEC owner/developer roles.
 */
import type { Contact } from "./types";

const DECISION_MAKER = [
  "owner",
  "developer",
  "principal",
  "president",
  "ceo",
  "cfo",
  "coo",
  "founder",
  "vp",
  "vice president",
  "director of construction",
  "director of development",
  "director of real estate",
  "director of facilities",
  "capital projects",
  "public works",
];
const INFLUENCER = [
  "director",
  "manager",
  "procurement",
  "purchasing",
  "project executive",
  "project manager",
  "facilities",
  "real estate",
  "architect",
  "estimator",
  "design",
  "engineer",
];

export type RoleTier = NonNullable<Contact["role_tier"]>;

export function roleTier(title?: string | null): RoleTier {
  const t = (title ?? "").toLowerCase();
  if (DECISION_MAKER.some((k) => t.includes(k))) return "decision_maker";
  if (INFLUENCER.some((k) => t.includes(k))) return "influencer";
  return "peripheral";
}

export function roleTierLabel(tier: RoleTier | null): string {
  switch (tier) {
    case "decision_maker":
      return "Decision-maker";
    case "influencer":
      return "Influencer";
    default:
      return "Peripheral";
  }
}
