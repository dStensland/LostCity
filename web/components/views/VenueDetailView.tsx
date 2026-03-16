"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "@/components/SmartImage";
import { SPOT_TYPES, formatPriceLevel, getSpotTypeLabels, type SpotType } from "@/lib/spots-constants";
import FollowButton from "@/components/FollowButton";
import RecommendButton from "@/components/RecommendButton";
import VenueTagList from "@/components/VenueTagList";
import FlagButton from "@/components/FlagButton";
import LinkifyText from "@/components/LinkifyText";
import Skeleton from "@/components/Skeleton";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import NearbySection from "@/components/NearbySection";
import HoursSection from "@/components/HoursSection";
import { type HoursData } from "@/lib/hours";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { isDogPortal } from "@/lib/dog-art";
import { HIGHLIGHT_CONFIG, type VenueHighlight } from "@/lib/venue-highlights";
import {
  filterVenueFeaturesForPortal,
  type VenueFeature,
} from "@/lib/venue-features";
import VenueFeaturesSection from "@/components/detail/VenueFeaturesSection";
import { AccoladesSection, type EditorialMention } from "@/components/detail/AccoladesSection";
import VenueSpecialsSection, { type VenueSpecial } from "@/components/detail/VenueSpecialsSection";
import DirectionsDropdown from "@/components/DirectionsDropdown";
import GettingThereSection, { type WalkableNeighbor } from "@/components/GettingThereSection";
import { usePortal } from "@/lib/portal-context";
import { ATTACHED_CHILD_DESTINATION_SECTION_TITLE } from "@/lib/destination-graph";
import {
  CaretRight,
  ForkKnife,
  Globe,
  InstagramLogo,
  Phone,
  Tag,
} from "@phosphor-icons/react";
import { SectionHeader } from "@/components/detail/SectionHeader";
import { QuickActionLink } from "@/components/detail/QuickActionLink";
import { CollapsibleSection } from "@/components/detail/CollapsibleSection";
import NeonBackButton from "@/components/detail/NeonBackButton";
import DetailShell from "@/components/detail/DetailShell";
import Badge from "@/components/ui/Badge";
import Dot from "@/components/ui/Dot";
import VenueShowtimes, { type ShowtimeEvent } from "@/components/VenueShowtimes";
import DogNearbySection from "@/components/detail/DogNearbySection";
import { DestinationDetailSections } from "@/components/adventure/DestinationDetailSections";
import dynamic from "next/dynamic";

const DogTagModal = dynamic(
  () => import("@/app/[portal]/_components/dog/DogTagModal"),
  { ssr: false }
);
const OutingPlannerSheet = dynamic(
  () => import("@/components/outing-planner/OutingPlannerSheet"),
  { ssr: false },
);

type SpotData = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  city: string;
  state: string;
  neighborhood: string | null;
  description: string | null;
  short_description: string | null;
  image_url: string | null;
  website: string | null;
  instagram: string | null;
  phone: string | null;
  hours: HoursData | null;
  hours_display: string | null;
  is_24_hours: boolean | null;
  price_level: number | null;
  spot_type: string | null;
  spot_types: string[] | null;
  vibes: string[] | null;
  nearest_marta_station: string | null;
  marta_walk_minutes: number | null;
  marta_lines: string[] | null;
  beltline_adjacent: boolean | null;
  beltline_segment: string | null;
  beltline_walk_minutes: number | null;
  parking_type: string[] | null;
  parking_free: boolean | null;
  parking_note: string | null;
  transit_score: number | null;
  walkable_neighbor_count: number | null;
  lat: number | null;
  lng: number | null;
};

type UpcomingEvent = {
  id: number;
  title: string;
  start_date: string;
  end_date?: string | null;
  start_time: string | null;
  is_free?: boolean;
  price_min: number | null;
  category: string | null;
  series_id?: string | null;
  series?: {
    id: string;
    slug: string;
    title: string;
    series_type: string;
    image_url: string | null;
  } | null;
  image_url?: string | null;
  artists?: {
    name: string;
    billing_order?: number | null;
    is_headliner?: boolean;
  }[];
  lineup?: string | null;
  going_count?: number;
  interested_count?: number;
  recommendation_count?: number;
};

type VenueOccasion = {
  occasion: string;
  confidence: number;
  source: string;
};

const OCCASION_LABELS: Record<string, string> = {
  date_night: "Date Night",
  groups: "Groups",
  solo: "Solo",
  outdoor_dining: "Outdoor Dining",
  late_night: "Late Night",
  quick_bite: "Quick Bite",
  special_occasion: "Special Occasion",
  beltline: "BeltLine",
  pre_game: "Pre-Game",
  brunch: "Brunch",
  family_friendly: "Family Friendly",
  dog_friendly: "Dog Friendly",
  live_music: "Live Music",
  dancing: "Dancing",
};

type NearbyDestination = {
  id: number;
  name: string;
  slug: string;
  spot_type: string | null;
  neighborhood: string | null;
  distance?: number;
  image_url?: string | null;
  short_description?: string | null;
  hours?: HoursData | null;
  hours_display?: string | null;
  is_24_hours?: boolean | null;
  vibes?: string[] | null;
};

type NearbyDestinations = {
  food: NearbyDestination[];
  drinks: NearbyDestination[];
  nightlife: NearbyDestination[];
  caffeine: NearbyDestination[];
  fun: NearbyDestination[];
};

interface VenueDetailViewProps {
  slug: string;
  portalSlug: string;
  onClose: () => void;
}

const dogVibeLabels: Record<string, string> = {
  "off-leash": "Off-Leash Area",
  "pup-cup": "Pup Cup Available",
  "dog-menu": "Dog Menu",
  "treats-available": "Treats Available",
  "dog-friendly": "Dog Friendly",
  "water-bowls": "Water Bowls",
  "fenced": "Fenced Area",
};

function CollapsibleVenueTags({ venueId }: { venueId: number }) {
  return (
    <CollapsibleSection title="Community Tags">
      <VenueTagList venueId={venueId} />
    </CollapsibleSection>
  );
}

export default function VenueDetailView({ slug, portalSlug, onClose }: VenueDetailViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [spot, setSpot] = useState<SpotData | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [nearbyDestinations, setNearbyDestinations] = useState<NearbyDestinations | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isLowRes, setIsLowRes] = useState(false);
  const [highlights, setHighlights] = useState<VenueHighlight[]>([]);
  const [features, setFeatures] = useState<VenueFeature[]>([]);
  const [specials, setSpecials] = useState<VenueSpecial[]>([]);
  const [attachedChildDestinations, setAttachedChildDestinations] = useState<{id: number; name: string; slug: string | null; image_url: string | null; short_description: string | null}[]>([]);
  const [editorialMentions, setEditorialMentions] = useState<EditorialMention[]>([]);
  const [occasions, setOccasions] = useState<VenueOccasion[]>([]);
  const [walkableNeighbors, setWalkableNeighbors] = useState<WalkableNeighbor[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showOutingSheet, setShowOutingSheet] = useState(false);
  const { portal } = usePortal();

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function fetchSpot() {
      setStatus("loading");
      setError(null);
      setImageLoaded(false);
      setImageError(false);
      setIsLowRes(false);

      const MAX_RETRIES = 2;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, 500 * attempt));
            if (cancelled) return;
          }
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          const res = await fetch(`/api/spots/${slug}`, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (cancelled) return;
          if (!res.ok) {
            if ((res.status === 503 || res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
              continue;
            }
            throw new Error(res.status === 404 ? "Spot not found" : `Failed to load spot (${res.status})`);
          }
          const data = await res.json();
          if (cancelled) return;
          setSpot(data.spot);
          setUpcomingEvents(data.upcomingEvents || []);
          setNearbyDestinations(data.nearbyDestinations || null);
          setHighlights(data.highlights || []);
          setFeatures(
            filterVenueFeaturesForPortal(data.features || [], {
              portalSlug,
              venueSlug: slug,
            })
          );
          setSpecials(data.specials || []);
          setEditorialMentions(data.editorialMentions || []);
          setOccasions(data.occasions || []);
          setAttachedChildDestinations(
            data.attachedChildDestinations || data.artifacts || []
          );
          setStatus("ready");
          return;
        } catch (err) {
          if (controller.signal.aborted) return;
          if (cancelled) return;
          if (attempt === MAX_RETRIES) {
            setError(err instanceof Error ? err.message : "Failed to load spot");
            setStatus("error");
          }
        }
      }
    }

    fetchSpot();
    return () => { cancelled = true; controller.abort(); };
  }, [slug]);

  useEffect(() => {
    if (!spot || !spot.walkable_neighbor_count) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    async function fetchWalkable() {
      try {
        const res = await fetch(`/api/spots/${slug}/walkable`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) return;
        const data = await res.json();
        setWalkableNeighbors(data.neighbors || []);
      } catch {
        if (controller.signal.aborted) return;
      }
    }

    fetchWalkable();
    return () => controller.abort();
  }, [spot?.id, spot?.walkable_neighbor_count, slug]);

  const navigateToDetail = (param: string, value: string | number) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.delete("event");
    params.delete("spot");
    params.delete("series");
    params.delete("festival");
    params.delete("org");
    params.set(param, String(value));
    router.push(`/${portalSlug}?${params.toString()}`, { scroll: false });
  };

  const handleEventClick = (id: number) => navigateToDetail("event", id);
  const handleSpotClick = (spotSlug: string) => navigateToDetail("spot", spotSlug);

  if (status === "loading") {
    return (
      <div className="pt-6 pb-8" role="status" aria-label="Loading venue details">
        <NeonBackButton onClose={onClose} floating={false} />
        <div className="lg:flex lg:gap-0">
          {/* Sidebar skeleton */}
          <div className="lg:w-[340px] lg:flex-shrink-0">
            <Skeleton className="aspect-video lg:aspect-[16/10] w-full rounded-lg" />
            <div className="p-4 space-y-3">
              <Skeleton className="h-7 w-28 rounded-full" delay="0.06s" />
              <Skeleton className="h-7 w-[80%] rounded" delay="0.1s" />
              <Skeleton className="h-5 w-[50%] rounded" delay="0.14s" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-8 w-16 rounded-lg" delay="0.18s" />
                <Skeleton className="h-8 w-16 rounded-lg" delay="0.2s" />
                <Skeleton className="h-8 w-16 rounded-lg" delay="0.22s" />
                <Skeleton className="h-8 w-16 rounded-lg" delay="0.24s" />
              </div>
            </div>
          </div>
          {/* Content skeleton */}
          <div className="flex-1 p-4 lg:p-8 space-y-6">
            <Skeleton className="h-3 w-32 rounded" delay="0.3s" />
            <div className="space-y-2">
              <Skeleton className="h-10 w-full rounded-lg" delay="0.34s" />
              <Skeleton className="h-10 w-full rounded-lg" delay="0.38s" />
              <Skeleton className="h-10 w-full rounded-lg" delay="0.42s" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !spot) {
    return (
      <div className="pt-6" role="alert">
        <NeonBackButton onClose={onClose} floating={false} />
        <div className="text-center py-12">
          <p className="text-[var(--muted)]">{error || "Spot not found"}</p>
        </div>
      </div>
    );
  }

  const primaryType = spot.spot_type as SpotType | null;
  const typeInfo = primaryType ? SPOT_TYPES[primaryType] : null;
  const priceDisplay = formatPriceLevel(spot.price_level);
  const showImage = spot.image_url && !imageError;
  const isDog = isDogPortal(portalSlug);

  const dogHighlightVibes = isDog && spot.vibes
    ? spot.vibes.filter((v) => v in dogVibeLabels)
    : [];

  const hasTransit = spot.nearest_marta_station || spot.beltline_adjacent || (spot.parking_type && spot.parking_type.length > 0) || spot.transit_score;

  // ── SIDEBAR ─────────────────────────────────────────────────────────────
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Hero image — compact */}
      {showImage ? (
        <div className="aspect-video lg:aspect-[16/10] bg-[var(--night)] overflow-hidden relative">
          {!imageLoaded && (
            <Skeleton className="absolute inset-0" />
          )}
          <Image
            src={spot.image_url!}
            alt={spot.name}
            fill
            sizes="(max-width: 1024px) 100vw, 340px"
            className={`${isLowRes ? "object-contain" : "object-cover"} brightness-[0.85] contrast-[1.05] transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={(e) => {
              setImageLoaded(true);
              if (e.currentTarget.naturalWidth < 600) setIsLowRes(true);
            }}
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        <div className="aspect-video lg:aspect-[16/10] bg-gradient-to-b from-[var(--dusk)] to-[var(--night)] flex items-center justify-center">
          <CategoryIcon type={primaryType || ""} size={40} className="opacity-20" />
        </div>
      )}

      {/* Identity */}
      <div className="px-5 pt-4 pb-3 space-y-2">
        {/* Type badge */}
        {typeInfo && (() => {
          const badgeColor = getCategoryColor(primaryType || "");
          const badgeClass = createCssVarClass("--accent-color", badgeColor, "accent");
          return (
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs border bg-accent-15 border-accent-40 ${badgeClass?.className ?? ""}`}>
              <ScopedStyles css={badgeClass?.css} />
              <CategoryIcon type={primaryType || ""} size={12} glow="subtle" />
              <span className="font-mono font-medium uppercase tracking-widest text-accent">
                {spot.spot_types && spot.spot_types.length > 1
                  ? getSpotTypeLabels(spot.spot_types)
                  : typeInfo.label}
              </span>
            </span>
          );
        })()}

        {/* Name */}
        <h2 className="text-xl lg:text-lg font-bold text-[var(--cream)] leading-tight">
          {spot.name}
        </h2>

        {/* Neighborhood + Price + Status */}
        <p className="text-sm text-[var(--soft)] flex items-center gap-1.5 flex-wrap">
          {spot.neighborhood || spot.city}
          {priceDisplay && (
            <><Dot /> <span className="text-[var(--muted)]">{priceDisplay}</span></>
          )}
        </p>
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-[var(--twilight)]/40" />

      {/* Quick Actions */}
      <div className="px-3 py-2 grid grid-cols-4 gap-1">
        {spot.website && (
          <QuickActionLink
            href={spot.website}
            icon={<Globe size={18} weight="light" aria-hidden="true" />}
            label="Website"
            compact
          />
        )}
        {spot.instagram && (
          <QuickActionLink
            href={`https://instagram.com/${spot.instagram.replace("@", "")}`}
            icon={<InstagramLogo size={18} weight="light" aria-hidden="true" />}
            label="Instagram"
            compact
          />
        )}
        {spot.phone && (
          <QuickActionLink
            href={`tel:${spot.phone}`}
            icon={<Phone size={18} weight="light" aria-hidden="true" />}
            label="Call"
            external={false}
            compact
          />
        )}
        {spot.address && (
          <DirectionsDropdown
            venueName={spot.name}
            address={spot.address}
            city={spot.city}
            state={spot.state}
          />
        )}
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-[var(--twilight)]/40" />

      {/* Hours */}
      {(spot.hours || spot.hours_display || spot.is_24_hours) && (
        <div className="px-5 py-3">
          <h3 className="font-mono text-2xs font-bold uppercase tracking-[0.14em] text-[var(--muted)] mb-2">Hours</h3>
          <HoursSection
            hours={spot.hours}
            hoursDisplay={spot.hours_display}
            is24Hours={spot.is_24_hours || false}
          />
        </div>
      )}

      {/* Getting There */}
      {hasTransit && (
        <div className="px-5 py-3">
          <GettingThereSection
            transit={spot}
            variant="compact"
            walkableNeighbors={walkableNeighbors}
            onSpotClick={handleSpotClick}
          />
        </div>
      )}

      {/* Divider */}
      <div className="mx-5 border-t border-[var(--twilight)]/40" />

      {/* Vibes */}
      {spot.vibes && spot.vibes.length > 0 && (
        <div className="px-5 py-3 flex flex-wrap gap-1.5">
          {spot.vibes.slice(0, 4).map((vibe) => (
            <Badge key={vibe} variant="neutral" size="sm">{vibe.replace(/-/g, " ")}</Badge>
          ))}
        </div>
      )}

      {/* Dog-friendly highlights */}
      {isDog && dogHighlightVibes.length > 0 && (
        <div className="px-5 py-2 flex flex-wrap gap-2">
          {dogHighlightVibes.map((vibe) => (
            <Badge key={vibe} variant="alert">
              {vibe === "off-leash" && "🐕"}
              {vibe === "pup-cup" && "🍦"}
              {vibe === "dog-menu" && "🦴"}
              {vibe === "treats-available" && "🍪"}
              {vibe === "dog-friendly" && "🐾"}
              {vibe === "water-bowls" && "💧"}
              {vibe === "fenced" && "🏡"}
              {" "}{dogVibeLabels[vibe]}
            </Badge>
          ))}
        </div>
      )}

      {/* Tag this spot (dog portal only) */}
      {isDog && (
        <div className="px-5 py-2">
          <button
            onClick={() => setShowTagModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-xl text-sm font-semibold transition-colors bg-[var(--coral)]/8 text-[var(--coral)] border border-[var(--coral)]/20 focus-ring"
          >
            <Tag size={16} weight="light" aria-hidden="true" />
            Tag this spot
          </button>
        </div>
      )}

      {/* Spacer (pushes action buttons to bottom on desktop) */}
      <div className="hidden lg:flex flex-1" />

      {/* Action buttons */}
      <div className="px-5 py-3 flex gap-2">
        <div className="flex-1">
          <FollowButton targetVenueId={spot.id} size="sm" className="w-full" />
        </div>
        {spot.lat != null && spot.lng != null && (
          <button
            onClick={() => setShowOutingSheet(true)}
            className="flex-1 inline-flex items-center justify-center gap-2 min-h-[36px] rounded-lg text-sm font-semibold text-[var(--void)] bg-[var(--coral)] hover:brightness-110 transition-all focus-ring"
          >
            <ForkKnife size={16} weight="duotone" />
            Plan Evening
          </button>
        )}
      </div>
    </div>
  );

  // ── CONTENT ZONE ────────────────────────────────────────────────────────
  const contentZone = (
    <div className="px-4 lg:px-8 py-6 space-y-8">
      {/* ── PRIMARY: UPCOMING EVENTS ──────────────────────── */}
      {upcomingEvents.length > 0 && (
        <div>
          <VenueShowtimes
            events={upcomingEvents as ShowtimeEvent[]}
            portalSlug={portalSlug}
            venueType={spot.spot_type}
            title="Upcoming Events"
            onEventClick={handleEventClick}
          />
        </div>
      )}

      {/* ── ABOUT ─────────────────────────────────────────── */}
      {spot.description && (
        <div>
          <SectionHeader title="About" variant="divider" />
          <p className="text-[var(--soft)] whitespace-pre-wrap leading-relaxed">
            <LinkifyText text={spot.description} />
          </p>
        </div>
      )}

      {/* ── WHILE YOU'RE HERE (Highlights) ────────────────── */}
      {highlights.length > 0 && (
        <div>
          <SectionHeader title="While You're Here" variant="divider" />
          <div className="space-y-3">
            {highlights.map((h) => {
              const config = HIGHLIGHT_CONFIG[h.highlight_type];
              const IconComp = config?.Icon;
              const highlightColorClass = createCssVarClass("--highlight-color", config?.color || "#A78BFA", `hl-${h.highlight_type}`);
              return (
                <div key={h.id} className={`flex items-start gap-3 p-3 rounded-lg border border-[var(--twilight)]/40 bg-[var(--dusk)] ${highlightColorClass?.className ?? ""}`}>
                  <ScopedStyles css={highlightColorClass?.css} />
                  {IconComp && (
                    <IconComp
                      size={20}
                      weight="light"
                      className="flex-shrink-0 mt-0.5 icon-neon-subtle text-[var(--highlight-color)]"
                    />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--cream)]">{h.title}</span>
                      <span className="text-2xs font-mono uppercase text-[var(--muted)]">
                        {config?.label}
                      </span>
                    </div>
                    {h.description && (
                      <p className="text-sm text-[var(--soft)] mt-1 leading-relaxed">{h.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FEATURES ──────────────────────────────────────── */}
      <VenueFeaturesSection features={features} venueType={spot.spot_type} />

      {/* ── SPECIALS ──────────────────────────────────────── */}
      <VenueSpecialsSection specials={specials} />

      {/* ── ADVENTURE DESTINATION DETAILS ─────────────────── */}
      {portal?.settings?.vertical === "adventure" && spot.slug && (
        <DestinationDetailSections
          venueSlug={spot.slug}
          portalSlug={portalSlug}
        />
      )}

      {/* ── ARTIFACTS / CHILD DESTINATIONS ────────────────── */}
      {attachedChildDestinations.length > 0 && (
        <div>
          <SectionHeader
            title={ATTACHED_CHILD_DESTINATION_SECTION_TITLE}
            count={attachedChildDestinations.length}
            variant="divider"
          />
          <div className="space-y-2">
            {attachedChildDestinations.map((artifact) => (
              <button
                key={artifact.id}
                onClick={() => artifact.slug && handleSpotClick(artifact.slug)}
                className="block w-full text-left p-3 min-h-[44px] border border-[var(--twilight)]/40 rounded-lg bg-[var(--dusk)] hover:border-[var(--coral)]/50 transition-colors group focus-ring"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors">
                      {artifact.name}
                    </span>
                    {artifact.short_description && (
                      <p className="text-sm text-[var(--soft)] mt-0.5 line-clamp-1">
                        {artifact.short_description}
                      </p>
                    )}
                  </div>
                  <CaretRight size={16} weight="bold" aria-hidden="true" className="text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── SIGNAL: EDITORIAL MENTIONS ─────────────────────── */}
      {editorialMentions.length > 0 && (
        <AccoladesSection mentions={editorialMentions} />
      )}

      {/* ── SIGNAL: PERFECT FOR (Occasions) ───────────────── */}
      {occasions.length > 0 && (
        <div>
          <SectionHeader title="Perfect For" variant="divider" />
          <div className="flex flex-wrap gap-1.5">
            {occasions.map((o) => (
              <span
                key={o.occasion}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20"
              >
                {OCCASION_LABELS[o.occasion] || o.occasion.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── COMMUNITY ─────────────────────────────────────── */}
      <div className="border-t border-[var(--twilight)]/30 pt-5 space-y-3">
        <CollapsibleVenueTags venueId={spot.id} />
        <FlagButton
          entityType="venue"
          entityId={spot.id}
          entityName={spot.name}
        />
      </div>

      {/* ── DISCOVERY: NEARBY ─────────────────────────────── */}
      {nearbyDestinations && (
        <NearbySection
          nearbySpots={nearbyDestinations}
          onSpotClick={handleSpotClick}
        />
      )}

      {/* Dog-Friendly Nearby */}
      {isDog && spot.neighborhood && (
        <DogNearbySection
          neighborhood={spot.neighborhood}
          currentVenueId={spot.id}
          onSpotClick={handleSpotClick}
        />
      )}
    </div>
  );

  // ── TOP BAR ─────────────────────────────────────────────────────────────
  const topBar = (
    <div className="flex items-center px-4 lg:px-6 py-3">
      <NeonBackButton onClose={onClose} floating={false} />
    </div>
  );

  return (
    <>
      <DetailShell
        topBar={topBar}
        sidebar={sidebarContent}
        content={contentZone}
      />

      {/* Modals */}
      {isDog && showTagModal && (
        <DogTagModal
          venueId={spot.id}
          venueName={spot.name}
          venueType={spot.spot_type}
          existingVibes={spot.vibes}
          onClose={() => setShowTagModal(false)}
          onSuccess={(updatedVibes) => {
            setSpot((prev) => prev ? { ...prev, vibes: updatedVibes } : prev);
            setShowTagModal(false);
          }}
        />
      )}

      {showOutingSheet && spot.lat != null && spot.lng != null && (
        <OutingPlannerSheet
          anchor={{
            type: "venue",
            venue: {
              id: spot.id,
              name: spot.name,
              slug: spot.slug,
              lat: spot.lat,
              lng: spot.lng,
            },
          }}
          portalId={portal?.id || ""}
          portalSlug={portalSlug}
          portalVertical={portal?.settings?.vertical}
          isOpen={showOutingSheet}
          onClose={() => setShowOutingSheet(false)}
        />
      )}
    </>
  );
}
