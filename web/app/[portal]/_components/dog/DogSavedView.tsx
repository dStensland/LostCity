"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { getLocalDateString, formatTime } from "@/lib/formats";
import { getProxiedImageSrc } from "@/lib/image-proxy";
import { classifyDogContentType, DOG_CONTENT_COLORS } from "@/lib/dog-art";
import DogEmptyState from "./DogEmptyState";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SavedEvent = {
  id: number;
  created_at: string;
  event: {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    is_all_day: boolean;
    is_free: boolean;
    category: string | null;
    image_url: string | null;
    tags: string[] | null;
    venue: {
      id: number;
      name: string;
      neighborhood: string | null;
      slug: string;
    } | null;
  } | null;
};

type SavedVenue = {
  id: number;
  created_at: string;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    venue_type: string | null;
    vibes: string[] | null;
    image_url: string | null;
    short_description: string | null;
  } | null;
};

type Tab = "events" | "places";

const QUERY_TIMEOUT = 8000;

function formatSavedDate(
  startDate: string,
  startTime: string | null,
  isAllDay: boolean
): string {
  const d = new Date(startDate + "T00:00:00");
  const day = d.toLocaleDateString("en-US", { weekday: "short" });
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const date = d.getDate();
  const timeStr = !isAllDay && startTime ? ` \u00b7 ${formatTime(startTime)}` : "";
  return `${day}, ${month} ${date}${timeStr}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DogSavedView({ portalSlug }: { portalSlug: string }) {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("events");
  const [savedEvents, setSavedEvents] = useState<SavedEvent[]>([]);
  const [savedVenues, setSavedVenues] = useState<SavedVenue[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSaved = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const supabase = createClient();
    const today = getLocalDateString();

    try {
      const [eventsResult, venuesResult] = await Promise.all([
        Promise.race([
          supabase
            .from("saved_items")
            .select(`
              id, created_at,
              event:events!inner (
                id, title, start_date, start_time, is_all_day, is_free,
                category, image_url, tags,
                venue:venues (id, name, neighborhood, slug)
              )
            `)
            .eq("user_id", user.id)
            .not("event_id", "is", null)
            .gte("event.start_date", today)
            .order("created_at", { ascending: false }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), QUERY_TIMEOUT)
          ),
        ]),
        Promise.race([
          supabase
            .from("saved_items")
            .select(`
              id, created_at,
              venue:venues!inner (
                id, name, slug, neighborhood, venue_type, vibes,
                image_url, short_description
              )
            `)
            .eq("user_id", user.id)
            .not("venue_id", "is", null)
            .order("created_at", { ascending: false }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), QUERY_TIMEOUT)
          ),
        ]),
      ]);

      if (!eventsResult.error) {
        setSavedEvents((eventsResult.data || []) as unknown as SavedEvent[]);
      }
      if (!venuesResult.error) {
        setSavedVenues((venuesResult.data || []) as unknown as SavedVenue[]);
      }
    } catch {
      // timeout — silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchSaved();
    else setLoading(false);
  }, [user, fetchSaved]);

  /* ---- Auth loading skeleton ---- */
  if (authLoading) {
    return <SavedSkeleton />;
  }

  /* ---- Not logged in ---- */
  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div
          className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(255, 107, 53, 0.1)" }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--dog-orange, #FF6B35)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h2
          className="text-lg font-extrabold"
          style={{ color: "var(--dog-charcoal, #292524)" }}
        >
          Save your favorites
        </h2>
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{ color: "var(--dog-stone, #78716C)" }}
        >
          Sign in to bookmark dog-friendly events and places you want to
          remember.
        </p>
        <Link
          href={`/auth/login?redirect=/${portalSlug}?view=community`}
          className="dog-btn-primary inline-block mt-6"
        >
          Sign in
        </Link>
      </div>
    );
  }

  /* ---- Data loading skeleton ---- */
  if (loading) {
    return <SavedSkeleton />;
  }

  const eventsCount = savedEvents.length;
  const placesCount = savedVenues.length;
  const hasNothing = eventsCount === 0 && placesCount === 0;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-24">
      {/* Tabs */}
      <div
        className="flex gap-1 p-1 rounded-xl"
        style={{ background: "rgba(253, 232, 138, 0.25)" }}
        role="tablist"
      >
        <TabButton
          active={tab === "events"}
          onClick={() => setTab("events")}
          count={eventsCount}
        >
          Events
        </TabButton>
        <TabButton
          active={tab === "places"}
          onClick={() => setTab("places")}
          count={placesCount}
        >
          Places
        </TabButton>
      </div>

      {/* Content */}
      {hasNothing ? (
        <DogEmptyState
          emoji="🔖"
          headline="Nothing saved yet"
          body="Tap the bookmark icon on any event or venue to save it here."
          ctaLabel="Start exploring"
          ctaHref={`/${portalSlug}`}
        />
      ) : tab === "events" ? (
        eventsCount === 0 ? (
          <DogEmptyState
            emoji="📅"
            headline="No upcoming saved events"
            body="Events you save will appear here so you don't miss them."
            ctaLabel="Find events"
            ctaHref={`/${portalSlug}?view=find`}
          />
        ) : (
          <div className="mt-4 space-y-3">
            {savedEvents.map((item) =>
              item.event ? (
                <SavedEventRow
                  key={item.id}
                  savedId={item.id}
                  event={item.event}
                  portalSlug={portalSlug}
                  onUnsave={fetchSaved}
                />
              ) : null
            )}
          </div>
        )
      ) : placesCount === 0 ? (
        <DogEmptyState
          emoji="📍"
          headline="No saved places"
          body="Save your favorite dog-friendly spots for quick access."
          ctaLabel="Explore the map"
          ctaHref={`/${portalSlug}?view=find`}
        />
      ) : (
        <div className="mt-4 space-y-3">
          {savedVenues.map((item) =>
            item.venue ? (
              <SavedVenueRow
                key={item.id}
                savedId={item.id}
                venue={item.venue}
                portalSlug={portalSlug}
                onUnsave={fetchSaved}
              />
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab Button                                                         */
/* ------------------------------------------------------------------ */

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-150"
      style={{
        background: active ? "var(--dog-orange, #FF6B35)" : "transparent",
        color: active ? "#FFFFFF" : "var(--dog-charcoal, #292524)",
      }}
    >
      {children}
      {count > 0 && (
        <span
          className="ml-1.5 text-xs"
          style={{ opacity: active ? 0.85 : 0.5 }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Saved Event Row                                                    */
/* ------------------------------------------------------------------ */

function SavedEventRow({
  savedId,
  event,
  portalSlug,
  onUnsave,
}: {
  savedId: number;
  event: NonNullable<SavedEvent["event"]>;
  portalSlug: string;
  onUnsave: () => void;
}) {
  const contentType = classifyDogContentType(
    event.venue?.name || null,
    null,
    event.tags,
    true
  );
  const accentColor = DOG_CONTENT_COLORS[contentType];

  return (
    <div className="dog-card flex items-center gap-3 p-3">
      <Link
        href={`/${portalSlug}/events/${event.id}`}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        {/* Thumbnail */}
        {event.image_url ? (
          <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
            <Image
              src={getProxiedImageSrc(event.image_url)}
              alt={event.title}
              fill
              className="object-cover"
              sizes="56px"
            />
          </div>
        ) : (
          <div
            className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center"
            style={{ background: accentColor, opacity: 0.15 }}
          >
            <span style={{ color: accentColor, fontSize: 18, fontWeight: 800 }}>
              {event.start_date.split("-")[2]}
            </span>
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: accentColor }}
          >
            {formatSavedDate(event.start_date, event.start_time, event.is_all_day)}
          </p>
          <h3
            className="font-bold text-sm leading-snug truncate"
            style={{ color: "var(--dog-charcoal)" }}
          >
            {event.title}
          </h3>
          {event.venue && (
            <p
              className="text-xs truncate"
              style={{ color: "var(--dog-stone)" }}
            >
              {event.venue.name}
            </p>
          )}
        </div>
      </Link>

      {/* Unsave button */}
      <UnsaveButton savedId={savedId} eventId={event.id} onUnsave={onUnsave} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Saved Venue Row                                                    */
/* ------------------------------------------------------------------ */

function SavedVenueRow({
  savedId,
  venue,
  portalSlug,
  onUnsave,
}: {
  savedId: number;
  venue: NonNullable<SavedVenue["venue"]>;
  portalSlug: string;
  onUnsave: () => void;
}) {
  const contentType = classifyDogContentType(
    venue.venue_type,
    venue.vibes,
    null,
    false
  );
  const accentColor = DOG_CONTENT_COLORS[contentType];

  const typeLabel = venue.venue_type
    ? venue.venue_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Spot";

  return (
    <div className="dog-card flex items-center gap-3 p-3">
      <Link
        href={`/${portalSlug}/spots/${venue.slug}`}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        {/* Thumbnail */}
        {venue.image_url ? (
          <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
            <Image
              src={getProxiedImageSrc(venue.image_url)}
              alt={venue.name}
              fill
              className="object-cover"
              sizes="56px"
            />
          </div>
        ) : (
          <div
            className="w-14 h-14 rounded-xl flex-shrink-0"
            style={{ background: accentColor, opacity: 0.15 }}
          />
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3
            className="font-bold text-sm leading-snug truncate"
            style={{ color: "var(--dog-charcoal)" }}
          >
            {venue.name}
          </h3>
          <p className="text-xs truncate" style={{ color: "var(--dog-stone)" }}>
            {typeLabel}
            {venue.neighborhood && ` \u00b7 ${venue.neighborhood}`}
          </p>
        </div>
      </Link>

      {/* Unsave button */}
      <UnsaveButton savedId={savedId} venueId={venue.id} onUnsave={onUnsave} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Unsave Button                                                      */
/* ------------------------------------------------------------------ */

function UnsaveButton({
  savedId,
  eventId,
  venueId,
  onUnsave,
}: {
  savedId: number;
  eventId?: number;
  venueId?: number;
  onUnsave: () => void;
}) {
  const [removing, setRemoving] = useState(false);

  const handleUnsave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (removing) return;

    setRemoving(true);
    try {
      const params = new URLSearchParams();
      if (eventId) params.set("event_id", String(eventId));
      if (venueId) params.set("venue_id", String(venueId));

      const res = await fetch(`/api/saved?${params}`, { method: "DELETE" });
      if (res.ok) onUnsave();
    } catch {
      // silent
    } finally {
      setRemoving(false);
    }
  };

  return (
    <button
      onClick={handleUnsave}
      disabled={removing}
      className="flex-shrink-0 p-2 rounded-lg transition-colors"
      style={{
        color: removing
          ? "var(--dog-stone, #78716C)"
          : "var(--dog-orange, #FF6B35)",
      }}
      aria-label="Remove saved item"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                   */
/* ------------------------------------------------------------------ */

function SavedSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-24">
      <div
        className="flex gap-1 p-1 rounded-xl"
        style={{ background: "rgba(253, 232, 138, 0.25)" }}
      >
        <div className="flex-1 h-10 rounded-lg skeleton-shimmer" />
        <div
          className="flex-1 h-10 rounded-lg skeleton-shimmer"
          style={{ animationDelay: "60ms" }}
        />
      </div>
      <div className="mt-4 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-20 rounded-2xl skeleton-shimmer"
            style={{ animationDelay: `${i * 70}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
