import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  type Neighborhood,
  getNeighborhoodByName,
  getNeighborhoodDescription,
} from "@/config/neighborhoods";
import { buildNeighborhoodIndexSections } from "@/lib/neighborhood-index";
import { supabase } from "@/lib/supabase";
import { createServiceClient } from "@/lib/supabase/service";
import { toAbsoluteUrl } from "@/lib/site-url";
import { getLocalDateString } from "@/lib/formats";
import NeighborhoodsPageClient from "@/components/neighborhoods/NeighborhoodsPageClient";
import CategoryIcon from "@/components/CategoryIcon";
import { type NeighborhoodActivity, getNeighborhoodColor } from "@/lib/neighborhood-colors";
import { resolveFeedPageRequest } from "../_surfaces/feed/resolve-feed-page-request";

export const revalidate = 300;

type Props = {
  params: Promise<{ portal: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portal } = await params;
  return {
    title: "Neighborhoods — Atlanta Events & Places | Lost City",
    description:
      "Explore Atlanta neighborhoods and find events, places, and things to do across the city.",
    alternates: {
      canonical: toAbsoluteUrl(`/${portal}/neighborhoods`),
    },
  };
}

async function getVenueCountsByNeighborhood(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("places")
    .select("neighborhood")
    .eq("is_active", true)
    .not("neighborhood", "is", null);

  if (error || !data) return {};

  const counts: Record<string, number> = {};
  for (const row of data as { neighborhood: string | null }[]) {
    if (row.neighborhood) {
      counts[row.neighborhood] = (counts[row.neighborhood] || 0) + 1;
    }
  }
  return counts;
}

function buildSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function computeRawScore(row: {
  events_today: number;
  events_week: number;
  venue_count: number;
  editorial_mention_count: number;
  occasion_type_count: number;
}): number {
  return (
    row.events_today * 5 +
    row.events_week * 1 +
    row.venue_count * 0.5 +
    row.editorial_mention_count * 2 +
    row.occasion_type_count * 1
  );
}

async function getActivityData(portalSlug: string, portalId: string | null): Promise<NeighborhoodActivity[]> {
  try {
    const serviceClient = createServiceClient();
    const { data: rpcRows, error } = await serviceClient.rpc(
      "get_neighborhood_activity" as never,
      {
        p_portal_id: portalId,
        p_city_names: ["Atlanta"],
      } as never
    );

    if (error || !rpcRows) return [];

    type RpcRow = {
      neighborhood: string;
      events_today: number;
      events_week: number;
      venue_count: number;
      editorial_mention_count: number;
      occasion_type_count: number;
    };

    const rows = rpcRows as RpcRow[];
    const rawScores = rows.map(computeRawScore);
    const maxRaw = Math.max(...rawScores, 0);

    // Secondary queries: categories, active hangs, RSVP going counts
    const todayStr = getLocalDateString();
    const weekEndDate = new Date(todayStr + "T00:00:00");
    weekEndDate.setDate(weekEndDate.getDate() + 7);
    const weekEndStr = getLocalDateString(weekEndDate);

    // Fetch events (with IDs for RSVP lookup) and active hangs in parallel
    const [eventResult, hangResult] = await Promise.all([
      serviceClient
        .from("events")
        .select("id, category_id, venue:venues!events_venue_id_fkey(neighborhood)")
        .eq("is_active", true)
        .is("canonical_event_id", null)
        .gte("start_date", todayStr)
        .lte("start_date", weekEndStr),
      serviceClient
        .from("hangs")
        .select("venue:venues(neighborhood)")
        .eq("status", "active")
        .gt("auto_expire_at", new Date().toISOString()),
    ]);

    const eventRows = eventResult.data;

    // Aggregate categories + build event→neighborhood map for RSVP lookup
    const catsByHood: Record<string, Record<string, number>> = {};
    const eventIdToHood: Record<number, string> = {};
    if (eventRows) {
      for (const row of eventRows as { id: number; category_id: string | null; venue: { neighborhood: string | null } | null }[]) {
        const neighborhood = row.venue?.neighborhood;
        if (neighborhood) eventIdToHood[row.id] = neighborhood;
        const cat = row.category_id;
        if (!neighborhood || !cat) continue;
        if (!catsByHood[neighborhood]) catsByHood[neighborhood] = {};
        catsByHood[neighborhood][cat] = (catsByHood[neighborhood][cat] ?? 0) + 1;
      }
    }

    // Aggregate active hangs by neighborhood
    const hangsByHood: Record<string, number> = {};
    if (hangResult.data) {
      for (const row of hangResult.data as { venue: { neighborhood: string | null } | null }[]) {
        const n = row.venue?.neighborhood;
        if (n) hangsByHood[n] = (hangsByHood[n] ?? 0) + 1;
      }
    }

    // Batch RSVP going counts for this week's events
    const goingByHood: Record<string, number> = {};
    const eventIds = Object.keys(eventIdToHood).map(Number);
    if (eventIds.length > 0) {
      try {
        const { data: rsvpData } = await serviceClient.rpc(
          "get_social_proof_counts" as never,
          { event_ids: eventIds } as never,
        );
        if (rsvpData) {
          for (const r of rsvpData as { event_id: number; going_count: number }[]) {
            const hood = eventIdToHood[r.event_id];
            if (hood && r.going_count > 0) {
              goingByHood[hood] = (goingByHood[hood] ?? 0) + r.going_count;
            }
          }
        }
      } catch {
        // RSVP counts are non-critical — fail silently
      }
    }

    const NOISE_CATEGORIES = new Set(['support_group', 'unknown', 'recreation']);

    function topCats(n: string): string[] {
      const counts = catsByHood[n];
      if (!counts) return [];
      return Object.entries(counts)
        .filter(([cat]) => !NOISE_CATEGORIES.has(cat))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([c]) => c);
    }

    return rows.map((row, i) => {
      const config = getNeighborhoodByName(row.neighborhood);
      const rawScore = rawScores[i];
      return {
        name: row.neighborhood,
        slug: buildSlug(row.neighborhood),
        tier: config?.tier ?? 3,
        eventsTodayCount: Number(row.events_today),
        eventsWeekCount: Number(row.events_week),
        venueCount: Number(row.venue_count),
        editorialMentionCount: Number(row.editorial_mention_count),
        occasionTypes: Number(row.occasion_type_count),
        activityScore: maxRaw > 0 ? Math.round((rawScore / maxRaw) * 100) : 0,
        topCategories: topCats(row.neighborhood),
        goingCount: goingByHood[row.neighborhood] ?? 0,
        activeHangsCount: hangsByHood[row.neighborhood] ?? 0,
      };
    });
  } catch (err) {
    console.error("[neighborhoods] Failed to fetch activity data:", err);
    return [];
  }
}

// ─── Card variants ─────────────────────────────────────────────────────────

function NeighborhoodIndexCard({
  neighborhood,
  count,
  portalSlug,
  activity,
  compact = false,
}: {
  neighborhood: Neighborhood;
  count: number;
  portalSlug: string;
  activity?: NeighborhoodActivity;
  compact?: boolean;
}) {
  const description = getNeighborhoodDescription(neighborhood.id);

  const eventsToday = activity?.eventsTodayCount ?? 0;
  const eventsWeek = activity?.eventsWeekCount ?? 0;
  const venueCount = activity?.venueCount ?? count;
  const topCats = activity?.topCategories ?? [];

  const score = activity?.activityScore ?? 0;
  const color = getNeighborhoodColor(neighborhood.name);
  // Convert hex to rgb components for rgba()
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const bgOpacity = score > 0 ? Math.max(0.05, (score / 100) * 0.16) : 0.03;
  const borderOpacity = score > 0 ? Math.max(0.15, (score / 100) * 0.40) : 0.10;

  return (
    <Link
      href={`/${portalSlug}/neighborhoods/${neighborhood.id}`}
      className="block p-3 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98]"
      style={{
        backgroundColor: `rgba(${r}, ${g}, ${b}, ${bgOpacity})`,
        borderColor: `rgba(${r}, ${g}, ${b}, ${borderOpacity})`,
      }}
    >
      {/* Name + description */}
      <div className="text-sm font-semibold text-[var(--cream)] truncate leading-tight">
        {neighborhood.name}
      </div>
      {!compact && description && (
        <div className="text-xs text-[var(--muted)] mt-0.5 line-clamp-1 leading-snug">
          {description}
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-between mt-2 gap-1">
        <div className="font-mono text-xs leading-none">
          {eventsToday > 0 ? (
            <span>
              <span className="text-[var(--coral)]">{eventsToday} today</span>
              <span className="text-[var(--soft)]"> · {eventsWeek} wk</span>
            </span>
          ) : eventsWeek > 0 ? (
            <span className="text-[var(--soft)]">{eventsWeek} this week</span>
          ) : (
            <span className="text-[var(--muted)]">{venueCount} {venueCount === 1 ? 'place' : 'places'}</span>
          )}
        </div>

        {/* Category icons right-aligned */}
        {topCats.length > 0 && (
          <div className="flex items-center gap-0.5 flex-shrink-0 text-[var(--muted)]">
            {topCats.slice(0, 3).map((cat) => (
              <CategoryIcon key={cat} type={cat} size={15} glow="none" />
            ))}
          </div>
        )}
      </div>

      {/* Secondary venue count (when events are shown) */}
      {(eventsToday > 0 || eventsWeek > 0) && (
        <div className="font-mono text-2xs text-[var(--muted)] mt-1">
          {venueCount} {venueCount === 1 ? 'place' : 'places'}
        </div>
      )}
    </Link>
  );
}

export default async function NeighborhoodsIndexPage({ params }: Props) {
  const { portal: portalSlug } = await params;
  const request = await resolveFeedPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/neighborhoods`,
  });
  const portal = request?.portal;
  if (!portal) {
    notFound();
  }

  const [counts, activityData] = await Promise.all([
    getVenueCountsByNeighborhood(),
    getActivityData(portal.slug, portal.id),
  ]);
  const sections = buildNeighborhoodIndexSections(counts);

  // Build slug→activity lookup for grid cards
  const activityBySlug = new Map(activityData.map((a) => [a.slug, a]));

  return (
    <div className="max-w-6xl mx-auto px-4 pb-20">
      <section className="py-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--cream)]">
          Neighborhoods
        </h1>
        <p className="text-sm text-[var(--soft)] mt-2 max-w-xl">
          Explore what&apos;s happening across Atlanta&apos;s neighborhoods.
        </p>
      </section>

      {/* Interactive map hero */}
      {activityData.length > 0 && (
        <section className="mb-8">
            <NeighborhoodsPageClient
            activityData={activityData}
            portalSlug={portal.slug}
          />
        </section>
      )}

      {/* Grid sections */}
      {sections.map((section, sectionIndex) => {
        // Tier-specific grid density
        const gridClass =
          sectionIndex === 0
            ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
            : sectionIndex === 1
              ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5"
              : "grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2";
        const isCompact = sectionIndex === 2;

        return (
          <section key={section.title} className="mb-8">
            <div className="flex items-center gap-3 py-3 border-t border-[var(--twilight)]">
              <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
                {section.title}
              </h2>
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-2xs font-mono bg-[var(--twilight)] text-[var(--soft)]">
                {section.neighborhoods.length}
              </span>
            </div>
            <div className={gridClass}>
              {section.neighborhoods.map(({ neighborhood, count }) => (
                <NeighborhoodIndexCard
                  key={neighborhood.id}
                  neighborhood={neighborhood}
                  count={count}
                  portalSlug={portal.slug}
                  activity={activityBySlug.get(neighborhood.id)}
                  compact={isCompact}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
