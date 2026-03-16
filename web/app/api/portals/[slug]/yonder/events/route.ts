import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { normalizePortalSlug, resolvePortalSlugAlias } from "@/lib/portal-aliases";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";

const CACHE_NAMESPACE = "api:yonder-events";
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";
const MAX_EVENTS = 50;

type Props = {
  params: Promise<{ slug: string }>;
};

type AdventureEvent = {
  id: number;
  title: string;
  startDate: string;
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
  imageUrl: string | null;
  description: string | null;
  sourceUrl: string | null;
  ticketUrl: string | null;
  venueName: string | null;
  venueSlug: string | null;
  venueImageUrl: string | null;
  neighborhood: string | null;
  sourceName: string | null;
  tags: string[] | null;
};

type WindowParam = "weekend" | "week" | "month";

function getDateRange(window: WindowParam): { start: string; end: string } {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  if (window === "week") {
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    return { start: todayStr, end: end.toISOString().split("T")[0] };
  }

  if (window === "month") {
    const end = new Date(now);
    end.setDate(end.getDate() + 30);
    return { start: todayStr, end: end.toISOString().split("T")[0] };
  }

  // weekend: find this or next Friday–Sunday
  // JS getDay(): 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  const dayOfWeek = now.getDay();

  // Days until Friday (wrapping past Sunday into next week)
  // If today is Sat(6) or Sun(0), the weekend has started — use this Friday
  let daysUntilFriday: number;
  if (dayOfWeek === 6) {
    // Saturday — rewind to Friday (yesterday)
    daysUntilFriday = -1;
  } else if (dayOfWeek === 0) {
    // Sunday — rewind to Friday (two days ago)
    daysUntilFriday = -2;
  } else {
    // Mon–Fri: advance forward to next Friday
    daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    // If today IS Friday, daysUntilFriday = 0 — use this Friday
    if (dayOfWeek === 5) daysUntilFriday = 0;
  }

  const friday = new Date(now);
  friday.setDate(friday.getDate() + daysUntilFriday);

  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);

  // If the weekend is in the past (we landed on a prior Friday), advance to next
  if (sunday < now) {
    friday.setDate(friday.getDate() + 7);
    sunday.setDate(sunday.getDate() + 7);
  }

  return {
    start: friday.toISOString().split("T")[0],
    end: sunday.toISOString().split("T")[0],
  };
}

export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const canonicalSlug = resolvePortalSlugAlias(normalizePortalSlug(slug));

  if (canonicalSlug !== "yonder") {
    return NextResponse.json(
      { events: [] satisfies AdventureEvent[] },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    );
  }

  const { searchParams } = new URL(request.url);
  const windowRaw = searchParams.get("window") ?? "month";
  const window: WindowParam =
    windowRaw === "weekend" || windowRaw === "week" || windowRaw === "month"
      ? windowRaw
      : "month";

  const cacheBucket = Math.floor(Date.now() / CACHE_TTL_MS);
  const cacheKey = `${canonicalSlug}|${window}|${cacheBucket}`;
  const cached = await getSharedCacheJson<{ events: AdventureEvent[] }>(
    CACHE_NAMESPACE,
    cacheKey,
  );
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  }

  const supabase = await createClient();

  // Resolve portal ID from slug
  type PortalRow = { id: string };
  const { data: portalData } = await supabase
    .from("portals")
    .select("id")
    .eq("slug", canonicalSlug)
    .eq("status", "active")
    .maybeSingle();

  const portal = portalData as PortalRow | null;
  if (!portal) {
    return NextResponse.json(
      { events: [] satisfies AdventureEvent[] },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    );
  }

  // Get source IDs accessible to this portal
  type SourceAccessRow = { source_id: number };
  const { data: sourceAccessData } = await supabase
    .from("portal_source_access")
    .select("source_id")
    .eq("portal_id", portal.id);

  const sourceIds = ((sourceAccessData ?? []) as SourceAccessRow[]).map(
    (row) => row.source_id,
  );

  if (sourceIds.length === 0) {
    return NextResponse.json(
      { events: [] satisfies AdventureEvent[] },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    );
  }

  const { start, end } = getDateRange(window);

  type EventRow = {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    end_time: string | null;
    is_all_day: boolean;
    image_url: string | null;
    description: string | null;
    source_url: string | null;
    ticket_url: string | null;
    tags: string[] | null;
    venue: {
      name: string;
      slug: string;
      image_url: string | null;
      hero_image_url: string | null;
      neighborhood: string | null;
    } | null;
    source: {
      name: string;
    } | null;
  };

  const { data: eventsData, error } = await supabase
    .from("events")
    .select(
      `
      id,
      title,
      start_date,
      start_time,
      end_time,
      is_all_day,
      image_url,
      description,
      source_url,
      ticket_url,
      tags,
      venue:venues(name, slug, image_url, hero_image_url, neighborhood),
      source:sources!events_source_id_fkey(name)
      `,
    )
    .eq("is_active", true)
    .is("canonical_event_id", null)
    .in("source_id", sourceIds)
    .gte("start_date", start)
    .lte("start_date", end)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: false })
    .limit(MAX_EVENTS);

  if (error) {
    console.error("GET /api/portals/[slug]/yonder/events:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 },
    );
  }

  const rows = ((eventsData ?? []) as unknown as EventRow[]);

  const events: AdventureEvent[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    startDate: row.start_date,
    startTime: row.start_time,
    endTime: row.end_time,
    isAllDay: row.is_all_day,
    imageUrl: row.image_url,
    description: row.description,
    sourceUrl: row.source_url,
    ticketUrl: row.ticket_url,
    venueName: row.venue?.name ?? null,
    venueSlug: row.venue?.slug ?? null,
    venueImageUrl: row.venue?.image_url ?? row.venue?.hero_image_url ?? null,
    neighborhood: row.venue?.neighborhood ?? null,
    sourceName: row.source?.name ?? null,
    tags: row.tags,
  }));

  const result = { events };
  await setSharedCacheJson(CACHE_NAMESPACE, cacheKey, result, CACHE_TTL_MS);

  return NextResponse.json(result, {
    headers: { "Cache-Control": CACHE_CONTROL },
  });
}
