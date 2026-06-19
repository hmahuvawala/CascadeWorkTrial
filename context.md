# Cascade — AEC Opportunity Scanner

## Current Goals
- Daily opportunity scanner for AEC firms (Build Plan v2+). Demo flow:
  pick firm profile → ranked feed of fresh RFPs → "Find contacts" → three
  contact sections (on this project / awarded similar / at this owner org) →
  scored contacts with relevance reasons → View on LinkedIn.
- Status: **Owner-organization relevance enhancement complete and verified**
  (`tsc` + `eslint` clean, UC Davis scenario validated).

## Architectural Decisions
- Next.js 16 (App Router) + TS + Tailwind v4. Single project, `npm run dev`.
- SQLite via `better-sqlite3` at `data/cache.sqlite` (WAL). Crawler writes,
  app reads. `serverExternalPackages: ["better-sqlite3"]` in next.config.
- Crawler: `scripts/crawl.ts` (also `npm run crawl`) runs 4 isolated sources
  (`scripts/sources/*`) and records per-source live vs fallback status in
  `crawl_runs` for UI visibility. Date filter ≤3 days + dedup by URL handled
  in `lib/db.ts`.
- Scoring (`lib/scoring.ts`): vertical × region × size × recency, multiplied.
  Sub-scores are the explainability payload (chips on each card).
- LLM (Anthropic `claude-sonnet-4-6`) for RFP-field + contact extraction,
  server-only, each with rule-based fallbacks (`lib/extract.ts`).
- LinkedIn discovery (`lib/linkedin.ts`): Serper `site:linkedin.com/in`,
  fallback = LinkedIn people-search URL (never dead-ends). We never scrape LI.
- Stage B (`lib/historical.ts`): Serper news → fetch+cheerio → extract →
  owner-side filter (`lib/sideFilter.ts`) with relevance/domain guardrails.
  Fallback reuses cached peer-RFP contacts. Cross-reference query in `lib/db.ts`
  powers the "Historically active in this category" badge.
- Stage C (`lib/ownerOrg.ts`): owner-organization role-owner discovery via
  `site:linkedin.com/in` Serper queries (construction/facilities/capital
  projects/real-estate/procurement roles), filtered through person/title + owner-side checks.
- Contact relevance scoring (`lib/contactScoring.ts`): deterministic 0-100
  score + reasons based on authority, source confidence (A/C/B), owner-org
  match, region/vertical fit, and cross-signal bonuses.
- API routes: `/api/crawl`, `/api/rank`, `/api/enrich`, `/api/extract-rfp`,
  `/api/extract-contacts` (all `runtime=nodejs`, `dynamic=force-dynamic`).

## Setup Notes
- The custom Next fork pins `@next/font@16.2.9` (unpublished), so a full
  `npm install` re-resolution fails. New deps were installed in an isolated
  temp dir and merged into `node_modules`; recorded manually in package.json.
  Use `--legacy-peer-deps` / isolated install if adding more deps.
- Optional env (in `.env.local`): `ANTHROPIC_API_KEY`, `SERPER_API_KEY`,
  `SAM_API_KEY` (all used in live paths; app has graceful fallback behavior).

## Recent Changes
- Replaced v1 partner-matcher (deleted old components/lib/draft route).
- Built full v2 scanner: lib (profiles, types, db, scoring, influence,
  sideFilter, prompts, llm, extract, linkedin, historical, enrich, format),
  4 crawler sources + seeds, 5 API routes, UI (ProfileCard, RfpCard,
  ScoreChips, ContactRow, page).
- Seeds include an intentional honest overlap (Lone Star Residential Partners
  exec on two current multifamily RFPs) so the cross-reference badge fires
  offline. Verified: enrich on Austin RFP → Jordan Reyes + Emily Sanchez
  flagged "Historically active".
- Added owner-organization contact relevance feature:
  - new Stage C section in enrichment + UI (`atOwnerOrganization`)
  - new owner-org discovery module (`lib/ownerOrg.ts`)
  - new lightweight contact scoring with reasons (`lib/contactScoring.ts`)
  - API/UI payload now includes `relevanceScore` + `relevanceReasons`
  - expanded card renders three sections with scored contacts.

## To run the demo
1. `npm run crawl` (populate cache; re-run to refresh)
2. `npm run dev` → http://localhost:3000
