"use client";

import type { Pillar, PillarConfig } from "@/lib/concierge/concierge-types";

interface ConciergePillarNavProps {
  pillars: PillarConfig[];
  activePillar: Pillar;
  onPillarChange: (pillar: Pillar) => void;
}

export default function ConciergePillarNav({
  pillars,
  activePillar,
  onPillarChange,
}: ConciergePillarNavProps) {
  return (
    <nav
      className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1 -mx-4 px-4 md:mx-0 md:px-0"
      role="tablist"
      aria-label="Concierge sections"
    >
      {pillars.map((pillar) => {
        const isActive = pillar.id === activePillar;
        return (
          <button
            key={pillar.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`pillar-panel-${pillar.id}`}
            onClick={() => onPillarChange(pillar.id)}
            className={`relative flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-body whitespace-nowrap transition-all shrink-0 focus:outline-none focus:ring-2 focus:ring-[var(--hotel-champagne)] focus:ring-offset-2 focus:ring-offset-[var(--hotel-ivory)] ${
              isActive
                ? "bg-[var(--hotel-charcoal)] text-white shadow-sm"
                : "text-[var(--hotel-stone)] hover:bg-[var(--hotel-sand)]/50 hover:text-[var(--hotel-charcoal)]"
            }`}
          >
            {pillar.label}
            {pillar.badge && (
              <span
                className={`relative ml-1 px-1.5 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-medium ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-[var(--hotel-champagne)]/15 text-[var(--hotel-champagne)]"
                }`}
              >
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--hotel-champagne)] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--hotel-champagne)]" />
                </span>
                {pillar.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
