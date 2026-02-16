"use client";

import type { AmbientContext } from "@/lib/concierge/concierge-types";

interface ConciergeAmbientBarProps {
  ambient: AmbientContext;
  cityName?: string;
}

export default function ConciergeAmbientBar({ ambient, cityName }: ConciergeAmbientBarProps) {
  const { greeting, weatherBadge } = ambient;

  return (
    <div className="flex items-center justify-between py-3 px-1 text-sm font-body">
      <div className="flex items-center gap-2 text-[var(--hotel-charcoal)]">
        <span className="font-display text-base">{greeting.title}</span>
        {cityName && (
          <>
            <span className="text-[var(--hotel-sand)]">&middot;</span>
            <span className="text-[var(--hotel-stone)] text-xs">{cityName}</span>
          </>
        )}
      </div>
      {weatherBadge && (
        <div className="flex items-center gap-1.5 text-xs text-[var(--hotel-stone)]">
          <WeatherIcon signal={ambient.weatherSignal} />
          <span>{weatherBadge}</span>
        </div>
      )}
    </div>
  );
}

function WeatherIcon({ signal }: { signal: string }) {
  switch (signal) {
    case "rain":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
          <path d="M16 14v6" /><path d="M8 14v6" /><path d="M12 16v6" />
        </svg>
      );
    case "nice":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" /><path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" /><path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
        </svg>
      );
    case "cold":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 12h20" /><path d="M12 2v20" />
          <path d="m20 16-4-4 4-4" /><path d="m4 8 4 4-4 4" />
          <path d="m16 4-4 4-4-4" /><path d="m8 20 4-4 4 4" />
        </svg>
      );
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z" />
        </svg>
      );
  }
}
