import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createLogger } from "./logger";
import type { Contact, ExtractedContact, RawRfp, Rfp } from "./types";

const log = createLogger("db");

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "cache.sqlite");

/** Only RFPs posted within this window are considered "fresh". */
export const FRESH_WINDOW_DAYS = 3;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS rfps (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  owner_company TEXT,
  location TEXT,
  posted_date TEXT NOT NULL,
  estimated_value_usd INTEGER,
  raw_text TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  rfp_id TEXT NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  source TEXT NOT NULL,
  source_url TEXT,
  role_tier TEXT,
  found_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crawl_runs (
  source TEXT PRIMARY KEY,            -- latest run per source
  mode TEXT NOT NULL,                 -- 'live' | 'seeds'
  note TEXT NOT NULL,                 -- human explanation
  fetched INTEGER NOT NULL,
  inserted INTEGER NOT NULL,
  ran_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rfps_posted ON rfps(posted_date);
CREATE INDEX IF NOT EXISTS idx_contacts_rfp ON contacts(rfp_id);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name, company);
`;

let _db: Database.Database | null = null;

function migrateDb(db: Database.Database): void {
  const contactCols = db.prepare(`PRAGMA table_info(contacts)`).all() as { name: string }[];
  const contactNames = new Set(contactCols.map((c) => c.name));
  if (!contactNames.has("source_title")) {
    db.exec(`ALTER TABLE contacts ADD COLUMN source_title TEXT`);
  }
  if (!contactNames.has("relevance_note")) {
    db.exec(`ALTER TABLE contacts ADD COLUMN relevance_note TEXT`);
  }

  const rfpCols = db.prepare(`PRAGMA table_info(rfps)`).all() as { name: string }[];
  const rfpNames = new Set(rfpCols.map((c) => c.name));
  if (!rfpNames.has("view_url")) {
    db.exec(`ALTER TABLE rfps ADD COLUMN view_url TEXT`);
  }
}

/** Lazily open (and migrate) the SQLite cache. Reused across calls. */
export function getDb(): Database.Database {
  if (_db) return _db;
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL"); // lets the crawler write while the app reads
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  migrateDb(db);
  _db = db;
  log.info(`opened SQLite cache`, { path: DB_PATH });
  return db;
}

export function sha(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/**
 * Insert a freshly-crawled RFP. Returns false (skipped) when the row is older
 * than the fresh window. Dedups by URL — a repeat crawl refreshes the row.
 */
export function upsertRfp(raw: RawRfp): boolean {
  const posted = new Date(raw.postedDate);
  if (Number.isNaN(posted.getTime())) {
    log.warn(`upsertRfp: invalid postedDate, skipping`, { url: raw.url });
    return false;
  }
  if (posted.getTime() < Date.now() - FRESH_WINDOW_DAYS * 86_400_000) {
    log.info(`upsertRfp: stale (>${FRESH_WINDOW_DAYS}d), skipping`, {
      url: raw.url,
      postedDate: raw.postedDate,
    });
    return false;
  }

  const db = getDb();
  const id = sha(raw.url);
  db.prepare(
    `INSERT INTO rfps (id, source, url, title, description, owner_company,
        location, posted_date, estimated_value_usd, raw_text, fetched_at)
     VALUES (@id, @source, @url, @title, @description, @owner_company,
        @location, @posted_date, @estimated_value_usd, @raw_text, @fetched_at)
     ON CONFLICT(url) DO UPDATE SET
        title=excluded.title,
        description=excluded.description,
        owner_company=excluded.owner_company,
        location=excluded.location,
        posted_date=excluded.posted_date,
        estimated_value_usd=excluded.estimated_value_usd,
        raw_text=excluded.raw_text,
        fetched_at=excluded.fetched_at`
  ).run({
    id,
    source: raw.source,
    url: raw.url,
    title: raw.title,
    description: raw.description ?? null,
    owner_company: raw.ownerCompany ?? null,
    location: raw.location ?? null,
    posted_date: posted.toISOString(),
    estimated_value_usd: raw.estimatedValueUSD ?? null,
    raw_text: raw.rawText,
    fetched_at: new Date().toISOString(),
  });
  log.info(`upsertRfp: cached [${raw.source}] ${raw.title.slice(0, 60)}`);
  return true;
}

/** Remove curated demo rows once live crawlers are running. */
export function deleteSeedRfps(): number {
  const db = getDb();
  const result = db
    .prepare(`DELETE FROM rfps WHERE url LIKE '%/seed-%' OR url LIKE '%seed-%'`)
    .run();
  if (result.changes > 0) {
    log.info(`deleteSeedRfps: removed ${result.changes} demo seed row(s)`);
  }
  return result.changes;
}

/** All fresh RFPs (posted within the window), newest first. */
export function getFreshRfps(): Rfp[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM rfps WHERE posted_date >= ? ORDER BY posted_date DESC`
    )
    .all(isoDaysAgo(FRESH_WINDOW_DAYS)) as Rfp[];
  log.info(`getFreshRfps: ${rows.length} RFP(s) within ${FRESH_WINDOW_DAYS}d`);
  return rows;
}

export function getRfpById(id: string): Rfp | undefined {
  const db = getDb();
  return db.prepare(`SELECT * FROM rfps WHERE id = ?`).get(id) as
    | Rfp
    | undefined;
}

/** Cache a working browser URL when the crawled link is broken (e.g. Cal eProcure SPA). */
export function updateRfpViewUrl(rfpId: string, viewUrl: string): void {
  const db = getDb();
  db.prepare(`UPDATE rfps SET view_url = ? WHERE id = ?`).run(viewUrl, rfpId);
  log.info(`updateRfpViewUrl: cached view URL for ${rfpId}`);
}

export function getContactsForRfp(rfpId: string): Contact[] {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM contacts WHERE rfp_id = ? ORDER BY rowid ASC`)
    .all(rfpId) as Contact[];
}

/** Remove all contacts for an RFP (e.g. after bad enrichment cache detected). */
export function deleteContactsForRfp(rfpId: string): void {
  const db = getDb();
  const result = db.prepare(`DELETE FROM contacts WHERE rfp_id = ?`).run(rfpId);
  if (result.changes > 0) {
    log.info(`deleteContactsForRfp: removed ${result.changes} row(s)`, { rfpId });
  }
}

/** Insert a contact (idempotent on rfp_id + name + source). */
export function insertContact(
  c: ExtractedContact & {
    rfpId: string;
    source: Contact["source"];
    sourceUrl: string | null;
    sourceTitle?: string | null;
    relevanceNote?: string | null;
    roleTier: Contact["role_tier"];
  }
): void {
  const db = getDb();
  const id = sha(`${c.rfpId}|${c.name.toLowerCase()}|${c.source}`);
  db.prepare(
    `INSERT INTO contacts (id, rfp_id, name, title, company,
        source, source_url, source_title, relevance_note, role_tier, found_at)
     VALUES (@id, @rfp_id, @name, @title, @company,
        @source, @source_url, @source_title, @relevance_note, @role_tier, @found_at)
     ON CONFLICT(id) DO UPDATE SET
        title=COALESCE(excluded.title, contacts.title),
        company=COALESCE(excluded.company, contacts.company),
        source_url=COALESCE(excluded.source_url, contacts.source_url),
        source_title=COALESCE(excluded.source_title, contacts.source_title),
        relevance_note=COALESCE(excluded.relevance_note, contacts.relevance_note),
        role_tier=COALESCE(excluded.role_tier, contacts.role_tier)`
  ).run({
    id,
    rfp_id: c.rfpId,
    name: c.name,
    title: c.title ?? null,
    company: c.company ?? null,
    source: c.source,
    source_url: c.sourceUrl,
    source_title: c.sourceTitle ?? null,
    relevance_note: c.relevanceNote ?? null,
    role_tier: c.roleTier,
    found_at: new Date().toISOString(),
  });
}

/** How many *other* current RFPs name this person (the "active player" signal). */
export function otherCurrentRfpCount(name: string, rfpId: string): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT rfp_id) AS n FROM contacts
       WHERE LOWER(name) = LOWER(?) AND rfp_id != ?`
    )
    .get(name, rfpId) as { n: number };
  return row.n;
}

export type CrawlRun = {
  source: string;
  mode: "live" | "seeds";
  note: string;
  fetched: number;
  inserted: number;
  ran_at: string;
};

/** Persist the latest run for a source (so the UI can show live vs. seeds). */
export function recordCrawlRun(run: {
  source: string;
  mode: "live" | "seeds";
  note: string;
  fetched: number;
  inserted: number;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO crawl_runs (source, mode, note, fetched, inserted, ran_at)
     VALUES (@source, @mode, @note, @fetched, @inserted, @ran_at)
     ON CONFLICT(source) DO UPDATE SET
        mode=excluded.mode, note=excluded.note, fetched=excluded.fetched,
        inserted=excluded.inserted, ran_at=excluded.ran_at`
  ).run({ ...run, ran_at: new Date().toISOString() });
}

/** Latest run per source, for the header strip. */
export function getCrawlRuns(): CrawlRun[] {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM crawl_runs ORDER BY source ASC`)
    .all() as CrawlRun[];
}

/** Header-strip metadata: cached count + most recent fetch timestamp. */
export function getCrawlMeta(): { count: number; lastCrawl: string | null } {
  const db = getDb();
  const count = (
    db.prepare(`SELECT COUNT(*) AS n FROM rfps`).get() as { n: number }
  ).n;
  const last = db
    .prepare(`SELECT MAX(fetched_at) AS t FROM rfps`)
    .get() as { t: string | null };
  return { count, lastCrawl: last.t };
}
