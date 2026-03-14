"use client";

import { memo } from "react";
import { MapTrifold } from "@phosphor-icons/react";

interface PlansViewProps {
  portalSlug: string;
}

export const PlansView = memo(function PlansView({ portalSlug: _portalSlug }: PlansViewProps) {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center px-6 py-16 text-center">
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
        style={{ backgroundColor: "color-mix(in srgb, var(--coral) 12%, white)" }}
      >
        <MapTrifold
          size={28}
          weight="duotone"
          style={{ color: "var(--coral)" }}
        />
      </div>
      <h2
        className="text-lg font-semibold text-[var(--cream)] mb-2"
        style={{ fontFamily: "var(--font-outfit, system-ui, sans-serif)" }}
      >
        Family Plans
      </h2>
      <p className="text-sm text-[var(--muted)] max-w-xs">
        Build and share outings with your crew. Coming soon.
      </p>
    </div>
  );
});

export type { PlansViewProps };
