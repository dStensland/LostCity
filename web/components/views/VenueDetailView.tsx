"use client";

import React, { useState, useMemo, useEffect } from "react";
import { SPOT_TYPES, formatPriceLevel, getSpotTypeLabels, type SpotType } from "@/lib/spots-constants";
import FollowButton from "@/components/FollowButton";
import VenueTagList from "@/components/VenueTagList";
import LinkifyText from "@/components/LinkifyText";
import Skeleton from "@/components/Skeleton";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import NearbySection from "@/components/NearbySection";
import HoursSection from "@/components/HoursSection";
import { type HoursData } from "@/lib/hours";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { isDogPortal } from "@/lib/dog-art";
import { AccoladesSection, type EditorialMention } from "@/components/detail/AccoladesSection";
import DirectionsDropdown from "@/components/DirectionsDropdown";
import GettingThereSection, { type WalkableNeighbor } from "@/components/GettingThereSection";
import { usePortal } from "@/lib/portal-context";
import { ATTACHED_CHILD_DESTINATION_SECTION_TITLE } from "@/lib/destination-graph";
import {
  CaretRight,
  Clock,
  Globe,
  House,
  InstagramLogo,
  Phone,
  Tag,
  Ticket,
  ArrowCounterClockwise,
  ArrowLeft,
  ShareNetwork,
} from "@phosphor-icons/react";
import SmartImage from "@/components/SmartImage";
import { formatDateRange } from "@/lib/types/exhibitions";
import { SectionHeader } from "@/components/detail/SectionHeader";
import { QuickActionLink } from "@/components/detail/QuickActionLink";
import { CollapsibleSection } from "@/components/detail/CollapsibleSection";
import NeonBackButton from "@/components/detail/NeonBackButton";
import DetailShell from "@/components/detail/DetailShell";
import DetailHeroImage from "@/components/detail/DetailHeroImage";
import { DetailStickyBar } from "@/components/detail/DetailStickyBar";
import Badge from "@/components/ui/Badge";
import Dot from "@/components/ui/Dot";
import SaveButton from "@/components/SaveButton";
import VenueShowtimes, { type ShowtimeEvent } from "@/components/VenueShowtimes";
import DogNearbySection from "@/components/detail/DogNearbySection";
import { DestinationDetailSections } from "@/components/adventure/DestinationDetailSections";
import { LibraryPassCallout, type LibraryPassData } from "@/components/family/LibraryPassCallout";
import { useDetailFetch } from "@/lib/hooks/useDetailFetch";
import { useDetailNavigation } from "@/lib/hooks/useDetailNavigation";
import { isFeatureHeavyType, type VenueFeature } from "@/lib/venue-features";
import { type VenueSpecial } from "@/lib/specials-utils";
import VenueFeaturesSection from "@/components/detail/VenueFeaturesSection";
import VenueSpecialsSection from "@/components/detail/VenueSpecialsSection";
import dynamic from "next/dynamic";

const DogTagModal = dynamic(
  () => import("@/app/[portal]/_components/dog/DogTagModal"),
  { ssr: false }
);
const HangButton = dynamic(
  () => import("@/components/hangs/HangButton").then((m) => ({ default: m.HangButton })),
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
  library_pass: LibraryPassData | null;
  typical_price_min: number | null;
  typical_price_max: number | null;
  typical_duration_minutes: number | null;
  indoor_outdoor: string | null;
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

type VenueExhibition = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  opening_date: string | null;
  closing_date: string | null;
  exhibition_type: string | null;
  admission_type: string | null;
  source_url: string | null;
};

export type SpotApiResponse = {
  spot: SpotData;
  upcomingEvents: UpcomingEvent[];
  exhibitions: VenueExhibition[];
  nearbyDestinations: NearbyDestinations | null;
  highlights: unknown[];
  features: unknown[];
  specials: unknown[];
  editorialMentions: EditorialMention[];
  occasions: VenueOccasion[];
  attachedChildDestinations: { id: number; name: string; slug: string | null; image_url: string | null; short_description: string | null }[];
  artifacts?: { id: number; name: string; slug: string | null; image_url: string | null; short_description: string | null }[];
  walkableNeighbors: WalkableNeighbor[];
};

interface VenueDetailViewProps {
  slug: string;
  portalSlug: string;
  onClose: () => void;
  /** Server-fetched data — skips client fetch when provided */
  initialData?: SpotApiResponse;
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
  // Only render the section if the venue has at least one community tag.
  // Fetching just the count avoids showing the "Community Tags" header on
  // venues with no tags, which was always the case for 99% of venues.
  const [hasTags, setHasTags] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/venues/${venueId}/tags`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!cancelled) {
          setHasTags(Array.isArray(data?.tags) && data.tags.length > 0);
        }
      })
      .catch(() => {
        if (!cancelled) setHasTags(false);
      });
    return () => { cancelled = true; };
  }, [venueId]);

  // Don't render anything while loading or when no tags exist
  if (!hasTags) return null;

  return (
    <CollapsibleSection title="Community Tags">
      <VenueTagList venueId={venueId} />
    </CollapsibleSection>
  );
}

export default function VenueDetailView({ slug, portalSlug, onClose, initialData }: VenueDetailViewProps) {
  const { portal } = usePortal();
  const { toEvent: handleEventClick, toSpot: handleSpotClick } = useDetailNavigation(portalSlug);

  const { data: fetchedData, status, error, retry } = useDetailFetch<SpotApiResponse>(
    initialData ? null : `/api/spots/${slug}`,
    { entityLabel: "spot" }
  );
  const data = initialData ?? fetchedData;

  const [vibesOverride, setVibesOverride] = useState<string[] | null>(null);
  const [showTagModal, setShowTagModal] = useState(false);

  // Derive all data slices from fetch response
  const spot = data?.spot ?? null;
  const upcomingEvents = useMemo(() => data?.upcomingEvents ?? [], [data]);
  const nearbyDestinations = useMemo(() => data?.nearbyDestinations ?? null, [data]);
  const editorialMentions = useMemo(() => data?.editorialMentions ?? [], [data]);
  const occasions = useMemo(() => data?.occasions ?? [], [data]);
  const attachedChildDestinations = useMemo(
    () => data?.attachedChildDestinations ?? data?.artifacts ?? [],
    [data]
  );
  const exhibitions = useMemo(() => data?.exhibitions ?? [], [data]);
  const walkableNeighbors = useMemo(() => data?.walkableNeighbors ?? [], [data]);
  const vibes = vibesOverride ?? spot?.vibes ?? null;

  const isDog = isDogPortal(portalSlug);

  // ── ALL useMemo hooks must live here — before any early return ────────
  // Step 3: Separate true exhibitions (have closing_date) from programs
  const trueExhibitions = useMemo(
    () => exhibitions.filter((ex) => ex.closing_date != null),
    [exhibitions]
  );

  // ── LOADING SKELETON ─────────────────────────────────────────────────
  if (status === "loading") {
    const skeletonTopBar = (
      <div className="flex items-center px-4 lg:px-6 py-3">
        <NeonBackButton onClose={onClose} floating={false} />
      </div>
    );
    const skeletonSidebar = (
      <div role="status" aria-label="Loading venue details">
        <Skeleton className="aspect-video lg:aspect-[16/10] w-full" />
        <div className="px-5 pt-4 pb-3 space-y-2">
          <Skeleton className="h-5 w-28 rounded-full" delay="0.06s" />
          <Skeleton className="h-7 w-[80%] rounded" delay="0.1s" />
          <Skeleton className="h-4 w-[50%] rounded" delay="0.14s" />
        </div>
        <div className="mx-5 border-t border-[var(--twilight)]/40" />
        <div className="px-3 py-2 grid grid-cols-4 gap-1">
          <Skeleton className="h-10 rounded-lg" delay="0.18s" />
          <Skeleton className="h-10 rounded-lg" delay="0.2s" />
          <Skeleton className="h-10 rounded-lg" delay="0.22s" />
          <Skeleton className="h-10 rounded-lg" delay="0.24s" />
        </div>
        <div className="mx-5 border-t border-[var(--twilight)]/40" />
        <div className="px-5 py-3 space-y-2">
          <Skeleton className="h-3 w-12 rounded" delay="0.26s" />
          <Skeleton className="h-4 w-[70%] rounded" delay="0.28s" />
          <Skeleton className="h-4 w-[60%] rounded" delay="0.3s" />
        </div>
      </div>
    );
    const skeletonContent = (
      <div className="p-4 lg:p-8 space-y-6">
        <Skeleton className="h-3 w-32 rounded" delay="0.3s" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-lg" delay="0.34s" />
          <Skeleton className="h-10 w-full rounded-lg" delay="0.38s" />
          <Skeleton className="h-10 w-full rounded-lg" delay="0.42s" />
        </div>
      </div>
    );
    return (
      <DetailShell
        topBar={skeletonTopBar}
        sidebar={skeletonSidebar}
        content={skeletonContent}
      />
    );
  }

  // ── ERROR STATE ──────────────────────────────────────────────────────
  if (error || !spot) {
    return (
      <DetailShell
        onClose={onClose}
        singleColumn
        content={
          <div className="flex flex-col items-center justify-center py-20 px-4" role="alert">
            <p className="text-[var(--soft)] mb-6">{error || "Spot not found"}</p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--twilight)] text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--dusk)] transition-colors font-mono text-sm focus-ring"
              >
                <ArrowLeft size={16} weight="bold" />
                Go Back
              </button>
              <button
                onClick={retry}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:brightness-110 transition-all focus-ring"
              >
                <ArrowCounterClockwise size={16} weight="bold" />
                Try Again
              </button>
            </div>
          </div>
        }
      />
    );
  }

  const primaryType = spot.spot_type as SpotType | null;
  const typeInfo = primaryType ? SPOT_TYPES[primaryType] : null;
  const priceDisplay = formatPriceLevel(spot.price_level);

  const dogHighlightVibes = isDog && vibes
    ? vibes.filter((v) => v in dogVibeLabels)
    : [];

  const hasTransit = spot.nearest_marta_station || spot.beltline_adjacent || (spot.parking_type && spot.parking_type.length > 0) || spot.transit_score;

  // ── SIDEBAR ─────────────────────────────────────────────────────────────
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Hero image — compact */}
      <DetailHeroImage
        imageUrl={spot.image_url}
        alt={spot.name}
        category={primaryType}
        priority
      />

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
        <h1 className="text-xl lg:text-2xl font-bold text-[var(--cream)] leading-tight">
          {spot.name}
        </h1>

        {/* Neighborhood + Price + Status */}
        <p className="text-sm text-[var(--soft)] flex items-center gap-1.5 flex-wrap">
          {spot.neighborhood || spot.city}
          {priceDisplay && (
            <><Dot /> <span className="text-[var(--muted)]">{priceDisplay}</span></>
          )}
          {spot.typical_price_min != null && (
            <><Dot /> <span className="text-[var(--muted)]">
              ${spot.typical_price_min}{spot.typical_price_max && spot.typical_price_max !== spot.typical_price_min ? `\u2013${spot.typical_price_max}` : ""}
            </span></>
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
            icon={<Globe size={16} weight="light" aria-hidden="true" />}
            label="Website"
            compact
          />
        )}
        {spot.instagram && (
          <QuickActionLink
            href={`https://instagram.com/${spot.instagram.replace("@", "")}`}
            icon={<InstagramLogo size={16} weight="light" aria-hidden="true" />}
            label="Instagram"
            compact
          />
        )}
        {spot.phone && (
          <QuickActionLink
            href={`tel:${spot.phone}`}
            icon={<Phone size={16} weight="light" aria-hidden="true" />}
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
            compact
          />
        )}
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-[var(--twilight)]/40" />

      {/* Hours */}
      {(spot.hours || spot.hours_display || spot.is_24_hours) && (
        <div className="px-5 py-3">
          <h3 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)] mb-2">Hours</h3>
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
      {vibes && vibes.length > 0 && (
        <div className="px-5 py-3 flex flex-wrap gap-1.5">
          {vibes.slice(0, 4).map((vibe) => (
            <Badge key={vibe} variant="neutral" size="sm">{vibe.replace(/-/g, " ")}</Badge>
          ))}
          {vibes.length > 4 && (
            <Badge variant="neutral" size="sm">+{vibes.length - 4}</Badge>
          )}
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
        <FollowButton targetVenueId={spot.id} size="sm" rounded="xl" className="flex-1" />
        <HangButton
          venue={{
            id: spot.id,
            name: spot.name,
            slug: spot.slug,
            image_url: spot.image_url,
            neighborhood: spot.neighborhood,
          }}
          rounded="xl"
          className="flex-1 min-h-[36px]"
        />
      </div>
    </div>
  );

  // ── CONTENT ZONE ────────────────────────────────────────────────────────

  // Cast typed data from API response
  const typedFeatures = (data?.features ?? []) as unknown as VenueFeature[];
  const typedSpecials = (data?.specials ?? []) as unknown as VenueSpecial[];
  const typedHighlights = (data?.highlights ?? []) as unknown as { id: number; highlight_type: string; title: string; description: string | null; image_url: string | null }[];

  // Step 9: Filter nonsensical occasions for museum-type venues
  const MUSEUM_EXCLUDED_OCCASIONS = new Set(["brunch", "late_night", "quick_bite", "dancing", "pre_game"]);
  const isMuseumType = ["museum", "gallery", "historic_site", "garden"].includes(spot.spot_type || "");
  const filteredOccasions = isMuseumType
    ? occasions.filter((o) => !MUSEUM_EXCLUDED_OCCASIONS.has(o.occasion))
    : occasions;

  // Step 7: Use reordered layout for feature-heavy venue types
  const useFeatureLayout = isFeatureHeavyType(spot.spot_type);

  // Step 4: Plan Your Visit — only render if there's visit planning data
  const hasVisitPlanningData = spot.typical_price_min != null || spot.typical_duration_minutes != null || spot.indoor_outdoor || typedSpecials.length > 0 || spot.library_pass?.eligible;

  const HIGHLIGHT_TYPE_LABELS: Record<string, string> = {
    viewpoint: "Viewpoint",
    architecture: "Architecture",
    photo_spot: "Photo Spot",
    signature: "Signature",
    hidden_gem: "Hidden Gem",
  };

  const INDOOR_OUTDOOR_LABELS: Record<string, string> = {
    indoor: "Indoor",
    outdoor: "Outdoor",
    both: "Indoor & Outdoor",
  };

  // ── Exhibition cards renderer ───────────────────────────────────────────
  const renderExhibitions = (exList: VenueExhibition[]) => (
    <div>
      <SectionHeader title="On View" count={exList.length} variant="divider" />
      <div className="space-y-3 mt-3">
        {exList.map((ex) => {
          const daysLeft = ex.closing_date
            ? Math.ceil((new Date(ex.closing_date + "T00:00:00").getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null;
          return (
            <a
              key={ex.id}
              href={ex.source_url || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex gap-3 p-3 rounded-xl border border-[var(--twilight)]/40 hover:border-[var(--soft)]/30 transition-colors find-row-card-bg"
            >
              {ex.image_url && (
                <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                  <SmartImage src={ex.image_url} alt="" fill className="object-cover" sizes="80px" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-[var(--cream)] leading-snug line-clamp-2 group-hover:opacity-80 transition-opacity">
                  {ex.title}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-mono text-xs text-[var(--soft)]">
                    {formatDateRange(ex.opening_date, ex.closing_date)}
                  </p>
                  {ex.admission_type && ex.admission_type !== "included" && (
                    <Badge variant="accent" accentColor="var(--gold)" size="sm">
                      {ex.admission_type === "free" ? "Free" : ex.admission_type === "ticketed" ? "Ticketed" : ex.admission_type.replace(/_/g, " ")}
                    </Badge>
                  )}
                </div>
                {daysLeft !== null && daysLeft > 0 && daysLeft <= 30 && (
                  <span className={`inline-block mt-1.5 px-2 py-0.5 font-mono text-2xs font-bold uppercase tracking-wider rounded ${daysLeft <= 7 ? "bg-[var(--coral)]/15 text-[var(--coral)]" : "bg-[var(--gold)]/15 text-[var(--gold)]"}`}>
                    {daysLeft <= 1 ? "Last day" : `${daysLeft}d left`}
                  </span>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );

  // ── Plan Your Visit section ────────────────────────────────────────────
  const renderPlanYourVisit = () => {
    if (!hasVisitPlanningData) return null;
    return (
      <div>
        <SectionHeader title="Plan Your Visit" variant="divider" />
        <div className="mt-3 rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)] overflow-hidden">
          {/* Metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-[var(--twilight)]/20">
            {spot.typical_price_min != null && (
              <div className="bg-[var(--night)] p-4 flex items-start gap-3">
                <Ticket size={18} weight="light" className="text-[var(--soft)] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)]">Admission</p>
                  <p className="text-sm font-medium text-[var(--cream)] mt-0.5">
                    ${spot.typical_price_min}{spot.typical_price_max && spot.typical_price_max !== spot.typical_price_min ? `\u2013$${spot.typical_price_max}` : ""}
                  </p>
                </div>
              </div>
            )}
            {spot.typical_duration_minutes != null && (
              <div className="bg-[var(--night)] p-4 flex items-start gap-3">
                <Clock size={18} weight="light" className="text-[var(--soft)] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)]">Duration</p>
                  <p className="text-sm font-medium text-[var(--cream)] mt-0.5">
                    {spot.typical_duration_minutes >= 60
                      ? `About ${Math.round(spot.typical_duration_minutes / 60)} hr${Math.round(spot.typical_duration_minutes / 60) > 1 ? "s" : ""}`
                      : `${spot.typical_duration_minutes} min`}
                  </p>
                </div>
              </div>
            )}
            {spot.indoor_outdoor && (
              <div className="bg-[var(--night)] p-4 flex items-start gap-3">
                <House size={18} weight="light" className="text-[var(--soft)] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)]">Setting</p>
                  <p className="text-sm font-medium text-[var(--cream)] mt-0.5">
                    {INDOOR_OUTDOOR_LABELS[spot.indoor_outdoor] || spot.indoor_outdoor}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Specials inside plan your visit */}
          {typedSpecials.length > 0 && (
            <div className="border-t border-[var(--twilight)]/40">
              <VenueSpecialsSection specials={typedSpecials} />
            </div>
          )}

          {/* Library pass */}
          {spot.library_pass?.eligible && (
            <div className="border-t border-[var(--twilight)]/40 p-4">
              <LibraryPassCallout libraryPass={spot.library_pass} />
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Highlights renderer ────────────────────────────────────────────────
  const renderHighlights = () => {
    if (typedHighlights.length === 0) return null;
    return (
      <div>
        <SectionHeader title="Don't Miss" variant="divider" />
        <div className="space-y-3 mt-3">
          {typedHighlights.map((h) => (
            <div
              key={h.id}
              className="flex items-start gap-3 p-4 rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)] border-l-2 border-l-[var(--gold)]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-[var(--cream)] leading-snug">
                    {h.title}
                  </h4>
                  <Badge variant="accent" accentColor="var(--gold)" size="sm">
                    {HIGHLIGHT_TYPE_LABELS[h.highlight_type] || h.highlight_type.replace(/_/g, " ")}
                  </Badge>
                </div>
                {h.description && (
                  <p className="text-sm text-[var(--soft)] mt-1.5 leading-relaxed">
                    {h.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── About + Community Tags ──────────────────────────────────────────────
  const renderAbout = () => (
    <div>
      {spot.description && (
        <>
          <SectionHeader title="About" variant="divider" />
          <p className="text-[var(--soft)] whitespace-pre-wrap leading-relaxed">
            <LinkifyText text={spot.description} />
          </p>
        </>
      )}
      <div className={spot.description ? "mt-4" : ""}>
        <CollapsibleVenueTags venueId={spot.id} />
      </div>
    </div>
  );

  // ── Occasions tags ──────────────────────────────────────────────────────
  const renderOccasions = () => {
    if (filteredOccasions.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {filteredOccasions.map((o) => (
          <Badge key={o.occasion} variant="accent" accentColor="var(--gold)" size="sm">
            {OCCASION_LABELS[o.occasion] || o.occasion.replace(/_/g, " ")}
          </Badge>
        ))}
      </div>
    );
  };

  // ── Upcoming Events ─────────────────────────────────────────────────────
  const renderUpcomingEvents = () => {
    if (upcomingEvents.length === 0) return null;
    return (
      <div>
        <VenueShowtimes
          events={upcomingEvents as ShowtimeEvent[]}
          portalSlug={portalSlug}
          venueType={spot.spot_type}
          title="Upcoming Events"
          onEventClick={handleEventClick}
          bare
        />
      </div>
    );
  };

  // ── Child destinations ──────────────────────────────────────────────────
  const renderChildDestinations = () => {
    if (attachedChildDestinations.length === 0) return null;
    return (
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
              className="block w-full text-left p-3 min-h-[44px] border border-[var(--twilight)]/40 rounded-lg bg-[var(--night)] hover:border-[var(--coral)]/50 transition-colors group focus-ring"
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
    );
  };

  const contentZone = (
    <div className="px-4 lg:px-8 py-4 space-y-8">
      {useFeatureLayout ? (
        <>
          {/* ── Feature-heavy layout (museums, galleries, parks, historic sites) ── */}
          {/* 1. On View (exhibitions) */}
          {trueExhibitions.length > 0 && renderExhibitions(trueExhibitions)}

          {/* 2. Plan Your Visit */}
          {renderPlanYourVisit()}

          {/* 3. Upcoming Events */}
          {renderUpcomingEvents()}

          {/* 4. What's Here (features) */}
          {typedFeatures.length > 0 && (
            <VenueFeaturesSection features={typedFeatures} venueType={spot.spot_type} />
          )}

          {/* 5. Don't Miss (highlights) */}
          {renderHighlights()}

          {/* 6. About + Community Tags */}
          {renderAbout()}

          {/* 7. Occasions */}
          {renderOccasions()}

          {/* 8. In the Press */}
          {editorialMentions.length > 0 && (
            <AccoladesSection mentions={editorialMentions} />
          )}

          {/* 9. Child Destinations */}
          {renderChildDestinations()}

          {/* 10. Nearby */}
          {nearbyDestinations && (
            <NearbySection nearbySpots={nearbyDestinations} onSpotClick={handleSpotClick} />
          )}
        </>
      ) : (
        <>
          {/* ── Standard layout (bars, restaurants, venues, etc.) ── */}
          {/* 1. Occasions */}
          {renderOccasions()}

          {/* 2. About + Community Tags */}
          {renderAbout()}

          {/* 3. On View (exhibitions) */}
          {exhibitions.length > 0 && renderExhibitions(exhibitions)}

          {/* 4. Upcoming Events */}
          {renderUpcomingEvents()}

          {/* 5. Plan Your Visit (specials, library pass, etc.) */}
          {renderPlanYourVisit()}

          {/* 6. What's Here (features) */}
          {typedFeatures.length > 0 && (
            <VenueFeaturesSection features={typedFeatures} venueType={spot.spot_type} />
          )}

          {/* 7. Don't Miss (highlights) */}
          {renderHighlights()}

          {/* 8. Adventure Destination Details */}
          {portal?.settings?.vertical === "adventure" && spot.slug && (
            <DestinationDetailSections venueSlug={spot.slug} portalSlug={portalSlug} />
          )}

          {/* 9. Child Destinations */}
          {renderChildDestinations()}

          {/* 10. In the Press */}
          {editorialMentions.length > 0 && (
            <AccoladesSection mentions={editorialMentions} />
          )}

          {/* 11. Nearby */}
          {nearbyDestinations && (
            <NearbySection nearbySpots={nearbyDestinations} onSpotClick={handleSpotClick} />
          )}
        </>
      )}

      {/* Dog-Friendly Nearby (both layouts) */}
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
    <div className="flex items-center justify-between px-4 lg:px-6 py-3">
      <div className="[&>button]:mb-0">
        <NeonBackButton onClose={onClose} floating={false} />
      </div>
      <div className="flex items-center gap-1">
        <SaveButton venueId={spot.id} size="sm" />
        <button
          onClick={async () => {
            const url = window.location.href;
            try {
              if (navigator.share) {
                await navigator.share({ title: spot.name, url });
              } else {
                await navigator.clipboard.writeText(url);
              }
            } catch (e) {
              if ((e as Error).name !== "AbortError") {
                try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
              }
            }
          }}
          className="inline-flex items-center justify-center min-w-[48px] min-h-[48px] p-3 text-[var(--soft)] rounded-lg hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-all active:scale-95 focus-ring"
          aria-label="Share"
        >
          <ShareNetwork size={20} weight="light" className="icon-drop-shadow" />
        </button>
      </div>
    </div>
  );

  // ── BOTTOM BAR (mobile only) ────────────────────────────────────────────
  const bottomBar = (
    <DetailStickyBar
      className="lg:hidden"
      primaryAction={spot.website ? {
        label: "Visit Website",
        href: spot.website,
        icon: <Globe size={18} weight="bold" />,
      } : undefined}
      secondaryActions={
        <FollowButton targetVenueId={spot.id} size="sm" />
      }
    />
  );

  return (
    <>
      <DetailShell
        topBar={topBar}
        sidebar={sidebarContent}
        content={contentZone}
        bottomBar={bottomBar}
      />

      {/* Modals */}
      {isDog && showTagModal && (
        <DogTagModal
          venueId={spot.id}
          venueName={spot.name}
          venueType={spot.spot_type}
          existingVibes={vibes}
          onClose={() => setShowTagModal(false)}
          onSuccess={(updatedVibes) => {
            setVibesOverride(updatedVibes);
            setShowTagModal(false);
          }}
        />
      )}

    </>
  );
}
