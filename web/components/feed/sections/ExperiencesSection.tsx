"use client";

/**
 * Things to Do — experience destinations, enriched with events when available.
 *
 * Self-fetching: loads data from /api/portals/[slug]/city-pulse/experiences
 * instead of receiving it as a prop from the monolithic city-pulse API.
 * This removes ~60KB from the initial feed response.
 *
 * Experiences are venues worth visiting (trails, parks, museums, etc.) —
 * events are enrichment, not a gate. A hiking trail with 0 events still belongs.
 *
 * 10 granular categories derived from THINGS_TO_DO_TILES (single source of truth
 * shared with Find → Things to Do tile grid).
 *
 * 6 default chips visible + "+" picker for the other 4.
 * Follows TheSceneSection's ephemeral ActivityPicker pattern — all data is
 * client-side, filtering is local, no refetch needed when chips change.
 */

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
/* eslint-disable @next/next/no-img-element -- venue images come from arbitrary external domains */
import {
  Binoculars,
  ArrowRight,
  CalendarBlank,
  ListBullets,
  Plus,
  X,
  Check,
  // Icons for tile categories
  Tree,
  Mountains,
  Bank,
  MaskHappy,
  GameController,
  LockKey,
  Buildings,
  Barbell,
  ShoppingBag,
  Books,
} from "@phosphor-icons/react";
import { THINGS_TO_DO_TILES, getVenueTypeLabel } from "@/lib/spots-constants";
import { triggerHaptic } from "@/lib/haptics";
import { SceneChip } from "@/components/feed/SceneEventRow";

import HorseSpinner from "@/components/ui/HorseSpinner";
import type { CityPulseSection as CityPulseSectionData } from "@/lib/city-pulse/types";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExperienceVenue {
  id: number;
  name: string;
  slug: string;
  venue_type: string | null;
  neighborhood: string | null;
  image_url: string | null;
  category: string;
  upcoming_event_count: number;
  vibes: string[] | null;
  short_description: string | null;
  price_level: number | null;
}

// ---------------------------------------------------------------------------
// Chip config derived from THINGS_TO_DO_TILES
// ---------------------------------------------------------------------------

/** Map tile iconType → Phosphor component */
const TILE_ICON_MAP: Record<string, ComponentType<IconProps>> = {
  museum: Bank,
  park: Tree,
  trail: Mountains,
  theater: MaskHappy,
  gaming: GameController,
  lock: LockKey,
  landmark: Buildings,
  fitness: Barbell,
  outdoors: Mountains,
  farmers_market: ShoppingBag,
  library: Books,
};

/** Short chip labels (tile labels are too verbose for chip strip) */
const CHIP_LABELS: Record<string, string> = {
  museums: "Museums",
  parks: "Parks",
  trails: "Trails",
  arts: "Arts & Theater",
  "entertainment-games": "Entertainment",
  "escape-rooms": "Escape Rooms",
  historic: "Historic",
  fitness: "Fitness",
  zoos: "Zoos",
  markets: "Markets",
  libraries: "Libraries",
};

type ExperienceChipConfig = {
  id: string;
  label: string;
  fullLabel: string;
  color: string;
  Icon: ComponentType<IconProps>;
};

const ALL_CHIP_CONFIGS: ExperienceChipConfig[] = THINGS_TO_DO_TILES.map((tile) => ({
  id: tile.key,
  label: CHIP_LABELS[tile.key] ?? tile.label,
  fullLabel: tile.label,
  color: tile.color,
  Icon: TILE_ICON_MAP[tile.iconType] ?? Binoculars,
}));

const CHIP_MAP = new Map(ALL_CHIP_CONFIGS.map((c) => [c.id, c]));

/** Default visible chip IDs — the 6 most useful categories */
const DEFAULT_VISIBLE_IDS = ["parks", "trails", "museums", "arts", "entertainment-games", "escape-rooms"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INITIAL_ROWS = 9;

// ---------------------------------------------------------------------------
// Transform section data → ExperienceVenue[]
// ---------------------------------------------------------------------------

function extractExperiences(section: CityPulseSectionData): ExperienceVenue[] {
  const meta = section.meta ?? {};
  const evCounts = (meta.venue_event_counts ?? {}) as Record<number, number>;
  return section.items
    .filter((item) => item.item_type === "destination")
    .map((item) => {
      const dest = (item as { destination: { venue: Record<string, unknown>; contextual_label?: string } }).destination;
      const venue = dest.venue;
      const venueId = venue.id as number;
      return {
        id: venueId,
        name: venue.name as string,
        slug: venue.slug as string,
        venue_type: venue.venue_type as string | null,
        neighborhood: venue.neighborhood as string | null,
        image_url: venue.image_url as string | null,
        category: (dest.contextual_label as string) ?? "museums",
        upcoming_event_count: evCounts[venueId] ?? 0,
        vibes: (venue.vibes as string[] | null) ?? null,
        short_description: (venue.short_description as string | null) ?? null,
        price_level: (venue.price_level as number | null) ?? null,
      };
    });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  portalSlug: string;
}

export default function ExperiencesSection({ portalSlug }: Props) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [localActivities, setLocalActivities] = useState<string[]>(() => [...DEFAULT_VISIBLE_IDS]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Self-fetch from dedicated experiences endpoint
  const { data: apiData, isLoading } = useQuery<{ section: CityPulseSectionData | null }>({
    queryKey: ["city-pulse-experiences", portalSlug],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(`/api/portals/${portalSlug}/city-pulse/experiences`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Experiences fetch failed: ${res.status}`);
        return res.json();
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 5 * 60 * 1000, // 5 min — matches endpoint cache TTL
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Extract venues from section data
  const experiences = useMemo<ExperienceVenue[]>(() => {
    if (!apiData?.section) return [];
    return extractExperiences(apiData.section);
  }, [apiData]);

  // Category counts — scoped to visible (local) activities
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    const activeSet = new Set(localActivities);
    for (const exp of experiences) {
      if (!activeSet.has(exp.category)) continue;
      counts[exp.category] = (counts[exp.category] || 0) + 1;
      counts.all++;
    }
    return counts;
  }, [experiences, localActivities]);

  // All-category counts (unscoped) for picker badges
  const allCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const exp of experiences) {
      counts[exp.category] = (counts[exp.category] || 0) + 1;
    }
    return counts;
  }, [experiences]);

  // Visible chips: only activities the user has selected AND with > 0 venues
  const visibleChips = useMemo(() =>
    localActivities
      .map((id) => CHIP_MAP.get(id))
      .filter((c): c is ExperienceChipConfig => !!c && (categoryCounts[c.id] || 0) > 0),
  [localActivities, categoryCounts]);

  // Filtered experiences by active category — scoped to localActivities
  const filtered = useMemo(() => {
    const activeSet = new Set(localActivities);
    if (activeCategory === "all") {
      return experiences.filter((e) => activeSet.has(e.category));
    }
    return experiences.filter((e) => e.category === activeCategory);
  }, [experiences, activeCategory, localActivities]);

  const visibleItems = showAll ? filtered : filtered.slice(0, INITIAL_ROWS);
  const hasMore = filtered.length > INITIAL_ROWS;
  const hiddenCount = filtered.length - INITIAL_ROWS;

  const handleChipTap = useCallback((chipId: string) => {
    triggerHaptic("selection");
    setActiveCategory(chipId);
    setShowAll(false);
  }, []);

  const handleToggleActivity = useCallback((actId: string) => {
    setLocalActivities((prev) => {
      if (prev.includes(actId)) {
        const remaining = prev.filter((id) => id !== actId);
        if (remaining.length === 0) return prev; // keep at least one
        return remaining;
      }
      return [...prev, actId];
    });
    // Reset to "all" when toggling categories to avoid showing empty state
    setActiveCategory("all");
  }, []);

  // Loading state — section header + spinner (no skeleton mismatch)
  if (isLoading) {
    return (
      <section>
        <FeedSectionHeader
          title="Things to Do"
          priority="secondary"
          accentColor="var(--neon-green)"
          icon={<Binoculars weight="duotone" className="w-5 h-5" />}
        />
        <div className="flex items-center justify-center py-10">
          <HorseSpinner color="var(--neon-green)" />
        </div>
      </section>
    );
  }

  if (experiences.length === 0) return null;

  return (
    <section className="animate-fade-in">
      {/* Section header */}
      <FeedSectionHeader
        title="Things to Do"
        priority="secondary"
        accentColor="var(--neon-green)"
        icon={<Binoculars weight="duotone" className="w-5 h-5" />}
        seeAllHref={`/${portalSlug}?view=find&type=destinations&tab=things-to-do`}
      />

      {/* Category chip strip */}
      <div className="relative mb-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 py-1 pr-8">
          <SceneChip
            label="All"
            Icon={ListBullets}
            color="var(--neon-green)"
            count={categoryCounts.all || 0}
            isActive={activeCategory === "all"}
            onClick={() => handleChipTap("all")}
          />
          {visibleChips.map((chip) => (
            <SceneChip
              key={chip.id}
              label={chip.label}
              Icon={chip.Icon}
              color={chip.color}
              count={categoryCounts[chip.id] || 0}
              isActive={activeCategory === chip.id}
              onClick={() => handleChipTap(chip.id)}
            />
          ))}
          <button
            onClick={() => setPickerOpen(!pickerOpen)}
            className={[
              "shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full transition-all active:scale-95 border",
              pickerOpen
                ? "bg-white/10 border-white/15 text-[var(--cream)]"
                : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)] hover:border-[var(--soft)]/30",
            ].join(" ")}
            aria-label="Customize experience categories"
          >
            {pickerOpen ? <X weight="bold" className="w-3.5 h-3.5" /> : <Plus weight="bold" className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[var(--void)] to-transparent" />
      </div>

      {/* Inline category picker */}
      {pickerOpen && (
        <ExperiencePicker
          activeIds={localActivities}
          counts={allCategoryCounts}
          onToggle={handleToggleActivity}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Venue grid */}
      {visibleItems.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {visibleItems.map((exp) => (
            <ExperienceRow
              key={exp.id}
              exp={exp}
              portalSlug={portalSlug}
            />
          ))}
        </div>
      )}

      {/* Expand / collapse */}
      {!showAll && hasMore && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-mono font-medium py-2 rounded-lg transition-all hover:bg-white/[0.02] text-[var(--neon-green)]"
        >
          +{hiddenCount} more
          <ArrowRight className="w-3 h-3" />
        </button>
      )}

      {/* Empty state for filtered category */}
      {filtered.length === 0 && (
        <div className="py-6 text-center">
          <p className="font-mono text-xs text-[var(--muted)]">
            No places in this category
          </p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Inline category picker — follows TheSceneSection ActivityPicker pattern
// ---------------------------------------------------------------------------

function ExperiencePicker({
  activeIds,
  counts,
  onToggle,
  onClose,
}: {
  activeIds: string[];
  counts: Record<string, number>;
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const activeSet = new Set(activeIds);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="mb-4 p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--twilight)]/50"
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="font-mono text-2xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          Customize Categories
        </span>
        <button
          onClick={onClose}
          className="p-0.5 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
        >
          <X weight="bold" className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ALL_CHIP_CONFIGS.map((chip) => {
          const isOn = activeSet.has(chip.id);
          const count = counts[chip.id] || 0;
          return (
            <button
              key={chip.id}
              onClick={() => onToggle(chip.id)}
              className={[
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-mono text-2xs tracking-wide transition-all active:scale-95 border",
                isOn
                  ? "bg-white/[0.08] border-white/15 text-[var(--cream)]"
                  : "border-transparent text-[var(--muted)] hover:bg-white/[0.03]",
              ].join(" ")}
            >
              {isOn ? (
                <Check weight="bold" className="w-3 h-3" style={{ color: chip.color }} />
              ) : (
                <chip.Icon weight="bold" className="w-3 h-3" />
              )}
              {chip.fullLabel}
              {count > 0 && (
                <span className="text-2xs tabular-nums min-w-4 text-center opacity-50">{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Experience venue row
// ---------------------------------------------------------------------------

function ExperienceRow({
  exp,
  portalSlug,
}: {
  exp: ExperienceVenue;
  portalSlug: string;
  isLast?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const chipConfig = CHIP_MAP.get(exp.category);
  const FallbackIcon = chipConfig?.Icon ?? Binoculars;
  const chipColor = chipConfig?.color ?? "var(--neon-green)";
  const showImage = exp.image_url && !imgError;

  return (
    <Link
      href={`/${portalSlug}/spots/${exp.slug}`}
      className="group rounded-lg border border-[var(--twilight)]/40 bg-[var(--night)] overflow-hidden transition-all hover:border-[var(--twilight)]/60 hover:bg-white/[0.02]"
    >
      {/* Image — square aspect ratio for compact grid */}
      <div className="relative aspect-square overflow-hidden bg-[var(--dusk)]">
        {showImage ? (
          <img
            src={exp.image_url!}
            alt={exp.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${chipColor} 15%, var(--night)), var(--void))` }}
          >
            <FallbackIcon weight="duotone" className="w-8 h-8" style={{ color: `color-mix(in srgb, ${chipColor} 40%, var(--muted))` }} />
          </div>
        )}
        {/* Event count badge — top right */}
        {exp.upcoming_event_count > 0 && (
          <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-2xs font-mono font-bold bg-[var(--coral)]/90 text-white backdrop-blur-sm">
            <CalendarBlank weight="bold" className="w-2.5 h-2.5" />
            {exp.upcoming_event_count}
          </span>
        )}
      </div>

      {/* Content — compact */}
      <div className="px-2 py-1.5">
        <h3 className="text-xs font-semibold text-[var(--cream)] line-clamp-2 leading-tight group-hover:text-[var(--neon-green)] transition-colors">
          {exp.name}
        </h3>
        <p className="text-2xs text-[var(--muted)] truncate mt-0.5">
          {exp.neighborhood || getVenueTypeLabel(exp.venue_type)}
        </p>
      </div>
    </Link>
  );
}
