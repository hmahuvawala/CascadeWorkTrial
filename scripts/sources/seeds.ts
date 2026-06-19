import type { RawRfp } from "../../lib/types";

/**
 * Curated fallback seeds, used only when a live source can't be reached.
 *
 * These are illustrative, public-solicitation-style records modeled on the
 * format of real bid boards and project-announcement feeds (owner org, location,
 * budget band, and a procurement/owner contact line). They keep the demo fully
 * functional offline. `postedDate` is stamped dynamically at crawl time
 * (see freshenSeeds) so rows stay within the freshness window. No live data is
 * ever fabricated — when a source responds, its real rows are used instead.
 */
export type Seed = Omit<RawRfp, "postedDate">;

export const samSeeds: Seed[] = [
  {
    source: "sam.gov",
    url: "https://sam.gov/opp/seed-va-outpatient-clinic-fresno",
    title:
      "Design-Build Services — VA Outpatient Clinic Fit-Out, Fresno CA (NAICS 236220)",
    description:
      "Ground-up plus interior fit-out of a 42,000 SF VA outpatient clinic and ambulatory care annex.",
    ownerCompany: "U.S. Department of Veterans Affairs",
    location: "Fresno, California",
    estimatedValueUSD: 18_500_000,
    rawText:
      "The U.S. Department of Veterans Affairs seeks design-build services for a new 42,000 SF outpatient clinic and ambulatory surgery annex in Fresno, California. Scope includes ground-up healthcare construction, MOB-style fit-out, and medical office building infrastructure. Estimated value $18.5M. Primary point of contact: Karen Whitfield, Contracting Officer, VA Capital Projects Division. Technical questions to David Marsh, Director of Construction, VISN 21 Facilities. Pre-proposal conference required. NAICS 236220.",
  },
  {
    source: "sam.gov",
    url: "https://sam.gov/opp/seed-army-dining-facility-fort-benning",
    title:
      "Ground-Up Quick-Service Dining Facility — Fort Benning GA (NAICS 236220)",
    description:
      "Construction of a new ground-up quick-service restaurant / drive-thru dining facility on base.",
    ownerCompany: "U.S. Army Corps of Engineers — Savannah District",
    location: "Columbus, Georgia",
    estimatedValueUSD: 3_200_000,
    rawText:
      "The U.S. Army Corps of Engineers, Savannah District, requests proposals for a ground-up restaurant build and drive-thru quick-service facility (QSR) at Fort Benning, Georgia. Scope includes franchise build standards, tenant improvement, and food-service fit-out. Estimated $3.2M. Contracting POC: Marcus Bell, Contract Specialist. Owner's representative: Angela Torres, Director of Facilities, Fort Benning Garrison. Southeast region.",
  },
];

export const caleprocureSeeds: Seed[] = [
  {
    source: "caleprocure",
    url: "https://caleprocure.ca.gov/event/seed-ambulatory-surgery-sacramento",
    title: "Ambulatory Surgery Center Renovation & Fit-Out — Sacramento, CA",
    description:
      "Renovation and healthcare fit-out of an existing ambulatory surgery center and outpatient clinic.",
    ownerCompany: "Sutter Valley Medical Center",
    location: "Sacramento, California",
    estimatedValueUSD: 9_400_000,
    rawText:
      "Sutter Valley Medical Center invites bids for the renovation and healthcare fit-out of its ambulatory surgery center and adjacent outpatient clinic in Sacramento, California. Project includes hospital renovation, MOB upgrades, and OSHPD-compliant medical office building work. Budget approx. $9.4M. Owner contact: Priya Nair, Director of Real Estate & Capital Projects, Sutter Health System. Facilities lead: Tom Eklund, VP of Development.",
  },
  {
    source: "caleprocure",
    url: "https://caleprocure.ca.gov/event/seed-mixed-use-podium-san-jose",
    title: "Mid-Rise Mixed-Use Podium Development — San Jose, CA",
    description:
      "Construction of a 180-unit mid-rise multifamily and mixed-use podium development.",
    ownerCompany: "Bayfront Development Corporation",
    location: "San Jose, California",
    estimatedValueUSD: 46_000_000,
    rawText:
      "Bayfront Development Corporation seeks a general contractor for a 180-unit mid-rise multifamily and mixed-use podium construction project in San Jose. Apartment complex with ground-floor retail. Estimated $46M. Developer contact: Rachel Kim, VP of Development, Bayfront Development Corporation. Construction lead: Daniel Ortiz, Director of Construction.",
  },
];

export const caHhsSeeds: Seed[] = [
  {
    source: "ca_hhs",
    url: "https://www.dgs.ca.gov/bid/seed-medical-office-building-irvine",
    title: "New Medical Office Building (MOB) — Irvine, CA",
    description:
      "Ground-up medical office building and outpatient clinic for a regional health system.",
    ownerCompany: "Coastline Health System",
    location: "Irvine, California",
    estimatedValueUSD: 27_500_000,
    rawText:
      "Coastline Health System announces an RFP for a new ground-up medical office building (MOB) and outpatient clinic in Irvine, California. Healthcare fit-out, ambulatory care, and clinic infrastructure. Estimated $27.5M. Owner's representative: Steven Cho, Director of Construction, Coastline Health System. Capital projects contact: Maria Delgado, VP of Real Estate.",
  },
  {
    source: "ca_hhs",
    url: "https://www.dgs.ca.gov/bid/seed-behavioral-health-clinic-phoenix",
    title: "Outpatient Behavioral Health Clinic Build-Out — Phoenix, AZ",
    description:
      "Tenant improvement and healthcare fit-out for an outpatient behavioral health clinic.",
    ownerCompany: "Desert Valley Health Authority",
    location: "Phoenix, Arizona",
    estimatedValueUSD: 6_100_000,
    rawText:
      "Desert Valley Health Authority requests proposals for the tenant improvement and outpatient clinic fit-out of a behavioral health facility in Phoenix, Arizona. Healthcare and ambulatory scope. Budget $6.1M. Contact: Lauren Hayes, Director of Facilities, Desert Valley Health Authority.",
  },
];

export const constructionDiveSeeds: Seed[] = [
  {
    source: "constructiondive",
    url: "https://www.constructiondive.com/news/seed-cornerstone-midrise-austin",
    title:
      "Developer breaks ground on 240-unit mid-rise apartment complex in Austin",
    description:
      "A 240-unit mid-rise multifamily project with podium construction is moving forward in East Austin.",
    ownerCompany: "Lone Star Residential Partners",
    location: "Austin, Texas",
    estimatedValueUSD: 58_000_000,
    rawText:
      "Lone Star Residential Partners has begun construction on a 240-unit mid-rise multifamily and mixed-use apartment complex in East Austin, Texas. The podium construction project is valued at roughly $58 million. 'This fills a real gap in attainable mid-rise housing,' said Jordan Reyes, VP of Development at Lone Star Residential Partners. The developer's Director of Construction, Emily Sanchez, is overseeing delivery. Mixed-use ground floor retail included.",
  },
  {
    source: "constructiondive",
    url: "https://www.constructiondive.com/news/seed-qsr-drivethru-nashville",
    title: "Restaurant operator plans 12 new drive-thru QSR locations across Tennessee",
    description:
      "A franchisee announces a multi-site ground-up quick-service restaurant build program.",
    ownerCompany: "Southland Restaurant Group (franchisee)",
    location: "Nashville, Tennessee",
    estimatedValueUSD: 2_400_000,
    rawText:
      "Southland Restaurant Group, a regional franchisee and operator, will build 12 new ground-up drive-thru quick-service restaurant (QSR) locations across Tennessee, including Nashville and Knoxville. Each franchise build is a fast-food restaurant build-out averaging $2.4M. 'We're standardizing our ground-up restaurant prototype,' said Brett Holloway, Director of Real Estate at Southland Restaurant Group. Construction manager: Nicole Pratt, Director of Construction. Southeast expansion.",
  },
  {
    source: "constructiondive",
    url: "https://www.constructiondive.com/news/seed-cornerstone-midrise-fortworth",
    title:
      "Same developer plans second mid-rise multifamily tower in Fort Worth",
    description:
      "Lone Star Residential Partners adds a 200-unit mid-rise multifamily tower in Fort Worth.",
    ownerCompany: "Lone Star Residential Partners",
    location: "Fort Worth, Texas",
    estimatedValueUSD: 49_000_000,
    rawText:
      "Lone Star Residential Partners is planning a second 200-unit mid-rise multifamily and apartment complex in Fort Worth, Texas, valued near $49M. The developer's VP of Development, Jordan Reyes, said the firm is replicating its Austin podium construction prototype. Delivery is again being led by Emily Sanchez, Director of Construction at Lone Star Residential Partners.",
  },
  {
    source: "constructiondive",
    url: "https://www.constructiondive.com/news/seed-mixeduse-denver-rino",
    title: "Mixed-use podium project advances in Denver's RiNo district",
    description:
      "A mid-rise mixed-use multifamily development with structured parking advances in Denver.",
    ownerCompany: "Front Range Urban Holdings",
    location: "Denver, Colorado",
    estimatedValueUSD: 71_000_000,
    rawText:
      "Front Range Urban Holdings is advancing a mid-rise mixed-use multifamily development in Denver's RiNo district, Colorado. The apartment complex features podium construction over structured parking, valued near $71M. Developer's owner representative: Alex Whitman, VP of Development, Front Range Urban Holdings. Real estate lead: Sandra Petrov, Director of Real Estate.",
  },
  {
    source: "constructiondive",
    url: "https://www.constructiondive.com/news/seed-qsr-orlando-groundup",
    title: "National chain to build ground-up restaurants across Florida",
    description:
      "A quick-service restaurant chain announces ground-up build program in Florida and Georgia.",
    ownerCompany: "Sunshine QSR Holdings (operator)",
    location: "Orlando, Florida",
    estimatedValueUSD: 1_650_000,
    rawText:
      "Sunshine QSR Holdings, an operator and franchisee, plans a ground-up restaurant build program across Florida and Georgia, starting in Orlando. Each drive-thru QSR / fast food restaurant build-out and tenant improvement runs about $1.65M. 'Florida is our priority growth market,' said Megan Foltz, Director of Development at Sunshine QSR Holdings. Southeast.",
  },
];

export const allSeedsBySource: Record<string, Seed[]> = {
  "sam.gov": samSeeds,
  caleprocure: caleprocureSeeds,
  ca_hhs: caHhsSeeds,
  constructiondive: constructionDiveSeeds,
};
