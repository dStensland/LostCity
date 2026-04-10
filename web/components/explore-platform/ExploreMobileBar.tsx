"use client";

import { useRouter } from "next/navigation";
import type { ExploreLaneDefinition } from "@/lib/explore-platform/types";
import { useExploreUrlState } from "@/lib/explore-platform/url-state";

interface ExploreMobileBarProps {
  lanes: ExploreLaneDefinition[];
  portalSlug: string;
  portalChromeVisible?: boolean;
}

export function ExploreMobileBar({
  lanes,
  portalSlug,
  portalChromeVisible = true,
}: ExploreMobileBarProps) {
  const state = useExploreUrlState();
  const router = useRouter();

  return (
    <div
      className={`lg:hidden sticky ${portalChromeVisible ? "top-[73px]" : "top-0"} z-40 bg-[var(--void)]/95 backdrop-blur-sm border-b border-[var(--twilight)]/30`}
    >
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide px-3 py-2">
        <button
          type="button"
          onClick={() => state.goHome("push")}
          className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            !state.lane && !state.q
              ? "bg-[var(--coral)]/15 text-[var(--coral)]"
              : "text-[var(--soft)] hover:bg-[var(--dusk)]"
          }`}
        >
          Explore
        </button>
        {lanes.map((lane) => {
          const Icon = lane.icon;
          const isActive = state.lane === lane.id;
          return (
            <button
              key={lane.id}
              type="button"
              onClick={() => {
                if (lane.navigationHref) {
                  router.push(lane.navigationHref(portalSlug));
                } else {
                  state.setLane(lane.id);
                }
              }}
              className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap"
              style={
                isActive
                  ? {
                      backgroundColor: `color-mix(in srgb, ${lane.accentToken} 12%, transparent)`,
                      color: lane.accentToken,
                    }
                  : { color: "var(--soft)" }
              }
            >
              <Icon size={12} weight="duotone" />
              {lane.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
