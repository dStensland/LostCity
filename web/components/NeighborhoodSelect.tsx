"use client";

import { useRouter } from "next/navigation";

interface Props {
  neighborhoods: readonly string[];
  selected: string;
  currentType: string;
  currentVibe: string;
}

function buildFilterUrl(
  type: string,
  vibe: string,
  neighborhood: string
): string {
  const params = new URLSearchParams();
  if (type && type !== "all") params.set("type", type);
  if (vibe) params.set("vibe", vibe);
  if (neighborhood && neighborhood !== "all") params.set("neighborhood", neighborhood);

  const query = params.toString();
  return `/spots${query ? `?${query}` : ""}`;
}

export default function NeighborhoodSelect({
  neighborhoods,
  selected,
  currentType,
  currentVibe
}: Props) {
  const router = useRouter();

  return (
    <select
      value={selected}
      onChange={(e) => router.push(buildFilterUrl(currentType, currentVibe, e.target.value))}
      className="bg-[var(--twilight)] text-[var(--cream)] font-mono text-xs px-2 py-1 rounded border border-[var(--twilight)] focus:outline-none focus:border-[var(--coral)]"
    >
      <option value="all">All Neighborhoods</option>
      {neighborhoods.map((hood) => (
        <option key={hood} value={hood}>
          {hood}
        </option>
      ))}
    </select>
  );
}
