import type { Profile } from "@/lib/profiles";

export default function ProfileCard({
  profile,
  active,
  onSelect,
}: {
  profile: Profile;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex-1 min-w-[240px] rounded-xl border p-4 text-left transition-all ${
        active
          ? "border-[#1e3a5f] bg-[#1e3a5f] text-white shadow-md"
          : "border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:shadow-sm"
      }`}
    >
      <div className="text-base font-semibold">{profile.name}</div>
      <div
        className={`mt-1 text-sm leading-snug ${
          active ? "text-blue-100" : "text-gray-500"
        }`}
      >
        {profile.specialty}
      </div>
      <div
        className={`mt-3 text-xs font-medium uppercase tracking-wide ${
          active ? "text-blue-200" : "text-gray-400"
        }`}
      >
        {profile.regions.slice(0, 4).join(" · ")}
      </div>
    </button>
  );
}
