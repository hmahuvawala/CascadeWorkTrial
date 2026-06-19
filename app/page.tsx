"use client";

import { useEffect, useState } from "react";
import { profiles } from "@/lib/profiles";
import type { ScoredRfp } from "@/lib/scoring";
import { sourceLabel, timeAgo } from "@/lib/format";
import { createLogger } from "@/lib/logger";
import ProfileCard from "@/components/ProfileCard";
import RfpCard from "@/components/RfpCard";

type CrawlRun = {
  source: string;
  mode: "live" | "seeds";
  note: string;
  fetched: number;
  inserted: number;
  ran_at: string;
};
type CrawlMeta = {
  count: number;
  lastCrawl: string | null;
  sources?: CrawlRun[];
};
type RankResponse = { ranked: ScoredRfp[]; meta: CrawlMeta };

const log = createLogger("page");

export default function Home() {
  const [profileId, setProfileId] = useState<string>(profiles[0].id);
  const [ranked, setRanked] = useState<ScoredRfp[]>([]);
  const [meta, setMeta] = useState<CrawlMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [crawling, setCrawling] = useState(false);
  const [reloadKey, setReloadKey] = useState(0); // bump to re-fetch after a crawl

  // Fetch ranking whenever the profile changes or a crawl completes. State is
  // only updated after the awaited fetch resolves (no synchronous setState).
  useEffect(() => {
    let active = true;
    (async () => {
      log.info(`loading ranking for profile "${profileId}"`);
      try {
        const res = await fetch(`/api/rank?profile=${profileId}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as RankResponse;
        if (!active) return;
        setRanked(data.ranked ?? []);
        setMeta(data.meta ?? null);
        log.info(`ranking loaded: ${data.ranked?.length ?? 0} match(es)`, {
          cached: data.meta?.count,
        });
      } catch (err) {
        log.error("ranking load failed", err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [profileId, reloadKey]);

  function selectProfile(id: string) {
    if (id === profileId) return;
    log.info(`profile selected: ${id}`);
    setLoading(true);
    setProfileId(id);
  }

  async function refreshCrawl() {
    log.info("refresh crawl clicked");
    setCrawling(true);
    try {
      const res = await fetch("/api/crawl", { method: "POST" });
      const data = await res.json();
      log.info("crawl finished", data);
      setLoading(true);
      setReloadKey((k) => k + 1);
    } catch (err) {
      log.error("crawl request failed", err);
    } finally {
      setCrawling(false);
    }
  }

  const liveCount = meta?.sources
    ? meta.sources.filter((s) => s.mode === "live").length
    : null;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Cascade — AEC Opportunity Scanner
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Fresh RFPs ranked against your firm profile, with the owner-side
          contacts behind each project.
        </p>
      </header>

      {/* Header strip */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-gray-600">
            <span className="font-medium text-gray-800">
              {meta?.count ?? 0} RFPs cached
            </span>
            {liveCount !== null && (
              <span className="text-gray-400">
                {" "}
                · {liveCount}/{meta?.sources?.length} sources live
              </span>
            )}
            {meta?.lastCrawl && (
              <span className="text-gray-400">
                {" "}
                · Last crawl {timeAgo(meta.lastCrawl)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={refreshCrawl}
            disabled={crawling}
            className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
          >
            {crawling ? "Crawling…" : "Refresh crawl"}
          </button>
        </div>

        {/* Per-source crawl status — shows whether each source ran live or fell
            back to curated seeds (hover for the reason). */}
        {meta?.sources && meta.sources.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2 border-t border-gray-100 pt-2.5">
            {meta.sources.map((s) => (
              <span
                key={s.source}
                title={s.note}
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${
                  s.mode === "live"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    s.mode === "live" ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                {sourceLabel(s.source)}
                <span className="font-normal opacity-70">
                  {s.mode === "live" ? "live" : "failed"} · {s.inserted}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Profile picker */}
      <div className="mb-7 flex flex-wrap gap-3">
        {profiles.map((p) => (
          <ProfileCard
            key={p.id}
            profile={p}
            active={p.id === profileId}
            onSelect={() => selectProfile(p.id)}
          />
        ))}
      </div>

      {/* Feed */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Ranked opportunities
        </h2>
        {!loading && (
          <span className="text-sm text-gray-400">{ranked.length} matches</span>
        )}
      </div>

      {loading ? (
        <p className="py-10 text-center text-gray-400">Ranking opportunities…</p>
      ) : ranked.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-10 text-center text-gray-500">
          No fresh matches for this profile.{" "}
          <button
            type="button"
            onClick={refreshCrawl}
            className="font-semibold text-emerald-700 underline"
          >
            Run the crawler
          </button>{" "}
          to populate the cache.
        </div>
      ) : (
        <div className="space-y-3">
          {ranked.map((rfp) => (
            <RfpCard key={rfp.id} rfp={rfp} profileId={profileId} />
          ))}
        </div>
      )}

      <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-400">
        We never scrape LinkedIn. Contacts are surfaced from public RFP listings,
        awarded-project news, and Google search results — keeping a human in the
        loop and sidestepping ToS issues.
      </footer>
    </div>
  );
}
