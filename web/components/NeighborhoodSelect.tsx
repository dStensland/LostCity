"use client";

import { useRouter } from "next/navigation";

interface Props {
  neighborhoods: readonly string[];
  selected: string;
  buildUrl: (neighborhood: string) => string;
}

export default function NeighborhoodSelect({ neighborhoods, selected, buildUrl }: Props) {
  const router = useRouter();

  return (
    <select
      value={selected}
      onChange={(e) => router.push(buildUrl(e.target.value))}
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
