"use client";

import { memo, type ReactNode } from "react";
import SmartImage from "@/components/SmartImage";
import CategoryIcon from "@/components/CategoryIcon";
import { getCategoryColor } from "@/lib/category-config";

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlaceHeroProps {
  imageUrl: string | null;
  /** spot_type string — used for fallback icon + gradient */
  category?: string | null;
  /** Overlay slot (e.g., HeroOverlayNav back button) */
  overlaySlot?: ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PlaceHero = memo(function PlaceHero({
  imageUrl,
  category,
  overlaySlot,
}: PlaceHeroProps) {
  const categoryColor = getCategoryColor(category ?? null);

  // Fallback: no image — gradient strip with centered icon
  if (!imageUrl) {
    return (
      <div
        className="relative h-[180px] lg:h-[320px] w-full overflow-hidden"
        style={{
          background: `linear-gradient(135deg, var(--dusk) 0%, var(--night) 100%)`,
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <CategoryIcon
            type={category ?? "other"}
            size={64}
            className="opacity-[0.15]"
            glow="none"
          />
          <span
            className="text-2xs font-mono uppercase tracking-[0.15em] opacity-40"
            style={{ color: categoryColor || "var(--soft)" }}
          >
            VENUE
          </span>
        </div>
        {overlaySlot}
      </div>
    );
  }

  // Image hero — 200px mobile, ~50vh desktop (capped at 460px) for proper presence
  return (
    <div className="relative w-full h-[200px] lg:h-[clamp(360px,45vh,460px)] overflow-hidden bg-[var(--night)]">
      <SmartImage
        src={imageUrl}
        alt=""
        fill
        className="object-cover"
        sizes="100vw"
        priority
      />
      {/* Bottom gradient: transparent → --void for clean transition into content */}
      <div
        className="absolute inset-x-0 bottom-0 h-[60px] lg:h-[120px] pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, transparent, color-mix(in srgb, var(--void) 95%, transparent))",
        }}
      />
      {overlaySlot}
    </div>
  );
});

export type { PlaceHeroProps };
