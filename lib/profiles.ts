export const profiles = [
  {
    id: "p_qsr",
    name: "Summit QSR Builders",
    specialty:
      "General contractor specializing in quick-service restaurant ground-up builds",
    verticals: ["restaurant", "qsr", "fast food", "drive-thru"],
    regions: [
      "southeast",
      "florida",
      "georgia",
      "tennessee",
      "alabama",
      "north carolina",
      "south carolina",
    ],
    projectSizeUSD: { min: 800_000, max: 5_000_000 },
    keywords: [
      "restaurant build-out",
      "ground-up restaurant",
      "qsr",
      "franchise build",
      "tenant improvement",
    ],
  },
  {
    id: "p_health",
    name: "Meridian Healthcare Construction",
    specialty:
      "Healthcare-focused GC: outpatient clinics, ambulatory surgery, MOBs",
    verticals: [
      "healthcare",
      "clinic",
      "hospital",
      "medical office",
      "ambulatory",
      "outpatient",
    ],
    regions: ["california", "nevada", "arizona", "oregon", "washington"],
    projectSizeUSD: { min: 3_000_000, max: 40_000_000 },
    keywords: [
      "medical office building",
      "MOB",
      "outpatient clinic",
      "ambulatory surgery",
      "hospital renovation",
      "healthcare fit-out",
    ],
  },
  {
    id: "p_multi",
    name: "Cornerstone Multifamily",
    specialty: "Mid-rise multifamily and mixed-use developer/GC",
    verticals: ["multifamily", "apartment", "mixed-use", "residential"],
    regions: ["texas", "colorado", "utah", "arizona"],
    projectSizeUSD: { min: 8_000_000, max: 80_000_000 },
    keywords: [
      "multifamily",
      "mid-rise",
      "mixed-use",
      "apartment complex",
      "podium construction",
    ],
  },
] as const;

export type Profile = (typeof profiles)[number];

export function getProfile(id: string): Profile | undefined {
  return profiles.find((p) => p.id === id);
}
