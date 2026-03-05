import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import { getPortalSourceAccess } from "@/lib/federation";
import {
  excludeSensitiveEvents,
  applyFederatedPortalScopeToQuery,
  filterByPortalCity,
} from "@/lib/portal-scope";
import { getLocalDateString } from "@/lib/formats";
import { getSiteUrl } from "@/lib/site-url";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { applyFeedGate } from "@/lib/feed-gate";

export const dynamic = "force-dynamic";

const ITEMS_LIMIT = 100;
const BASE_URL = getSiteUrl();

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "\u2026";
}

type RssEvent = {
  id: number;
  title: string;
  description: string | null;
  short_description: string | null;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  is_all_day: boolean | null;
  is_free: boolean | null;
  price: number | null;
  category_id: string | null;
  image_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  portal_id: string | null;
  source_id: number | null;
  venue: {
    name: string | null;
    city: string | null;
    state: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
};

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const searchParams = request.nextUrl.searchParams;
  const portalParam = searchParams.get("portal");

  if (!portalParam) {
    return NextResponse.json(
      { error: "portal parameter is required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { portalId, portalSlug, filters } =
    await resolvePortalQueryContext(supabase, searchParams);

  if (!portalId || !portalSlug) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const category = searchParams.get("category");
  const today = getLocalDateString();

  // Get federated source access for this portal
  const sourceAccess = await getPortalSourceAccess(portalId);

  let query = supabase
    .from("events")
    .select(
      `
      id, title, description, short_description,
      start_date, start_time, end_date, is_all_day,
      is_free, price, category_id, image_url,
      created_at, updated_at, portal_id, source_id,
      venue:venues(name, city, state, lat, lng)
    `
    )
    .gte("start_date", today)
    .is("canonical_event_id", null)
    .or("is_class.eq.false,is_class.is.null")
    .or("start_time.not.is.null,is_all_day.eq.true")
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: true })
    .limit(ITEMS_LIMIT);

  query = excludeSensitiveEvents(query);
  query = applyFederatedPortalScopeToQuery(query, {
    portalId,
    portalExclusive: false,
    sourceIds: sourceAccess.sourceIds,
    sourceColumn: "source_id",
  });
  query = applyFeedGate(query);

  if (category) {
    query = query.eq("category_id", category);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }

  // Post-query city filter
  const portalCity = filters.city;
  const events = filterByPortalCity(
    (data || []) as RssEvent[],
    portalCity
  );

  const portalName =
    portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);
  const feedUrl = `${BASE_URL}/api/feed/rss?portal=${portalSlug}`;
  const portalUrl = `${BASE_URL}/${portalSlug}`;

  const items = events.map((event) => {
    const eventUrl = `${BASE_URL}/${portalSlug}/events/${event.id}`;
    const desc =
      event.short_description || event.description
        ? truncate(
            escapeXml(
              (event.short_description || event.description || "").replace(
                /\n+/g,
                " "
              )
            ),
            500
          )
        : "";
    const pubDate = event.created_at
      ? new Date(event.created_at).toUTCString()
      : new Date(event.start_date).toUTCString();

    let geoTag = "";
    if (event.venue?.lat && event.venue?.lng) {
      geoTag = `<geo:lat>${event.venue.lat}</geo:lat><geo:long>${event.venue.lng}</geo:long>`;
    }

    let enclosure = "";
    if (event.image_url) {
      enclosure = `<enclosure url="${escapeXml(event.image_url)}" type="image/jpeg" />`;
    }

    const categoryTag = event.category_id
      ? `<category>${escapeXml(event.category_id)}</category>`
      : "";

    return `    <item>
      <title>${escapeXml(event.title)}</title>
      <link>${eventUrl}</link>
      <guid isPermaLink="true">${eventUrl}</guid>
      <description>${desc}</description>
      <pubDate>${pubDate}</pubDate>
      ${categoryTag}
      ${enclosure}
      ${geoTag}
    </item>`;
  });

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:geo="http://www.w3.org/2003/01/geo/wgs84_pos#" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(portalName)} Events | Lost City</title>
    <link>${portalUrl}</link>
    <description>Upcoming events in ${escapeXml(portalName)} — powered by Lost City</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${items.join("\n")}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
