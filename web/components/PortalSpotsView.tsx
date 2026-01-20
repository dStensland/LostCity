"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import CategoryIcon, { getCategoryLabel } from "./CategoryIcon";

type Spot = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  neighborhood: string | null;
  spot_type: string | null;
  event_count?: number;
};

interface Props {
  portalId: string;
  portalSlug: string;
  isExclusive?: boolean;
}

export default function PortalSpotsView({ portalId, portalSlug, isExclusive = false }: Props) {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSpots() {
      // Get venues that have events for this portal
      const today = new Date().toISOString().split("T")[0];

      // First get venue IDs with events
      let query = supabase
        .from("events")
        .select("venue_id")
        .gte("start_date", today)
        .not("venue_id", "is", null);

      // For exclusive portals (business), only show their venues
      // For city portals, show all venues with events (including public events)
      if (isExclusive) {
        query = query.eq("portal_id", portalId);
      } else if (portalId === "default") {
        // Default portal - show all public events
        query = query.is("portal_id", null);
      } else {
        // For city portals, show venues with events for this portal OR public events
        query = query.or(`portal_id.eq.${portalId},portal_id.is.null`);
      }

      const { data: events } = await query;

      const typedEvents = events as { venue_id: number | null }[] | null;

      if (!typedEvents || typedEvents.length === 0) {
        setSpots([]);
        setLoading(false);
        return;
      }

      // Get unique venue IDs and count events per venue
      const venueEventCounts = new Map<number, number>();
      for (const event of typedEvents) {
        if (event.venue_id) {
          venueEventCounts.set(
            event.venue_id,
            (venueEventCounts.get(event.venue_id) || 0) + 1
          );
        }
      }

      const venueIds = Array.from(venueEventCounts.keys());

      // Fetch venue details
      const { data: venues } = await supabase
        .from("venues")
        .select("id, name, slug, address, neighborhood, spot_type")
        .in("id", venueIds);

      const typedVenues = venues as Spot[] | null;

      if (typedVenues) {
        const spotsWithCounts = typedVenues.map((venue) => ({
          ...venue,
          event_count: venueEventCounts.get(venue.id) || 0,
        }));

        // Sort by event count descending
        spotsWithCounts.sort((a, b) => (b.event_count || 0) - (a.event_count || 0));
        setSpots(spotsWithCounts);
      }

      setLoading(false);
    }

    fetchSpots();
  }, [portalId, isExclusive]);

  if (loading) {
    return (
      <div className="py-16 text-center text-[var(--muted)]">
        Loading locations...
      </div>
    );
  }

  if (spots.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-[var(--muted)]">No locations found</p>
        <Link
          href={`/${portalSlug}`}
          className="inline-block mt-4 font-mono text-sm text-[var(--coral)] hover:text-[var(--rose)]"
        >
          View all events
        </Link>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="mb-4">
        <p className="font-mono text-xs text-[var(--muted)]">
          <span className="text-[var(--soft)]">{spots.length}</span> locations with upcoming events
        </p>
      </div>

      <div className="space-y-2">
        {spots.map((spot) => (
          <Link
            key={spot.id}
            href={`/spots/${spot.slug}`}
            className="block p-4 rounded-lg border border-[var(--twilight)] bg-[var(--dusk)]/30 hover:bg-[var(--dusk)]/60 transition-colors group"
          >
            <div className="flex items-start gap-3">
              {spot.spot_type && (
                <CategoryIcon
                  type={spot.spot_type}
                  size={18}
                  className="flex-shrink-0 opacity-60 mt-0.5"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors">
                  {spot.name}
                </div>
                <div className="flex items-center gap-2 font-mono text-xs text-[var(--muted)] mt-1">
                  {spot.spot_type && (
                    <span>{getCategoryLabel(spot.spot_type)}</span>
                  )}
                  {spot.neighborhood && (
                    <>
                      <span className="opacity-40">·</span>
                      <span>{spot.neighborhood}</span>
                    </>
                  )}
                  {(spot.event_count ?? 0) > 0 && (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="text-[var(--coral)]">
                        {spot.event_count} upcoming event{spot.event_count !== 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                </div>
                {spot.address && (
                  <div className="font-mono text-[0.65rem] text-[var(--muted)] mt-1 opacity-60">
                    {spot.address}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
