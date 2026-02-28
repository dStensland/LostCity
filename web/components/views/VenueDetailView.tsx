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
import DirectionsDropdown from "@/components/DirectionsDropdown";
import GettingThereSection, { type WalkableNeighbor } from "@/components/GettingThereSection";
import {
  CaretDown,
  CaretRight,
  Globe,
  InstagramLogo,
  Phone,
  Tag,
} from "@phosphor-icons/react";
import { InfoCard } from "@/components/detail/InfoCard";
import { SectionHeader } from "@/components/detail/SectionHeader";
import NeonBackButton from "@/components/detail/NeonBackButton";
import Badge from "@/components/ui/Badge";
import Dot from "@/components/ui/Dot";
import VenueEventsSection from "@/components/detail/VenueEventsSection";
import DogNearbySection from "@/components/detail/DogNearbySection";
import dynamic from "next/dynamic";

const DogTagModal = dynamic(
  () => import("@/app/[portal]/_components/dog/DogTagModal"),
  { ssr: false }
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
  // Transit fields
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

// Collapsible community tags — lazy-mounts VenueTagList to save API calls
function CollapsibleVenueTags({ venueId }: { venueId: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between group min-h-[44px] focus-ring"
      >
        <h2 className="font-mono text-xs font-medium text-[var(--muted)] uppercase tracking-widest group-hover:text-[var(--soft)] transition-colors">
          Community Tags
        </h2>
        <CaretDown
          size={16}
          weight="bold"
          className={`text-[var(--muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div className="mt-3">
          <VenueTagList venueId={venueId} />
        </div>
      )}
    </div>
  );
}

export default function VenueDetailView({ slug, portalSlug, onClose }: VenueDetailViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [spot, setSpot] = useState<SpotData | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [nearbyDestinations, setNearbyDestinations] = useState<NearbyDestinations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isLowRes, setIsLowRes] = useState(false);
  const [highlights, setHighlights] = useState<VenueHighlight[]>([]);
  const [artifacts, setArtifacts] = useState<{id: number; name: string; slug: string | null; image_url: string | null; short_description: string | null}[]>([]);
  const [walkableNeighbors, setWalkableNeighbors] = useState<WalkableNeighbor[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    async function fetchSpot() {
      setLoading(true);
      setError(null);
      setImageLoaded(false);
      setImageError(false);
      setIsLowRes(false);

      try {
        const res = await fetch(`/api/spots/${slug}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) {
          throw new Error("Spot not found");
        }
        const data = await res.json();
        setSpot(data.spot);
        setUpcomingEvents(data.upcomingEvents || []);
        setNearbyDestinations(data.nearbyDestinations || null);
        setHighlights(data.highlights || []);
        setArtifacts(data.artifacts || []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load spot");
      } finally {
        setLoading(false);
      }
    }

    fetchSpot();
    return () => controller.abort();
  }, [slug]);

  // Fetch walkable neighbors when spot is loaded
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

  if (loading) {
    return (
      <div className="pt-6 pb-8" role="status" aria-label="Loading venue details">
        <NeonBackButton onClose={onClose} floating={false} />

        {/* Hero image skeleton */}
        <div className="aspect-video bg-[var(--night)] rounded-lg overflow-hidden mb-6 border border-[var(--twilight)] relative">
          <Skeleton className="absolute inset-0" />
        </div>

        {/* Info card skeleton */}
        <InfoCard>
          {/* Type badge */}
          <Skeleton className="h-7 w-28 rounded-full mb-4" delay="0.06s" />

          {/* Name + follow/recommend */}
          <div className="flex items-start justify-between gap-4">
            <Skeleton className="h-7 w-[60%] rounded" delay="0.1s" />
            <div className="flex gap-2 flex-shrink-0">
              <Skeleton className="w-9 h-9 rounded-lg" delay="0.14s" />
              <Skeleton className="w-9 h-9 rounded-lg" delay="0.16s" />
            </div>
          </div>

          {/* Neighborhood + price */}
          <Skeleton className="h-5 w-[35%] rounded mt-2" delay="0.18s" />

          {/* Vibe pills */}
          <div className="flex gap-2 mt-3">
            <Skeleton className="h-6 w-16 rounded-full" delay="0.22s" />
            <Skeleton className="h-6 w-20 rounded-full" delay="0.24s" />
            <Skeleton className="h-6 w-14 rounded-full" delay="0.26s" />
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Skeleton className="h-8 w-24 rounded-lg" delay="0.3s" />
            <Skeleton className="h-8 w-28 rounded-lg" delay="0.32s" />
            <Skeleton className="h-8 w-24 rounded-lg" delay="0.34s" />
          </div>

          {/* Hours section */}
          <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
            <Skeleton className="h-3 w-12 rounded mb-3" delay="0.4s" />
            <Skeleton className="h-4 w-[50%] rounded" delay="0.44s" />
            <Skeleton className="h-4 w-[45%] rounded mt-1.5" delay="0.46s" />
          </div>

          {/* Description section */}
          <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
            <Skeleton className="h-3 w-14 rounded mb-3" delay="0.5s" />
            <Skeleton className="h-4 w-full rounded" delay="0.54s" />
            <Skeleton className="h-4 w-[90%] rounded mt-1.5" delay="0.56s" />
            <Skeleton className="h-4 w-[75%] rounded mt-1.5" delay="0.58s" />
          </div>
        </InfoCard>
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

  return (
    <div className="pt-6 pb-8">
      {/* Back button */}
      <NeonBackButton onClose={onClose} floating={false} />

      {/* Spot image */}
      {showImage && (
        <div className="aspect-video bg-[var(--night)] rounded-lg overflow-hidden mb-6 border border-[var(--twilight)] relative">
          {!imageLoaded && (
            <Skeleton className="absolute inset-0" />
          )}
          <Image
            src={spot.image_url!}
            alt={spot.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className={`${isLowRes ? "object-contain" : "object-cover"} transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={(e) => {
              setImageLoaded(true);
              if (e.currentTarget.naturalWidth < 600) setIsLowRes(true);
            }}
            onError={() => setImageError(true)}
          />
        </div>
      )}

      {/* Main spot info card */}
      <InfoCard>
      {/* Type badge */}
      {typeInfo && (() => {
          const badgeColor = getCategoryColor(primaryType || "");
          const badgeClass = createCssVarClass("--accent-color", badgeColor, "accent");
          return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm mb-4 border bg-accent-15 border-accent-40 ${badgeClass?.className ?? ""}`}>
              <ScopedStyles css={badgeClass?.css} />
              <CategoryIcon type={primaryType || ""} size={16} glow="subtle" />
              <span
                className="font-mono text-xs font-medium uppercase tracking-widest text-accent"
              >
                {spot.spot_types && spot.spot_types.length > 1
                  ? getSpotTypeLabels(spot.spot_types)
                  : typeInfo.label}
              </span>
            </span>
          );
        })()}

        {/* Name + Follow/Recommend */}
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-2xl font-bold text-[var(--cream)] leading-tight">
            {spot.name}
          </h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            <FollowButton targetVenueId={spot.id} size="sm" />
            <RecommendButton venueId={spot.id} size="sm" />
          </div>
        </div>

        {/* Neighborhood + Price */}
        <p className="mt-2 text-[var(--soft)] text-lg">
          {spot.neighborhood || spot.city}
          {priceDisplay && (
            <span className="text-[var(--muted)]"> <Dot /> {priceDisplay}</span>
          )}
        </p>

        {/* Top vibes — instant characterization */}
        {spot.vibes && spot.vibes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {spot.vibes.slice(0, 3).map((vibe) => (
              <Badge key={vibe} variant="alert" size="md">{vibe.replace(/-/g, " ")}</Badge>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 mt-4">
          {spot.website && (
            <a
              href={spot.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] rounded-lg text-sm transition-colors focus-ring"
            >
              <Globe size={16} weight="light" aria-hidden="true" />
              Website
            </a>
          )}
          {spot.instagram && (
            <a
              href={`https://instagram.com/${spot.instagram.replace("@", "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] rounded-lg text-sm transition-colors focus-ring"
            >
              <InstagramLogo size={16} weight="light" aria-hidden="true" />
              Instagram
            </a>
          )}
          {spot.phone && (
            <a
              href={`tel:${spot.phone}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] rounded-lg text-sm transition-colors focus-ring"
            >
              <Phone size={16} weight="light" aria-hidden="true" />
              Call
            </a>
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

        {/* Dog-friendly highlights (dog portal only) */}
        {isDog && dogHighlightVibes.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
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
          <button
            onClick={() => setShowTagModal(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-xl text-sm font-semibold transition-colors bg-[var(--coral)]/8 text-[var(--coral)] border border-[var(--coral)]/20 focus-ring"
          >
            <Tag size={16} weight="light" aria-hidden="true" />
            Tag this spot
          </button>
        )}

        {/* Hours */}
        {(spot.hours || spot.hours_display || spot.is_24_hours) && (
          <div className="mt-6">
            <SectionHeader title="Hours" />
            <HoursSection
              hours={spot.hours}
              hoursDisplay={spot.hours_display}
              is24Hours={spot.is_24_hours || false}
            />
          </div>
        )}

        {/* Description */}
        {spot.description && (
          <div className="mt-6">
            <SectionHeader title="About" />
            <p className="text-[var(--soft)] whitespace-pre-wrap leading-relaxed">
              <LinkifyText text={spot.description} />
            </p>
          </div>
        )}

        {/* While You're Here — venue highlights */}
        {highlights.length > 0 && (
          <div className="mt-6">
            <SectionHeader title="While You're Here" />
            <div className="space-y-3">
              {highlights.map((h) => {
                const config = HIGHLIGHT_CONFIG[h.highlight_type];
                const IconComp = config?.Icon;
                const highlightColorClass = createCssVarClass("--highlight-color", config?.color || "#A78BFA", `hl-${h.highlight_type}`);
                return (
                  <div key={h.id} className={`flex items-start gap-3 p-3 rounded-lg border border-[var(--twilight)] bg-[var(--dusk)] ${highlightColorClass?.className ?? ""}`}>
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
                        <span className="text-xs font-mono uppercase text-[var(--muted)]">
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

        {/* Artifacts housed at this venue */}
        {artifacts.length > 0 && (
          <div className="mt-6">
            <SectionHeader title="Artifacts" count={artifacts.length} />
            <div className="space-y-2">
              {artifacts.map((artifact) => (
                <button
                  key={artifact.id}
                  onClick={() => artifact.slug && handleSpotClick(artifact.slug)}
                  className="block w-full text-left p-3 min-h-[44px] border border-[var(--twilight)] rounded-lg bg-[var(--dusk)] hover:border-[var(--coral)]/50 transition-colors group focus-ring"
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

        {/* Vibes */}
        {spot.vibes && spot.vibes.length > 0 && (
          <div className="mt-6">
            <SectionHeader title="Vibes" count={spot.vibes.length} />
            <div className="flex flex-wrap gap-2">
              {spot.vibes.map((vibe) => (
                <Badge key={vibe} variant="alert">{vibe.replace(/-/g, " ")}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Community Tags — collapsed by default to save API calls */}
        <div className="mt-6 border-t border-[var(--twilight)] py-4">
          <CollapsibleVenueTags venueId={spot.id} />
        </div>

        {/* Getting There — transit, parking, walkable neighbors */}
        {(spot.nearest_marta_station || spot.beltline_adjacent || (spot.parking_type && spot.parking_type.length > 0) || spot.transit_score) && (
          <div className="mt-6 border-t border-[var(--twilight)] pt-4">
            <GettingThereSection
              transit={spot}
              variant="expanded"
              walkableNeighbors={walkableNeighbors}
              onSpotClick={handleSpotClick}
            />
          </div>
        )}

        {/* Location */}
        {spot.address && (
          <div className="mt-6">
            <div className="flex items-center justify-between py-4 border-t border-[var(--twilight)]">
              <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
                Location
              </h2>
              <DirectionsDropdown
                venueName={spot.name}
                address={spot.address}
                city={spot.city}
                state={spot.state}
              />
            </div>
            <p className="text-[var(--soft)]">
              {spot.address}
              <br />
              {spot.city}, {spot.state}
            </p>
          </div>
        )}

        {/* Flag */}
        <div className="mt-6 border-t border-[var(--twilight)] pt-4">
          <FlagButton
            entityType="venue"
            entityId={spot.id}
            entityName={spot.name}
          />
        </div>
      </InfoCard>

      {/* More at Venue - Day by day events */}
      {upcomingEvents.length > 0 && (
        <VenueEventsSection
          venueName={spot.name}
          events={upcomingEvents}
          onEventClick={handleEventClick}
        />
      )}

      {/* Happening Around Here */}
      {nearbyDestinations && (
        <NearbySection
          nearbySpots={nearbyDestinations}
          onSpotClick={handleSpotClick}
        />
      )}

      {/* Dog-Friendly Nearby (dog portal only) */}
      {isDog && spot.neighborhood && (
        <DogNearbySection
          neighborhood={spot.neighborhood}
          currentVenueId={spot.id}
          onSpotClick={handleSpotClick}
        />
      )}

      {/* Dog Tag Modal */}
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
    </div>
  );
}
