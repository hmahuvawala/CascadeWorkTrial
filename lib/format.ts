/** Pure display helpers, safe to import in client components. */

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function formatUSD(v: number | null | undefined): string {
  if (v == null) return "Value undisclosed";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `$${Math.round(v / 1000)}K`;
  return `$${v}`;
}

export function sourceLabel(source: string): string {
  switch (source) {
    case "sam.gov":
      return "SAM.gov";
    case "caleprocure":
      return "CalEProcure";
    case "ca_hhs":
      return "CA DGS / HHS";
    case "constructiondive":
      return "Construction Dive";
    default:
      return source;
  }
}

export function sourceBadgeClass(source: string): string {
  switch (source) {
    case "sam.gov":
      return "bg-blue-100 text-blue-700";
    case "caleprocure":
      return "bg-amber-100 text-amber-700";
    case "ca_hhs":
      return "bg-rose-100 text-rose-700";
    case "constructiondive":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}
