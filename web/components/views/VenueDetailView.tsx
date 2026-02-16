"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "@/components/SmartImage";
import { format, parseISO, isSameDay, isToday, isTomorrow, addDays, startOfDay } from "date-fns";
import { getEffectiveDate } from "@/lib/event-grouping";
import { SPOT_TYPES, formatPriceLevel, getSpotTypeLabels, type SpotType } from "@/lib/spots-constants";
import FollowButton from "@/components/FollowButton";
import RecommendButton from "@/components/RecommendButton";
import VenueTagList from "@/components/VenueTagList";
import FlagButton from "@/components/FlagButton";
import LinkifyText from "@/components/LinkifyText";
import CollapsibleSection, { CategoryIcons, CATEGORY_COLORS } from "@/components/CollapsibleSection";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import { VenueEventCard } from "@/components/VenueEventsByDay";
import HoursSection, { OpenStatusBadge } from "@/components/HoursSection";
import { type HoursData } from "@/lib/hours";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { isDogPortal, classifyDogContentType, DOG_CONTENT_COLORS } from "@/lib/dog-art";
import { HIGHLIGHT_CONFIG, type VenueHighlight } from "@/lib/venue-highlights";
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

// Neon-styled back button matching EventDetailView
const NeonBackButton = ({ onClose }: { onClose: () => void }) => (
  <button
    onClick={onClose}
    className="group flex items-center gap-2 px-3.5 py-2 rounded-full font-mono text-xs font-semibold tracking-wide uppercase transition-all duration-300 hover:scale-105 mb-4 neon-back-btn"
  >
    <svg
      className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-0.5 neon-back-icon"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
    </svg>
    <span
      className="transition-all duration-300 group-hover:text-[var(--coral)] neon-back-text"
    >
      Back
    </span>
  </button>
);

// Venue Events Section with day-by-day date selector
function VenueEventsSection({
  venueName,
  events,
  onEventClick,
}: {
  venueName: string;
  events: UpcomingEvent[];
  onEventClick: (id: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState("");

  // Group events by effective date (ongoing multi-day events show as Today)
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, UpcomingEvent[]>();
    for (const event of events) {
      const dateKey = getEffectiveDate(event.start_date, event.end_date);
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(event);
    }
    // Sort by date
    return new Map(
      [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))
    );
  }, [events]);

  // Get unique dates for the selector
  const availableDates = useMemo(() => {
    return [...eventsByDate.keys()].map((dateStr) => parseISO(dateStr));
  }, [eventsByDate]);

  // Selected date state
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    return availableDates[0] || new Date();
  });

  // Get events for selected date
  const selectedEvents = useMemo(() => {
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return eventsByDate.get(dateKey) || [];
  }, [selectedDate, eventsByDate]);

  // Format date label
  const formatDateLabel = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEE");
  };

  // Handle date picker change
  const handleDatePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDatePickerValue(value);
    if (value) {
      const pickedDate = parseISO(value);
      // Find closest date with events
      const closestDate = availableDates.find(
        (d) => startOfDay(d) >= startOfDay(pickedDate)
      );
      if (closestDate) {
        setSelectedDate(closestDate);
        // Scroll to the selected date
        setTimeout(() => {
          const index = availableDates.findIndex((d) => isSameDay(d, closestDate));
          if (scrollRef.current && index >= 0) {
            const buttons = scrollRef.current.querySelectorAll("button");
            buttons[index]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
          }
        }, 100);
      }
    }
    setShowDatePicker(false);
  };

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="mb-4 relative">
        <h2
          className="font-mono text-lg font-bold uppercase tracking-wider text-coral-strong"
        >
          <span className="text-blur-soft">More at {venueName}</span>
        </h2>
        <div
          className="absolute inset-0 pointer-events-none coral-sweep"
        />
      </div>

      {/* Date Selector */}
      <div className="relative mb-4">
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4"
        >
          {availableDates.map((date) => {
            const isSelected = isSameDay(date, selectedDate);
            const eventsOnDay = eventsByDate.get(format(date, "yyyy-MM-dd"))?.length || 0;

            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-lg border transition-all ${
                  isSelected
                    ? "bg-[var(--coral)]/20 border-[var(--coral)]/50 text-[var(--coral)]"
                    : "bg-[var(--dusk)] border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--coral)]/30"
                }`}
              >
                <span className="font-mono text-[0.65rem] uppercase tracking-wider">
                  {formatDateLabel(date)}
                </span>
                <span className="font-mono text-lg font-bold leading-tight">
                  {format(date, "d")}
                </span>
                <span className="font-mono text-[0.55rem] text-[var(--muted)] uppercase">
                  {format(date, "MMM")}
                </span>
                {eventsOnDay > 1 && (
                  <span className="mt-1 px-1.5 py-0.5 bg-[var(--twilight)] rounded text-[0.5rem] font-mono">
                    {eventsOnDay}
                  </span>
                )}
              </button>
            );
          })}

          {/* Date Picker Button */}
          <div className="flex-shrink-0 relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex flex-col items-center justify-center px-3 py-2 rounded-lg border border-dashed border-[var(--twilight)] text-[var(--muted)] hover:border-[var(--coral)]/50 hover:text-[var(--coral)] transition-all h-full min-h-[72px]"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="font-mono text-[0.5rem] mt-1 uppercase">Jump</span>
            </button>
            {showDatePicker && (
              <input
                type="date"
                value={datePickerValue}
                onChange={handleDatePickerChange}
                min={format(availableDates[0] || new Date(), "yyyy-MM-dd")}
                max={format(
                  availableDates[availableDates.length - 1] ||
                    addDays(new Date(), 90),
                  "yyyy-MM-dd"
                )}
                className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                onBlur={() => setShowDatePicker(false)}
                autoFocus
              />
            )}
          </div>
        </div>
      </div>

      {/* Events for Selected Date */}
      <div className="space-y-2">
        {selectedEvents.length === 0 ? (
          <div className="text-center py-8 text-[var(--muted)] font-mono text-sm">
            No events on this date
          </div>
        ) : (
          selectedEvents.map((event) => (
            <VenueEventCard
              key={event.id}
              event={event}
              onClick={() => onEventClick(event.id)}
              compact={false}
            />
          ))
        )}
      </div>
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
  const [showTagModal, setShowTagModal] = useState(false);

  useEffect(() => {
    async function fetchSpot() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/spots/${slug}`);
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
        setError(err instanceof Error ? err.message : "Failed to load spot");
      } finally {
        setLoading(false);
      }
    }

    fetchSpot();
  }, [slug]);

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
      <div className="pt-6">
        <NeonBackButton onClose={onClose} />
        <div className="space-y-4">
          <div className="aspect-video skeleton-shimmer rounded-xl" />
          <div className="h-48 skeleton-shimmer rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !spot) {
    return (
      <div className="pt-6">
        <NeonBackButton onClose={onClose} />
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

  // Dog-specific vibe highlights
  const dogVibeLabels: Record<string, string> = {
    "off-leash": "Off-Leash Area",
    "pup-cup": "Pup Cup Available",
    "dog-menu": "Dog Menu",
    "treats-available": "Treats Available",
    "dog-friendly": "Dog Friendly",
    "water-bowls": "Water Bowls",
    "fenced": "Fenced Area",
  };
  const dogHighlightVibes = isDog && spot.vibes
    ? spot.vibes.filter((v) => v in dogVibeLabels)
    : [];

  return (
    <div className="pt-6 pb-8">
      {/* Back button */}
      <NeonBackButton onClose={onClose} />

      {/* Spot image */}
      {showImage && (
        <div className="aspect-video bg-[var(--night)] rounded-lg overflow-hidden mb-6 border border-[var(--twilight)] relative">
          {!imageLoaded && (
            <div className="absolute inset-0 skeleton-shimmer" />
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
      <div className="border border-[var(--twilight)] rounded-xl p-6 bg-[var(--dusk)]">
      {/* Type badge */}
      {typeInfo && (() => {
          const badgeColor = getCategoryColor(primaryType || "");
          const badgeClass = createCssVarClass("--accent-color", badgeColor, "accent");
          return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm mb-4 border bg-accent-15 border-accent-40 ${badgeClass?.className ?? ""}`}>
              <ScopedStyles css={badgeClass?.css} />
              <CategoryIcon type={primaryType || ""} size={16} glow="subtle" />
              <span
                className="font-mono text-xs font-medium uppercase tracking-wider text-accent"
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
          <h1 className="text-2xl font-bold text-[var(--cream)] leading-tight">
            {spot.name}
          </h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <FollowButton targetVenueId={spot.id} size="sm" />
            <RecommendButton venueId={spot.id} size="sm" />
          </div>
        </div>

        {/* Neighborhood + Price */}
        <p className="mt-2 text-[var(--soft)] text-lg">
          {spot.neighborhood || spot.city}
          {priceDisplay && (
            <span className="text-[var(--muted)]"> · {priceDisplay}</span>
          )}
        </p>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 mt-4">
          {spot.website && (
            <a
              href={spot.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] rounded-lg text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              Website
            </a>
          )}
          {spot.instagram && (
            <a
              href={`https://instagram.com/${spot.instagram.replace("@", "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] rounded-lg text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              Instagram
            </a>
          )}
          {spot.address && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                `${spot.address}, ${spot.city}, ${spot.state}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] rounded-lg text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Directions
            </a>
          )}
        </div>

        {/* Dog-friendly highlights (dog portal only) */}
        {isDog && dogHighlightVibes.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {dogHighlightVibes.map((vibe) => (
              <span
                key={vibe}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
                style={{
                  background: "rgba(255, 107, 53, 0.1)",
                  color: "#FF6B35",
                  border: "1px solid rgba(255, 107, 53, 0.25)",
                }}
              >
                {vibe === "off-leash" && "🐕"}
                {vibe === "pup-cup" && "🍦"}
                {vibe === "dog-menu" && "🦴"}
                {vibe === "treats-available" && "🍪"}
                {vibe === "dog-friendly" && "🐾"}
                {vibe === "water-bowls" && "💧"}
                {vibe === "fenced" && "🏡"}
                {" "}{dogVibeLabels[vibe]}
              </span>
            ))}
          </div>
        )}

        {/* Tag this spot (dog portal only) */}
        {isDog && (
          <button
            onClick={() => setShowTagModal(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={{
              background: "rgba(255, 107, 53, 0.08)",
              color: "#FF6B35",
              border: "1px solid rgba(255, 107, 53, 0.2)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
            Tag this spot
          </button>
        )}

        {/* Hours */}
        {(spot.hours || spot.hours_display || spot.is_24_hours) && (
          <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
            <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
              Hours
            </h2>
            <HoursSection
              hours={spot.hours}
              hoursDisplay={spot.hours_display}
              is24Hours={spot.is_24_hours || false}
            />
          </div>
        )}

        {/* Description */}
        {spot.description && (
          <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
            <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
              About
            </h2>
            <p className="text-[var(--soft)] whitespace-pre-wrap leading-relaxed">
              <LinkifyText text={spot.description} />
            </p>
          </div>
        )}

        {/* While You're Here — venue highlights */}
        {highlights.length > 0 && (
          <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
            <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
              While You&apos;re Here
            </h2>
            <div className="space-y-3">
              {highlights.map((h) => {
                const config = HIGHLIGHT_CONFIG[h.highlight_type];
                const IconComp = config?.Icon;
                return (
                  <div key={h.id} className="flex items-start gap-3 p-3 rounded-lg border border-[var(--twilight)] bg-[var(--dusk)]">
                    {IconComp && (
                      <IconComp
                        size={20}
                        weight="light"
                        className="flex-shrink-0 mt-0.5 icon-neon-subtle"
                        style={{ color: config.color }}
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--cream)]">{h.title}</span>
                        <span className="text-[0.6rem] font-mono uppercase text-[var(--muted)]">
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
          <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
            <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
              Artifacts
            </h2>
            <div className="space-y-2">
              {artifacts.map((artifact) => (
                <button
                  key={artifact.id}
                  onClick={() => artifact.slug && handleSpotClick(artifact.slug)}
                  className="block w-full text-left p-3 border border-[var(--twilight)] rounded-lg bg-[var(--dusk)] hover:border-[var(--coral)]/50 transition-colors group"
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
                    <svg className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Vibes */}
        {spot.vibes && spot.vibes.length > 0 && (
          <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
            <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
              Vibes
            </h2>
            <div className="flex flex-wrap gap-2">
              {spot.vibes.map((vibe) => (
                <span
                  key={vibe}
                  className="px-3 py-1.5 bg-[var(--coral)]/10 text-[var(--coral)] rounded-full border border-[var(--coral)]/20 text-sm font-mono"
                >
                  {vibe.replace(/-/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Community Tags */}
        <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
          <VenueTagList venueId={spot.id} />
        </div>

        {/* Location */}
        {spot.address && (
          <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
            <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
              Location
            </h2>
            <p className="text-[var(--soft)]">
              {spot.address}
              <br />
              {spot.city}, {spot.state}
            </p>
          </div>
        )}

        {/* Flag */}
        <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
          <FlagButton
            entityType="venue"
            entityId={spot.id}
            entityName={spot.name}
          />
        </div>
      </div>

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
        (() => {
          const totalDestinations = Object.values(nearbyDestinations).flat().length;
          if (totalDestinations === 0) return null;

          const categories = [
            { key: "food" as const, label: "Food" },
            { key: "drinks" as const, label: "Drinks" },
            { key: "nightlife" as const, label: "Nightlife" },
            { key: "caffeine" as const, label: "Caffeine" },
            { key: "fun" as const, label: "Fun" },
          ];

          return (
            <div className="mt-8">
              {/* Neon header */}
              <div className="mb-6 relative">
                <h2
                  className="font-mono text-lg font-bold uppercase tracking-wider text-coral-strong"
                >
                  <span className="text-blur-soft">Happening Around Here</span>
                </h2>
                <div
                  className="absolute inset-0 pointer-events-none coral-sweep"
                />
              </div>

              <div className="space-y-3">
                {categories.map(({ key, label }) => {
                  const items = nearbyDestinations[key];
                  if (!items || items.length === 0) return null;

                  return (
                    <CollapsibleSection
                      key={key}
                      title={label}
                      count={items.length}
                      icon={CategoryIcons[key]}
                      accentColor={CATEGORY_COLORS[key]}
                      defaultOpen={false}
                    >
                      <div className="space-y-2">
                        {items.map((dest) => (
                          <button
                            key={dest.id}
                            onClick={() => handleSpotClick(dest.slug)}
                            className="block w-full text-left p-3 border border-[var(--twilight)] rounded-lg bg-[var(--dusk)] hover:border-[var(--coral)]/50 transition-colors group"
                          >
                            <div className="flex items-start gap-3">
                              {/* Thumbnail */}
                              {dest.image_url && (
                                <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--twilight)]">
                                  <Image
                                    src={dest.image_url}
                                    alt={dest.name}
                                    width={56}
                                    height={56}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-[var(--cream)] font-medium truncate group-hover:text-[var(--coral)] transition-colors">
                                    {dest.name}
                                  </h4>
                                  {(dest.hours || dest.is_24_hours) && (
                                    <OpenStatusBadge
                                      hours={dest.hours || null}
                                      is24Hours={dest.is_24_hours || false}
                                    />
                                  )}
                                </div>
                                {dest.short_description && (
                                  <p className="text-xs text-[var(--soft)] mt-0.5 line-clamp-1">
                                    {dest.short_description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  {dest.distance !== undefined && (
                                    <span className="text-[0.65rem] text-[var(--muted)] font-mono">
                                      {dest.distance < 0.1 ? "Nearby" : `${dest.distance.toFixed(1)} mi`}
                                    </span>
                                  )}
                                  {dest.vibes && dest.vibes.length > 0 && (
                                    <span className="text-[0.65rem] text-[var(--soft)]">
                                      {dest.vibes.slice(0, 2).map(v => v.replace(/-/g, " ")).join(" · ")}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <svg className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </button>
                        ))}
                      </div>
                    </CollapsibleSection>
                  );
                })}
              </div>
            </div>
          );
        })()
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

// Dog-friendly nearby spots section (only rendered in dog portal)
function DogNearbySection({
  neighborhood,
  currentVenueId,
  onSpotClick,
}: {
  neighborhood: string;
  currentVenueId: number;
  onSpotClick: (slug: string) => void;
}) {
  const [spots, setSpots] = useState<
    { id: number; name: string; slug: string; venue_type: string | null; vibes: string[] | null; short_description: string | null }[]
  >([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function fetchNearby() {
      try {
        const params = new URLSearchParams({
          neighborhood,
          vibes: "dog-friendly",
        });
        const res = await fetch(`/api/spots?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        const filtered = (data.spots || [])
          .filter((s: { id: number }) => s.id !== currentVenueId)
          .slice(0, 6);
        setSpots(filtered);
      } catch {
        // Silently fail — this is an enhancement
      } finally {
        setLoaded(true);
      }
    }
    fetchNearby();
  }, [neighborhood, currentVenueId]);

  if (!loaded || spots.length === 0) return null;

  return (
    <div className="mt-8">
      <h2
        className="text-lg font-bold mb-4"
        style={{ color: "var(--cream, #292524)" }}
      >
        Dog-Friendly Nearby
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {spots.map((s) => {
          const contentType = classifyDogContentType(s.venue_type, s.vibes, null, false);
          const color = DOG_CONTENT_COLORS[contentType];
          return (
            <button
              key={s.id}
              onClick={() => onSpotClick(s.slug)}
              className="flex items-start gap-3 p-3 rounded-xl border transition-colors text-left group"
              style={{
                background: "var(--dusk, #fff)",
                borderColor: "var(--twilight, #FDE68A)",
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
                style={{ background: `${color}20` }}
              >
                {contentType === "parks" && "🌳"}
                {contentType === "food" && "🍽️"}
                {contentType === "services" && "🦴"}
                {contentType === "trails" && "🥾"}
                {contentType === "adoption" && "❤️"}
                {contentType === "events" && "🐾"}
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  className="font-semibold text-sm truncate transition-colors"
                  style={{ color: "var(--cream, #292524)" }}
                >
                  {s.name}
                </h3>
                {s.short_description && (
                  <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--muted, #78716C)" }}>
                    {s.short_description}
                  </p>
                )}
                {s.vibes && s.vibes.some((v) => v === "off-leash" || v === "pup-cup") && (
                  <div className="flex gap-1.5 mt-1">
                    {s.vibes.includes("off-leash") && (
                      <span className="text-[0.6rem] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${DOG_CONTENT_COLORS.parks}20`, color: DOG_CONTENT_COLORS.parks }}>
                        Off-Leash
                      </span>
                    )}
                    {s.vibes.includes("pup-cup") && (
                      <span className="text-[0.6rem] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${DOG_CONTENT_COLORS.food}20`, color: DOG_CONTENT_COLORS.food }}>
                        Pup Cup
                      </span>
                    )}
                  </div>
                )}
              </div>
              <svg className="w-4 h-4 flex-shrink-0 mt-1 transition-colors" style={{ color: "var(--muted, #78716C)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
