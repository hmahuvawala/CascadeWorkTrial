/** Map profile region tokens to place names / abbreviations found in RFP text. */
const REGION_HINTS: Record<string, string[]> = {
  california: ["california", ", ca", " ca ", "sacramento", "los angeles", "san francisco", "san jose", "irvine"],
  nevada: ["nevada", ", nv", " las vegas", "reno"],
  arizona: ["arizona", ", az", "phoenix", "tucson", "scottsdale"],
  oregon: ["oregon", ", or", "portland"],
  washington: ["washington", ", wa", "seattle", "tacoma"],
  texas: ["texas", ", tx", "austin", "dallas", "houston", "fort worth", "san antonio"],
  colorado: ["colorado", ", co", "denver", "colorado springs"],
  utah: ["utah", ", ut", "salt lake"],
  florida: ["florida", ", fl", "miami", "orlando", "tampa", "jacksonville"],
  georgia: ["georgia", ", ga", "atlanta"],
  tennessee: ["tennessee", ", tn", "nashville", "knoxville"],
  alabama: ["alabama", ", al", "birmingham"],
  "north carolina": ["north carolina", ", nc", "charlotte", "raleigh"],
  "south carolina": ["south carolina", ", sc", "charleston"],
  southeast: [
    "southeast",
    "florida",
    "georgia",
    "tennessee",
    "alabama",
    "north carolina",
    "south carolina",
    "louisiana",
    "mississippi",
    "arkansas",
  ],
};

/** Best-effort location string from title + body when crawlers leave `location` null. */
export function inferLocationFromText(...parts: (string | null | undefined)[]): string | null {
  const text = parts.filter(Boolean).join(" ").toLowerCase();
  for (const [region, hints] of Object.entries(REGION_HINTS)) {
    if (hints.some((h) => text.includes(h))) {
      // Return a human label (capitalize first hint that's a state name).
      const state = hints.find((h) => h.length > 3 && !h.startsWith(",") && !h.startsWith(" "));
      return state ? state.replace(/^,\s*/, "").replace(/^\s/, "") : region;
    }
  }
  return null;
}

/** Whether an RFP's text matches any of a profile's region tokens. */
export function textMatchesProfileRegion(
  text: string,
  profileRegions: readonly string[]
): boolean {
  const haystack = text.toLowerCase();
  return profileRegions.some((region) => {
    const hints = REGION_HINTS[region] ?? [region];
    return hints.some((h) => haystack.includes(h));
  });
}
