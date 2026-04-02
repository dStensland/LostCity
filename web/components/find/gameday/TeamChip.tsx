"use client";

import { memo } from "react";
import Image from "next/image";

interface TeamChipProps {
  slug: string;
  name: string;
  accent: string;
  logo?: string;
  isActive: boolean;
  onClick: () => void;
}

export const TeamChip = memo(function TeamChip({
  slug: _slug,
  name,
  accent,
  logo,
  isActive,
  onClick,
}: TeamChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap"
      style={
        isActive
          ? {
              backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`,
              color: accent,
            }
          : {
              backgroundColor: "transparent",
              color: "var(--soft)",
            }
      }
    >
      {logo && (
        <Image
          src={logo}
          alt=""
          width={16}
          height={16}
          className="rounded-full object-contain"
          aria-hidden
        />
      )}
      {name}
    </button>
  );
});

export type { TeamChipProps };
