import type { RoleTier } from "./influence";
import type { Profile } from "./profiles";
import type { Rfp } from "./types";

export type ContactSource = "this_rfp" | "relevant";

export type ContactScoreInput = {
  source: ContactSource;
  roleTier: RoleTier | null;
  company: string | null;
  title: string | null;
  otherRfpCount: number;
  rfp: Rfp;
  profile: Profile;
};

export type ContactScore = {
  relevanceScore: number; // 0-100
  relevanceReasons: string[];
};

function hasVerticalSignal(input: ContactScoreInput): boolean {
  const text = `${input.title ?? ""} ${input.company ?? ""} ${input.rfp.title} ${
    input.rfp.description ?? ""
  }`.toLowerCase();
  return input.profile.verticals.some((v) => text.includes(v));
}

function hasRegionSignal(input: ContactScoreInput): boolean {
  const loc = `${input.rfp.location ?? ""} ${input.company ?? ""}`.toLowerCase();
  return input.profile.regions.some((r) => loc.includes(r));
}

function ownerMatch(input: ContactScoreInput): boolean {
  const owner = (input.rfp.owner_company ?? "").toLowerCase();
  const company = (input.company ?? "").toLowerCase();
  return !!owner && !!company && (company.includes(owner) || owner.includes(company));
}

export function scoreContact(input: ContactScoreInput): ContactScore {
  let score = 0;
  const reasons: string[] = [];

  // Authority (0-35)
  if (input.roleTier === "decision_maker") {
    score += 35;
    reasons.push("decision-maker title");
  } else if (input.roleTier === "influencer") {
    score += 22;
    reasons.push("influencer title");
  } else {
    score += 10;
    reasons.push("lower-authority title");
  }

  // Source confidence (0-25)
  if (input.source === "this_rfp") {
    score += 25;
    reasons.push("named on this RFP");
  } else {
    score += 18;
    reasons.push("linked to the owner organization");
  }

  // Owner-org alignment (0-15)
  if (ownerMatch(input)) {
    score += 15;
    reasons.push("matches owner organization");
  } else if (input.company) {
    score += 6;
    reasons.push("known organization");
  }

  // Fit (0-18)
  if (hasVerticalSignal(input)) {
    score += 10;
    reasons.push("vertical-aligned");
  }
  if (hasRegionSignal(input)) {
    score += 8;
    reasons.push("region-aligned");
  }

  // Cross-signal bonus (0-7): named across multiple current RFPs.
  if (input.otherRfpCount > 0) {
    score += Math.min(7, input.otherRfpCount * 3);
    reasons.push(
      input.otherRfpCount === 1
        ? "active on another current RFP"
        : `active on ${input.otherRfpCount} other current RFPs`
    );
  }

  return {
    relevanceScore: Math.max(0, Math.min(100, Math.round(score))),
    relevanceReasons: reasons.slice(0, 3),
  };
}

