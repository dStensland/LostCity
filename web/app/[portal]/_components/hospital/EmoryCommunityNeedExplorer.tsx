"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type CommunityNeedLens = {
  id: string;
  label: string;
  description: string;
  imageUrl: string;
  filterId: string;
  tab: "events" | "venues" | "organizations";
};

type EmoryCommunityNeedExplorerProps = {
  stateKey: string;
  lenses: CommunityNeedLens[];
};

function updateSearchParams(args: {
  current: URLSearchParams;
  stateKey: string;
  lens: CommunityNeedLens;
}): URLSearchParams {
  const { current, stateKey, lens } = args;
  const next = new URLSearchParams(current.toString());
  next.set(`${stateKey}_filter`, lens.filterId);
  next.set(`${stateKey}_tab`, lens.tab);
  next.set(`${stateKey}_view`, "list");
  return next;
}

export default function EmoryCommunityNeedExplorer({
  stateKey,
  lenses,
}: EmoryCommunityNeedExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeFilter = searchParams.get(`${stateKey}_filter`) || lenses[0]?.filterId || "all";
  const activeLensId = useMemo(
    () => lenses.find((lens) => lens.filterId === activeFilter)?.id || lenses[0]?.id || "",
    [lenses, activeFilter]
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {lenses.map((lens) => {
        const isActive = lens.id === activeLensId;
        return (
          <button
            key={lens.id}
            type="button"
            onClick={() => {
              const nextParams = updateSearchParams({
                current: new URLSearchParams(searchParams.toString()),
                stateKey,
                lens,
              });
              router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
            }}
            className={`relative overflow-hidden rounded-xl border text-left transition ${
              isActive
                ? "border-[#9bc0ff] shadow-[0_0_0_2px_rgba(155,192,255,0.22)]"
                : "border-[var(--twilight)]"
            }`}
            aria-pressed={isActive}
          >
            <div
              className="min-h-[150px] sm:min-h-[172px] p-3.5 flex flex-col justify-end"
              style={{
                background: `linear-gradient(180deg, rgba(10,24,48,0.08) 12%, rgba(10,24,48,0.68) 100%), url("${lens.imageUrl}") center/cover no-repeat`,
              }}
            >
              <p className="text-[11px] uppercase tracking-[0.08em] text-white/85">{isActive ? "Selected lens" : "Need lens"}</p>
              <h3 className="mt-1 text-lg leading-[1.02] text-white font-semibold">{lens.label}</h3>
              <p className="mt-1 text-xs text-white/90 max-w-[32ch]">{lens.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
