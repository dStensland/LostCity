"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import UnifiedHeader from "@/components/UnifiedHeader";
import SaveButton from "@/components/SaveButton";
import CategoryIcon from "@/components/CategoryIcon";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { usePortalSlug } from "@/lib/portal-context";
import { createClient } from "@/lib/supabase/client";
import { format, parseISO, startOfDay } from "date-fns";
import { formatTime } from "@/lib/formats";

type SavedEvent = {
  id: string;
  created_at: string;
  event: {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    is_all_day: boolean;
    is_free: boolean;
    price_min: number | null;
    price_max: number | null;
    category: string | null;
    image_url: string | null;
    venue: {
      id: number;
      name: string;
      neighborhood: string | null;
    } | null;
  } | null;
};

type FilterTab = "upcoming" | "past" | "all";

export default function SavedPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const portalSlug = usePortalSlug();
  const supabase = createClient();

  const [tab, setTab] = useState<FilterTab>("upcoming");
  const [savedItems, setSavedItems] = useState<SavedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login?redirect=/saved");
    }
  }, [user, authLoading, router]);

  // Load saved items
  useEffect(() => {
    async function loadSavedItems() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("saved_items")
          .select(`
            id,
            created_at,
            event:events (
              id,
              title,
              start_date,
              start_time,
              is_all_day,
              is_free,
              price_min,
              price_max,
              category,
              image_url,
              venue:venues (
                id,
                name,
                neighborhood
              )
            )
          `)
          .eq("user_id", user.id)
          .not("event_id", "is", null)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Failed to load saved items:", error);
        } else {
          setSavedItems((data || []) as SavedEvent[]);
        }
      } catch (error) {
        console.error("Failed to load saved items:", error);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadSavedItems();
    }
  }, [user, supabase]);

  // Filter items by tab
  const filteredItems = savedItems.filter((item) => {
    if (!item.event) return false;

    const eventDate = startOfDay(parseISO(item.event.start_date));
    const today = startOfDay(new Date());
    const isEventPast = eventDate < today;

    if (tab === "upcoming") return !isEventPast;
    if (tab === "past") return isEventPast;
    return true;
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  const upcomingCount = savedItems.filter((item) => {
    if (!item.event) return false;
    const eventDate = startOfDay(parseISO(item.event.start_date));
    return eventDate >= startOfDay(new Date());
  }).length;

  const pastCount = savedItems.filter((item) => {
    if (!item.event) return false;
    const eventDate = startOfDay(parseISO(item.event.start_date));
    return eventDate < startOfDay(new Date());
  }).length;

  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      {/* Main */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Page title */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-2xl text-[var(--cream)] italic">Saved Events</h1>
          <span className="font-mono text-xs text-[var(--muted)]">
            {savedItems.length} saved
          </span>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-1 p-1 bg-[var(--night)] rounded-lg mb-6">
          <button
            onClick={() => setTab("upcoming")}
            className={`flex-1 px-4 py-2 rounded-md font-mono text-xs font-medium transition-colors ${
              tab === "upcoming"
                ? "bg-[var(--dusk)] text-[var(--cream)]"
                : "text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            Upcoming ({upcomingCount})
          </button>
          <button
            onClick={() => setTab("past")}
            className={`flex-1 px-4 py-2 rounded-md font-mono text-xs font-medium transition-colors ${
              tab === "past"
                ? "bg-[var(--dusk)] text-[var(--cream)]"
                : "text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            Past ({pastCount})
          </button>
          <button
            onClick={() => setTab("all")}
            className={`flex-1 px-4 py-2 rounded-md font-mono text-xs font-medium transition-colors ${
              tab === "all"
                ? "bg-[var(--dusk)] text-[var(--cream)]"
                : "text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            All
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg animate-pulse"
              >
                <div className="h-5 bg-[var(--twilight)] rounded w-3/4 mb-2" />
                <div className="h-4 bg-[var(--twilight)] rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-6 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg text-center">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-[var(--muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
            <p className="text-[var(--soft)] font-mono text-sm">
              {tab === "upcoming"
                ? "No upcoming saved events"
                : tab === "past"
                ? "No past saved events"
                : "No saved events yet"}
            </p>
            <p className="text-[var(--muted)] font-mono text-xs mt-1">
              Save events by clicking the bookmark icon
            </p>
            <Link
              href={`/${portalSlug}`}
              className="inline-block mt-4 px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-xs font-medium rounded-lg hover:bg-[var(--rose)] transition-colors"
            >
              Browse Events
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) =>
              item.event ? (
                <SavedEventCard
                  key={item.id}
                  savedItem={item}
                />
              ) : null
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function SavedEventCard({
  savedItem,
}: {
  savedItem: SavedEvent;
}) {
  const event = savedItem.event!;
  const dateObj = parseISO(event.start_date);
  const formattedDate = format(dateObj, "EEE, MMM d");
  const time = formatTime(event.start_time, event.is_all_day);
  const isEventPast = startOfDay(dateObj) < startOfDay(new Date());

  return (
    <div className={`relative group ${isEventPast ? "opacity-60" : ""}`}>
      <Link
        href={`/events/${event.id}`}
        className="block p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg hover:bg-[var(--twilight)] transition-colors"
      >
        <div className="flex gap-4">
          {/* Image thumbnail */}
          {event.image_url && (
            <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--night)] relative">
              <Image
                src={event.image_url}
                alt={event.title}
                fill
                className="object-cover"
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0 pr-10">
            {/* Category */}
            {event.category && (
              <div className="mb-1">
                <CategoryIcon type={event.category} size={12} showLabel />
              </div>
            )}

            {/* Title */}
            <h3 className="font-semibold text-[var(--cream)] line-clamp-2 group-hover:text-[var(--coral)] transition-colors">
              {event.title}
            </h3>

            {/* Venue */}
            {event.venue && (
              <p className="font-serif text-sm text-[var(--soft)] mt-0.5 truncate">
                {event.venue.name}
                {event.venue.neighborhood && (
                  <span className="text-[var(--muted)]">
                    {" "}
                    · {event.venue.neighborhood}
                  </span>
                )}
              </p>
            )}

            {/* Date/time */}
            <p className="font-mono text-xs text-[var(--muted)] mt-1">
              {formattedDate} · {time}
              {event.is_free && (
                <span className="ml-2 text-[var(--cat-community)]">Free</span>
              )}
              {isEventPast && (
                <span className="ml-2 text-[var(--coral)]">Past</span>
              )}
            </p>
          </div>
        </div>
      </Link>

      {/* Save button - positioned absolute */}
      <div className="absolute top-4 right-4">
        <SaveButton
          eventId={event.id}
          size="sm"
        />
      </div>
    </div>
  );
}

