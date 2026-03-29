"use client";

import { memo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Palette,
  ForkKnife,
  MoonStars,
  Tree,
  MusicNotes,
  Ticket,
} from "@phosphor-icons/react";
import type { DiscoveryPlaceEntity, VerticalLane } from "@/lib/types/discovery";
import { LANE_CONFIG } from "@/lib/types/discovery";
import { DiscoveryCard } from "@/components/cards/DiscoveryCard";

// -------------------------------------------------------------------------
// Lane icon map
// -------------------------------------------------------------------------

const LANE_ICONS: Record<
  string,
  React.ComponentType<{ size?: number; className?: string; color?: string; weight?: "duotone" | "regular" | "bold" | "fill" | "thin" | "light" }>
> = {
  palette: Palette,
  "fork-knife": ForkKnife,
  "moon-stars": MoonStars,
  tree: Tree,
  "music-notes": MusicNotes,
  ticket: Ticket,
};

// -------------------------------------------------------------------------
// Fetch hook — inline since it's only used here
// -------------------------------------------------------------------------

interface UseLaneSpotsResult {
  items: DiscoveryPlaceEntity[];
  openCount: number;
  loading: boolean;
}

function useLaneSpots(
  portalSlug: string,
  lane: VerticalLane,
  limit = 3
): UseLaneSpotsResult {
  const [items, setItems] = useState<DiscoveryPlaceEntity[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const config = LANE_CONFIG[lane];
    const params = new URLSearchParams({
      portal: portalSlug,
      place_type: config.placeTypes.join(","),
      limit: String(limit),
    });

    async function run() {
      try {
        const res = await fetch(`/api/spots?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`spots: ${res.status}`);
        const data = (await res.json()) as {
          spots?: DiscoveryPlaceEntity[];
          meta?: { openCount?: number };
        };
        const spots: DiscoveryPlaceEntity[] = data.spots ?? [];
        const count =
          data.meta?.openCount ?? spots.filter((s) => s.is_open).length;
        setItems(spots);
        setOpenCount(count);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error(`[LanePreviewSection:${lane}] fetch error:`, err);
        setItems([]);
        setOpenCount(0);
      } finally {
        setLoading(false);
      }
    }

    run();

    return () => {
      controller.abort();
    };
  }, [portalSlug, lane, limit]);

  return { items, openCount, loading };
}

// -------------------------------------------------------------------------
// Skeleton
// -------------------------------------------------------------------------

function LaneSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-[72px] rounded-card bg-[var(--dusk)] animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

// -------------------------------------------------------------------------
// LanePreviewSection
// -------------------------------------------------------------------------

interface LanePreviewSectionProps {
  lane: VerticalLane;
  portalSlug: string;
}

export const LanePreviewSection = memo(function LanePreviewSection({
  lane,
  portalSlug,
}: LanePreviewSectionProps) {
  const { items, openCount, loading } = useLaneSpots(portalSlug, lane, 3);

  if (!loading && items.length === 0) return null;

  const config = LANE_CONFIG[lane];
  const LaneIcon = LANE_ICONS[config.icon] ?? Ticket;
  const seeAllHref = `/${portalSlug}?view=find&lane=${lane}`;

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <LaneIcon
            size={14}
            color={config.color}
            weight="duotone"
          />
          <span className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--cream)]">
            {config.label}
          </span>
          {/* Count badge — visible once loaded */}
          {!loading && openCount > 0 && (
            <span
              className="font-mono text-2xs font-bold uppercase tracking-wider rounded px-1.5 py-0.5"
              style={{
                backgroundColor: `${config.color}1A`,
                color: config.color,
              }}
            >
              {openCount} OPEN
            </span>
          )}
        </div>
        <Link
          href={seeAllHref}
          className="text-xs flex items-center gap-1 text-[var(--muted)] hover:text-[var(--soft)] transition-colors"
        >
          See all →
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <LaneSkeleton />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <DiscoveryCard
              key={`place-${item.id}`}
              entity={item}
              portalSlug={portalSlug}
              lane={lane}
            />
          ))}
        </div>
      )}
    </section>
  );
});

export type { LanePreviewSectionProps };
