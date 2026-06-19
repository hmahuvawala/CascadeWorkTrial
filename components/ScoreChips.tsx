import type { ScoreBreakdown } from "@/lib/scoring";

/**
 * Inline sub-score chips — the explainability payload. Each ranking is
 * defensible because every dimension is shown ("vertical 1.0 · region 1.0 · …").
 */
export default function ScoreChips({ score }: { score: ScoreBreakdown }) {
  const chips: { label: string; value: number }[] = [
    { label: "vertical", value: score.vertical },
    { label: "region", value: score.region },
    { label: "size", value: score.size },
    { label: "recency", value: score.recency },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <span
          key={c.label}
          className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
          title={`${c.label} sub-score`}
        >
          {c.label}
          <span className={c.value >= 0.85 ? "text-emerald-600" : c.value >= 0.5 ? "text-gray-800" : "text-amber-600"}>
            {c.value.toFixed(2)}
          </span>
        </span>
      ))}
    </div>
  );
}
