"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import CategoryIcon from "@/components/CategoryIcon";
import CategoryPlaceholder from "@/components/CategoryPlaceholder";
import FollowButton from "@/components/FollowButton";
import FriendsGoing from "@/components/FriendsGoing";
import WhosGoing from "@/components/WhosGoing";
import DirectionsDropdown from "@/components/DirectionsDropdown";
import EventQuickActions from "@/components/EventQuickActions";
import VenueVibes from "@/components/VenueVibes";
import LinkifyText from "@/components/LinkifyText";
import { formatTimeSplit } from "@/lib/formats";
import VenueTagList from "@/components/VenueTagList";
import FlagButton from "@/components/FlagButton";
import { getSpotTypeLabel } from "@/lib/spots";
import { getSeriesTypeLabel, getSeriesTypeColor } from "@/lib/series-utils";

type EventData = {
  id: number;
  title: string;
  description: string | null;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  end_date: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  category: string | null;
  subcategory: string | null;
  tags: string[] | null;
  ticket_url: string | null;
  source_url: string | null;
  image_url: string | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  is_live?: boolean;
  venue: {
    id: number;
    name: string;
    slug: string;
    address: string | null;
    neighborhood: string | null;
    city: string;
    state: string;
    vibes: string[] | null;
  } | null;
  producer: {
    id: string;
    name: string;
    slug: string;
    org_type: string;
    website: string | null;
    logo_url: string | null;
  } | null;
  series: {
    id: string;
    title: string;
    slug: string;
    series_type: string;
  } | null;
};

type RelatedEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  venue: { id: number; name: string; slug: string } | null;
};

type NearbySpot = {
  id: number;
  name: string;
  slug: string;
  spot_type: string | null;
  neighborhood: string | null;
};

interface EventDetailViewProps {
  eventId: number;
  portalSlug: string;
  onClose: () => void;
}

function parseRecurrenceRule(rule: string | null | undefined): string | null {
  if (!rule) return null;
  const match = rule.match(/FREQ=(\w+)(?:;BYDAY=(\w+))?/i);
  if (!match) return null;

  const freq = match[1]?.toUpperCase();
  const day = match[2];

  const dayNames: Record<string, string> = {
    MO: "Monday", TU: "Tuesday", WE: "Wednesday",
    TH: "Thursday", FR: "Friday", SA: "Saturday", SU: "Sunday"
  };

  if (freq === "WEEKLY" && day && dayNames[day]) {
    return `Every ${dayNames[day]}`;
  }
  if (freq === "WEEKLY") return "Weekly";
  if (freq === "MONTHLY") return "Monthly";
  if (freq === "DAILY") return "Daily";

  return null;
}

// Spot type categories for "In the area" tabs
const FOOD_TYPES = ["restaurant", "food_hall", "cooking_school"];
const DRINKS_TYPES = ["bar", "brewery", "distillery", "winery", "rooftop", "sports_bar", "coffee_shop"];
const FUN_TYPES = ["club", "games", "eatertainment", "music_venue", "comedy_club", "theater", "cinema", "attraction", "gallery", "museum", "arcade"];

type InAreaTab = "events" | "food" | "drinks" | "fun";

export default function EventDetailView({ eventId, portalSlug, onClose }: EventDetailViewProps) {
  const router = useRouter();
  const [event, setEvent] = useState<EventData | null>(null);
  const [venueEvents, setVenueEvents] = useState<RelatedEvent[]>([]);
  const [sameDateEvents, setSameDateEvents] = useState<RelatedEvent[]>([]);
  const [nearbySpots, setNearbySpots] = useState<NearbySpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [inAreaTab, setInAreaTab] = useState<InAreaTab>("events");

  useEffect(() => {
    async function fetchEvent() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/events/${eventId}`);
        if (!res.ok) {
          throw new Error("Event not found");
        }
        const data = await res.json();
        setEvent(data.event);
        setVenueEvents(data.venueEvents || []);
        setSameDateEvents(data.sameDateEvents || []);
        setNearbySpots(data.nearbySpots || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load event");
      } finally {
        setLoading(false);
      }
    }

    fetchEvent();
  }, [eventId]);

  // Handle navigation to other events/spots within the view
  const handleEventClick = (id: number) => {
    router.push(`/${portalSlug}?event=${id}`, { scroll: false });
  };

  const handleSpotClick = (slug: string) => {
    router.push(`/${portalSlug}?spot=${slug}`, { scroll: false });
  };

  const handleSeriesClick = (slug: string) => {
    router.push(`/${portalSlug}?series=${slug}`, { scroll: false });
  };

  if (loading) {
    return (
      <div className="animate-fadeIn">
        {/* Back button */}
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-[var(--muted)] hover:text-[var(--cream)] transition-colors mb-4 font-mono text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Loading skeleton */}
        <div className="space-y-4">
          <div className="aspect-[2/1] skeleton-shimmer rounded-xl" />
          <div className="h-24 skeleton-shimmer rounded-xl" />
          <div className="h-48 skeleton-shimmer rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="animate-fadeIn">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-[var(--muted)] hover:text-[var(--cream)] transition-colors mb-4 font-mono text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="text-center py-12">
          <p className="text-[var(--muted)]">{error || "Event not found"}</p>
        </div>
      </div>
    );
  }

  const isLive = event.is_live || false;
  const recurrenceText = parseRecurrenceRule(event.recurrence_rule);
  const showImage = event.image_url && !imageError;

  return (
    <div className="animate-fadeIn pb-8">
      {/* Back button */}
      <button
        onClick={onClose}
        className="flex items-center gap-2 text-[var(--muted)] hover:text-[var(--cream)] transition-colors mb-4 font-mono text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Hero Image */}
      <div
        className={`relative aspect-[2/1] bg-[var(--night)] rounded-xl overflow-hidden mb-4 ${
          isLive ? "ring-2 ring-[var(--coral)] ring-opacity-50" : ""
        }`}
      >
        {showImage ? (
          <>
            {!imageLoaded && (
              <div className="absolute inset-0 skeleton-shimmer" />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.image_url!}
              alt={event.title}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          </>
        ) : (
          <CategoryPlaceholder category={event.category || "other"} size="lg" />
        )}

        {/* Live badge */}
        {isLive && (
          <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-[var(--coral)] text-[var(--void)] rounded-full font-mono text-xs font-medium">
            <span className="w-2 h-2 bg-[var(--void)] rounded-full animate-pulse" />
            LIVE NOW
          </div>
        )}

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h1 className="text-xl sm:text-2xl font-bold text-white drop-shadow-lg">
            {event.title}
          </h1>
          {event.venue && (
            <p className="text-sm text-white/80 mt-1">
              <button
                onClick={() => handleSpotClick(event.venue!.slug)}
                className="hover:text-white hover:underline transition-colors"
              >
                {event.venue.name}
              </button>
              {event.venue.neighborhood && ` · ${event.venue.neighborhood}`}
            </p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <EventQuickActions event={event} isLive={isLive} className="mb-6" />

      {/* Recurring Event Badge */}
      {event.is_recurring && recurrenceText && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-[var(--twilight)] mb-6 bg-[var(--dusk)]">
          <div className="w-10 h-10 rounded-full bg-[var(--twilight)] flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div>
            <p className="text-[var(--cream)] font-medium">This event repeats {recurrenceText.toLowerCase()}</p>
            <p className="text-sm text-[var(--muted)]">View all dates in the series</p>
          </div>
        </div>
      )}

      {/* Main event info card */}
      <div className="border border-[var(--twilight)] rounded-xl p-5 sm:p-6 bg-[var(--dusk)]">
        {/* Description */}
        {event.description && (
          <div className="mb-5">
            <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
              About
            </h2>
            <p className="text-[var(--soft)] whitespace-pre-wrap leading-relaxed">
              <LinkifyText text={event.description} />
            </p>
          </div>
        )}

        {/* Location */}
        {event.venue && event.venue.address && (
          <div className={`mb-5 ${event.description ? "pt-5 border-t border-[var(--twilight)]" : ""}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest">
                Location
              </h2>
              <DirectionsDropdown
                venueName={event.venue.name}
                address={event.venue.address}
                city={event.venue.city}
                state={event.venue.state}
              />
            </div>
            <button
              onClick={() => handleSpotClick(event.venue!.slug)}
              className="block w-full text-left p-3 rounded-lg border border-[var(--twilight)] transition-colors hover:border-[var(--coral)]/50 group bg-[var(--void)]"
            >
              <p className="text-[var(--soft)]">
                <span className="text-[var(--cream)] font-medium group-hover:text-[var(--coral)] transition-colors">
                  {event.venue.name}
                </span>
                <svg className="inline-block w-4 h-4 ml-1 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <br />
                <span className="text-sm text-[var(--muted)]">
                  {event.venue.address} · {event.venue.city}, {event.venue.state}
                </span>
              </p>
              {event.venue.vibes && event.venue.vibes.length > 0 && (
                <VenueVibes vibes={event.venue.vibes} className="mt-2" />
              )}
            </button>

            {/* Community Tags */}
            <div className="mt-3">
              <VenueTagList venueId={event.venue.id} />
            </div>
          </div>
        )}

        {/* Social proof */}
        <div className="pt-5 border-t border-[var(--twilight)]">
          <FriendsGoing eventId={event.id} className="mb-4" />
          <WhosGoing eventId={event.id} />
        </div>

        {/* Series link */}
        {event.series && (
          <div className="pt-5 border-t border-[var(--twilight)]">
            <button
              onClick={() => handleSeriesClick(event.series!.slug)}
              className="flex items-center gap-3 w-full p-3 rounded-lg border border-[var(--twilight)] transition-colors hover:border-[var(--coral)]/50 group bg-[var(--void)] text-left"
            >
              <svg
                className="w-5 h-5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: getSeriesTypeColor(event.series.series_type) }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-[var(--soft)] group-hover:text-[var(--coral)] transition-colors">
                  Part of <span className="text-[var(--cream)] font-medium">{event.series.title}</span>
                </span>
                <span
                  className="ml-2 text-[0.6rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: `${getSeriesTypeColor(event.series.series_type)}20`,
                    color: getSeriesTypeColor(event.series.series_type),
                  }}
                >
                  {getSeriesTypeLabel(event.series.series_type)}
                </span>
              </div>
              <svg className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Producer */}
        {event.producer && (
          <div className="pt-5 border-t border-[var(--twilight)]">
            <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
              Presented by
            </h2>
            <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-[var(--twilight)] bg-[var(--void)]">
              <div className="flex items-center gap-3 min-w-0">
                {event.producer.logo_url ? (
                  <Image
                    src={event.producer.logo_url}
                    alt={event.producer.name}
                    width={40}
                    height={40}
                    className="rounded-lg object-cover flex-shrink-0"
                    unoptimized
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[var(--twilight)] flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-[var(--cream)] font-medium truncate text-sm">
                    {event.producer.name}
                  </h3>
                  <p className="text-[0.65rem] text-[var(--muted)] font-mono uppercase tracking-wider">
                    {event.producer.org_type.replace(/_/g, " ")}
                  </p>
                </div>
              </div>
              <FollowButton targetProducerId={event.producer.id} size="sm" />
            </div>
          </div>
        )}

        {/* Tags */}
        {event.tags && event.tags.length > 0 && (
          <div className="pt-5 border-t border-[var(--twilight)]">
            <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
              Also Featuring
            </h2>
            <div className="flex flex-wrap gap-2">
              {event.tags.map((tag) => {
                // Seasonal/special tags get accent colors
                const isValentines = tag.toLowerCase().includes("valentine") || tag.toLowerCase().includes("love");
                const isHoliday = tag.toLowerCase().includes("holiday") || tag.toLowerCase().includes("christmas") || tag.toLowerCase().includes("new year");
                const isSummer = tag.toLowerCase().includes("summer") || tag.toLowerCase().includes("beach") || tag.toLowerCase().includes("outdoor");
                const isSpooky = tag.toLowerCase().includes("halloween") || tag.toLowerCase().includes("spooky") || tag.toLowerCase().includes("horror");
                const isPride = tag.toLowerCase().includes("pride") || tag.toLowerCase().includes("lgbtq");

                let tagColor = "var(--soft)";
                let tagBg = "var(--void)";
                let tagBorder = "var(--twilight)";

                if (isValentines) {
                  tagColor = "var(--rose)";
                  tagBg = "rgba(255, 107, 122, 0.1)";
                  tagBorder = "rgba(255, 107, 122, 0.3)";
                } else if (isHoliday) {
                  tagColor = "var(--neon-green)";
                  tagBg = "rgba(34, 197, 94, 0.1)";
                  tagBorder = "rgba(34, 197, 94, 0.3)";
                } else if (isSummer) {
                  tagColor = "var(--neon-amber)";
                  tagBg = "rgba(245, 158, 11, 0.1)";
                  tagBorder = "rgba(245, 158, 11, 0.3)";
                } else if (isSpooky) {
                  tagColor = "var(--neon-purple)";
                  tagBg = "rgba(168, 85, 247, 0.1)";
                  tagBorder = "rgba(168, 85, 247, 0.3)";
                } else if (isPride) {
                  tagColor = "var(--neon-magenta)";
                  tagBg = "rgba(236, 72, 153, 0.1)";
                  tagBorder = "rgba(236, 72, 153, 0.3)";
                }

                return (
                  <span
                    key={tag}
                    className="px-3 py-1.5 rounded-full text-xs font-mono"
                    style={{
                      color: tagColor,
                      backgroundColor: tagBg,
                      border: `1px solid ${tagBorder}`,
                    }}
                  >
                    {tag}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Flag */}
        <div className="pt-5 border-t border-[var(--twilight)]">
          <FlagButton
            entityType="event"
            entityId={event.id}
            entityName={event.title}
          />
        </div>
      </div>

      {/* Related Events */}
      {(venueEvents.length > 0 || sameDateEvents.length > 0) && (
        <div className="mt-8 space-y-8">
          {venueEvents.length > 0 && event.venue && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest">
                  More at {event.venue.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-[var(--coral)]/20 text-[var(--coral)] text-[0.6rem] font-mono">
                  {venueEvents.length} upcoming
                </span>
              </div>
              <div className="border border-[var(--twilight)] rounded-xl overflow-hidden bg-[var(--dusk)]">
                {venueEvents.map((relatedEvent, index) => (
                  <button
                    key={relatedEvent.id}
                    onClick={() => handleEventClick(relatedEvent.id)}
                    className={`block w-full p-4 transition-colors group hover:bg-[var(--twilight)]/50 text-left ${
                      index !== venueEvents.length - 1 ? "border-b border-[var(--twilight)]" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[var(--cream)] font-medium truncate group-hover:text-[var(--coral)] transition-colors">
                          {relatedEvent.title}
                        </h3>
                        <p className="text-sm text-[var(--muted)] mt-1">
                          {format(parseISO(relatedEvent.start_date), "EEE, MMM d")}
                          {relatedEvent.start_time && ` · ${formatTimeSplit(relatedEvent.start_time).time} ${formatTimeSplit(relatedEvent.start_time).period}`}
                        </p>
                      </div>
                      <span className="text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* In the area - tabbed section for same-night events and nearby spots by category */}
          {(sameDateEvents.length > 0 || nearbySpots.length > 0) && (
            <div>
              <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
                In the area
              </h2>

              {/* Tab selector */}
              <div className="flex gap-1 p-1 bg-[var(--night)] rounded-lg mb-4 overflow-x-auto">
                {[
                  { key: "events" as InAreaTab, label: "Events", count: sameDateEvents.length },
                  { key: "food" as InAreaTab, label: "Food", count: nearbySpots.filter(s => FOOD_TYPES.includes(s.spot_type || "")).length },
                  { key: "drinks" as InAreaTab, label: "Drinks", count: nearbySpots.filter(s => DRINKS_TYPES.includes(s.spot_type || "")).length },
                  { key: "fun" as InAreaTab, label: "Fun", count: nearbySpots.filter(s => FUN_TYPES.includes(s.spot_type || "")).length },
                ].filter(tab => tab.count > 0).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setInAreaTab(tab.key)}
                    className={`flex-1 min-w-[70px] px-3 py-2 rounded-md font-mono text-xs whitespace-nowrap transition-all ${
                      inAreaTab === tab.key
                        ? "bg-[var(--coral)] text-[var(--void)] font-medium"
                        : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50"
                    }`}
                  >
                    {tab.label}
                    <span className={`ml-1.5 ${inAreaTab === tab.key ? "text-[var(--void)]/70" : "text-[var(--muted)]"}`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {inAreaTab === "events" && sameDateEvents.length > 0 && (
                <div className="space-y-2">
                  {sameDateEvents.map((relatedEvent) => (
                    <button
                      key={relatedEvent.id}
                      onClick={() => handleEventClick(relatedEvent.id)}
                      className="block w-full p-4 border border-[var(--twilight)] rounded-lg transition-colors group hover:border-[var(--coral)]/50 bg-[var(--dusk)] text-left"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[var(--cream)] font-medium truncate group-hover:text-[var(--coral)] transition-colors">
                            {relatedEvent.title}
                          </h3>
                          <p className="text-sm text-[var(--muted)] mt-1">
                            {relatedEvent.venue?.name || "Venue TBA"}
                            {relatedEvent.start_time && ` · ${formatTimeSplit(relatedEvent.start_time).time} ${formatTimeSplit(relatedEvent.start_time).period}`}
                          </p>
                        </div>
                        <span className="text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {inAreaTab === "food" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {nearbySpots.filter(s => FOOD_TYPES.includes(s.spot_type || "")).map((spot) => (
                    <button
                      key={spot.id}
                      onClick={() => handleSpotClick(spot.slug)}
                      className="group p-3 border border-[var(--twilight)] rounded-lg transition-colors hover:border-[var(--coral)]/50 bg-[var(--dusk)] text-left"
                    >
                      <div className="flex items-start gap-2">
                        <CategoryIcon
                          type={spot.spot_type || "restaurant"}
                          size={16}
                          className="mt-0.5 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[var(--cream)] text-sm font-medium truncate group-hover:text-[var(--coral)] transition-colors">
                            {spot.name}
                          </h3>
                          <p className="text-[0.65rem] text-[var(--muted)] font-mono uppercase tracking-wider mt-0.5">
                            {getSpotTypeLabel(spot.spot_type)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {inAreaTab === "drinks" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {nearbySpots.filter(s => DRINKS_TYPES.includes(s.spot_type || "")).map((spot) => (
                    <button
                      key={spot.id}
                      onClick={() => handleSpotClick(spot.slug)}
                      className="group p-3 border border-[var(--twilight)] rounded-lg transition-colors hover:border-[var(--coral)]/50 bg-[var(--dusk)] text-left"
                    >
                      <div className="flex items-start gap-2">
                        <CategoryIcon
                          type={spot.spot_type || "bar"}
                          size={16}
                          className="mt-0.5 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[var(--cream)] text-sm font-medium truncate group-hover:text-[var(--coral)] transition-colors">
                            {spot.name}
                          </h3>
                          <p className="text-[0.65rem] text-[var(--muted)] font-mono uppercase tracking-wider mt-0.5">
                            {getSpotTypeLabel(spot.spot_type)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {inAreaTab === "fun" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {nearbySpots.filter(s => FUN_TYPES.includes(s.spot_type || "")).map((spot) => (
                    <button
                      key={spot.id}
                      onClick={() => handleSpotClick(spot.slug)}
                      className="group p-3 border border-[var(--twilight)] rounded-lg transition-colors hover:border-[var(--coral)]/50 bg-[var(--dusk)] text-left"
                    >
                      <div className="flex items-start gap-2">
                        <CategoryIcon
                          type={spot.spot_type || "attraction"}
                          size={16}
                          className="mt-0.5 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[var(--cream)] text-sm font-medium truncate group-hover:text-[var(--coral)] transition-colors">
                            {spot.name}
                          </h3>
                          <p className="text-[0.65rem] text-[var(--muted)] font-mono uppercase tracking-wider mt-0.5">
                            {getSpotTypeLabel(spot.spot_type)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
