import { createClient } from "@/lib/supabase/server";
import type { EventWithLocation } from "@/lib/search";
import EventCard from "@/components/EventCard";
import Link from "next/link";
import { getLocalDateString } from "@/lib/formats";

export async function ForYouSection({ portalSlug }: { portalSlug: string }) {
  const supabase = await createClient();

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null; // Don't show for anonymous users
  }

  // Fetch user's inferred preferences (cross-portal by default)
  const { data: preferences } = await supabase
    .from("inferred_preferences")
    .select("signal_type, signal_value, score")
    .eq("user_id", user.id)
    .order("score", { ascending: false })
    .limit(20);

  if (!preferences || preferences.length === 0) {
    return null; // No preferences yet
  }

  type PreferenceRow = {
    signal_type: string;
    signal_value: string;
    score: number;
  };

  const typedPreferences = preferences as PreferenceRow[];

  // Extract top categories and genres with sanitization
  const sanitizePreferenceValue = (value: string): string => {
    // Strip PostgREST filter syntax special characters
    return value.replace(/[(),.\;{}"\\]/g, "");
  };

  const topCategories = typedPreferences
    .filter(p => p.signal_type === "category")
    .slice(0, 3)
    .map(p => sanitizePreferenceValue(p.signal_value));

  const topGenres = typedPreferences
    .filter(p => p.signal_type === "genre")
    .slice(0, 5)
    .map(p => sanitizePreferenceValue(p.signal_value));

  if (topCategories.length === 0 && topGenres.length === 0) {
    return null; // No actionable preferences
  }

  // Get upcoming events that match user preferences
  const today = getLocalDateString(new Date());

  let query = supabase
    .from("events")
    .select(`
      *,
      venue:venues(id, name, slug, address, neighborhood, city, state, lat, lng, typical_price_min, typical_price_max, venue_type, vibes)
    `)
    .gte("start_date", today)
    .is("canonical_event_id", null)
    .eq("is_active", true);

  // Build OR condition for categories and genres
  const conditions: string[] = [];

  if (topCategories.length > 0) {
    conditions.push(`category_id.in.(${topCategories.join(",")})`);
  }

  if (topGenres.length > 0) {
    // Use overlaps for array matching with sanitized values
    conditions.push(`genres.ov.{${topGenres.join(",")}}`);
  }

  if (conditions.length > 0) {
    query = query.or(conditions.join(","));
  }

  query = query
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: true })
    .limit(6);

  const { data: events } = await query;

  if (!events || events.length === 0) {
    return null;
  }

  type EventRow = {
    id: number;
    [key: string]: unknown;
  };

  const typedEvents = events as EventRow[];

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--coral)] to-[var(--rose)] flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[var(--cream)]">For You</h2>
            <p className="font-mono text-xs text-[var(--muted)]">
              Based on your taste across all portals
            </p>
          </div>
        </div>
        <Link
          href="/settings/preferences"
          className="font-mono text-xs text-[var(--soft)] hover:text-[var(--coral)] transition-colors"
        >
          Tune
        </Link>
      </div>

      {/* Event Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {typedEvents.slice(0, 6).map((event) => (
          <EventCard
            key={event.id}
            event={event as EventWithLocation}
            portalSlug={portalSlug}
          />
        ))}
      </div>

      {/* Subtle personalization indicator */}
      <div className="flex items-center gap-2 justify-center py-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--coral)]/50" />
        <p className="font-mono text-xs text-[var(--muted)]">
          Personalized for you
        </p>
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--coral)]/50" />
      </div>
    </section>
  );
}
