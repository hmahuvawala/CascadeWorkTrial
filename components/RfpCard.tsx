"use client";

import { useState } from "react";
import type { EnrichResult } from "@/lib/enrich";
import type { ScoredRfp } from "@/lib/scoring";
import {
  formatUSD,
  sourceBadgeClass,
  sourceLabel,
  timeAgo,
} from "@/lib/format";
import { createLogger } from "@/lib/logger";
import ContactRow from "./ContactRow";
import ScoreChips from "./ScoreChips";

const log = createLogger("rfp-card");

function needsSolicitationResolve(
  rfp: ScoredRfp,
  url: string
): boolean {
  if (url.includes("/psp/") || url.includes("sam.gov")) return false;
  if (rfp.view_url && !/event-details\.aspx/i.test(rfp.view_url)) return false;
  return (
    /event-details\.aspx/i.test(url) ||
    rfp.source === "caleprocure" ||
    /caleprocure\.ca\.gov/i.test(rfp.url)
  );
}

export default function RfpCard({
  rfp,
  profileId,
}: {
  rfp: ScoredRfp;
  profileId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openingLink, setOpeningLink] = useState(false);
  const [solicitationUrl, setSolicitationUrl] = useState(
    rfp.view_url ?? rfp.url
  );
  const [result, setResult] = useState<EnrichResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openSolicitation() {
    setOpeningLink(true);
    try {
      let url = result?.viewUrl ?? rfp.view_url ?? solicitationUrl;
      if (needsSolicitationResolve(rfp, url)) {
        const res = await fetch(`/api/solicitation-url?rfpId=${rfp.id}`);
        if (res.ok) {
          const data = (await res.json()) as { url: string };
          url = data.url;
          setSolicitationUrl(url);
        }
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      log.error("open solicitation failed", e);
      window.open(solicitationUrl, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningLink(false);
    }
  }

  async function findContacts() {
    if (result) {
      log.info(`toggling contacts panel for "${rfp.title.slice(0, 40)}"`);
      setOpen((o) => !o);
      return;
    }
    log.info(`find contacts clicked for "${rfp.title.slice(0, 40)}"`, {
      rfpId: rfp.id,
      profileId,
    });
    setLoading(true);
    setError(null);
    const start = Date.now();
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfpId: rfp.id, profileId, force: true }),
      });
      if (!res.ok) throw new Error(`enrich failed (${res.status})`);
      const data = (await res.json()) as EnrichResult;
      log.info(`contacts received (${Date.now() - start}ms)`, {
        onThisProject: data.onThisProject.length,
        relevant: data.relevant.length,
        cached: data.cached,
      });
      setResult(data);
      if (data.viewUrl) setSolicitationUrl(data.viewUrl);
      setOpen(true);
    } catch (e) {
      log.error("find contacts failed", e);
      setError(e instanceof Error ? e.message : "Enrichment failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-semibold ${sourceBadgeClass(
                rfp.source
              )}`}
            >
              {sourceLabel(rfp.source)}
            </span>
            <h3 className="text-base font-semibold text-gray-900">{rfp.title}</h3>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
            {rfp.owner_company && (
              <span className="font-medium text-gray-700">
                {rfp.owner_company}
              </span>
            )}
            {rfp.location && <span>{rfp.location}</span>}
            <span>{timeAgo(rfp.posted_date)}</span>
            <span>{formatUSD(rfp.estimated_value_usd)}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-bold text-[#1e3a5f]">
            {rfp.total.toFixed(2)}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-gray-400">
            match
          </div>
        </div>
      </div>

      <div className="mt-3">
        <ScoreChips score={rfp} />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={findContacts}
          disabled={loading}
          className="rounded-lg bg-[#1e3a5f] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#152a45] disabled:opacity-60"
        >
          {loading
            ? "Finding contacts…"
            : result
              ? open
                ? "Hide contacts"
                : "Show contacts"
              : "Find contacts"}
        </button>
        <button
          type="button"
          onClick={openSolicitation}
          disabled={openingLink}
          className="text-sm text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline disabled:opacity-60"
        >
          {openingLink ? "Opening…" : "View solicitation ↗"}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {open && result && (
        <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
          {/* Category 1 — named on the RFP */}
          <section>
            <h4 className="text-sm font-bold text-gray-900">On this project</h4>
            <p className="mb-2 text-xs text-gray-400">
              Contacts named on the RFP itself
            </p>
            <div className="space-y-2">
              {result.onThisProject.length ? (
                result.onThisProject.map((c) => (
                  <ContactRow key={c.id} contact={c} />
                ))
              ) : (
                <p className="text-sm text-gray-400">
                  No named contacts on the listing (often just a procurement
                  email).
                </p>
              )}
            </div>
          </section>

          {/* Category 2 — could be relevant (open-web), ranked by score */}
          <section className="border-l-2 border-blue-300 pl-3">
            <h4 className="text-sm font-bold text-gray-900">
              Could be relevant to this project
            </h4>
            <p className="mb-2 text-xs text-gray-400">
              People at the owner organization found across the web, ranked by
              relevance score
            </p>
            <div className="space-y-2">
              {result.relevant.length ? (
                result.relevant.map((c) => (
                  <ContactRow key={c.id} contact={c} />
                ))
              ) : (
                <p className="text-sm text-gray-400">
                  No relevant people surfaced for this organization yet.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
