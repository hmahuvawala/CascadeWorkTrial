import type { ContactView } from "@/lib/enrich";
import { roleTierLabel } from "@/lib/influence";

function RoleBadge({ tier }: { tier: ContactView["roleTier"] }) {
  if (!tier || tier === "peripheral") return null;
  const cls =
    tier === "decision_maker"
      ? "bg-violet-100 text-violet-700"
      : "bg-sky-100 text-sky-700";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {roleTierLabel(tier)}
    </span>
  );
}

export default function ContactRow({ contact }: { contact: ContactView }) {
  const roleLine = [contact.title, contact.company ? `@ ${contact.company}` : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-gray-900">{contact.name}</span>
          <span className="rounded bg-gray-900 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {contact.relevanceScore}
          </span>
          <RoleBadge tier={contact.roleTier} />
          {contact.otherRfpCount > 0 && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              Active on {contact.otherRfpCount} other current RFP
              {contact.otherRfpCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {roleLine && (
          <div className="mt-0.5 text-sm text-gray-600">{roleLine}</div>
        )}
        {contact.relevanceNote && (
          <div className="mt-1 text-sm leading-snug text-gray-700">
            {contact.relevanceNote}
          </div>
        )}
        {contact.relevanceReasons.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {contact.relevanceReasons.map((reason) => (
              <span
                key={`${contact.id}-${reason}`}
                className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600"
              >
                {reason}
              </span>
            ))}
          </div>
        )}
        {contact.sourceTitle && (
          <div className="mt-1 text-xs text-gray-400">
            Source: {contact.sourceTitle}
          </div>
        )}
      </div>
    </div>
  );
}
