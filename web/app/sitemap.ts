import { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PORTAL_SLUG } from "@/lib/constants";
import { getLocalDateString } from "@/lib/formats";
import { getSiteUrl } from "@/lib/site-url";

const BASE_URL = getSiteUrl();

type EventRow = { id: number; start_date: string; updated_at: string | null; portal_id: string | null };
type SpotRow = { slug: string | null; updated_at: string | null; portal_id: string | null };
type SeriesRow = { slug: string | null; updated_at: string | null; portal_id: string | null };
type PortalRow = { id: string; slug: string | null; updated_at: string | null };

function resolvePortalSlug(portalId: string | null, portalSlugById: Map<string, string>): string {
  if (!portalId) return DEFAULT_PORTAL_SLUG;
  return portalSlugById.get(portalId) || DEFAULT_PORTAL_SLUG;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const { data: portalData } = await supabase
    .from("portals")
    .select("id, slug, updated_at")
    .eq("status", "active")
    .limit(500);

  const portals = (portalData || []) as PortalRow[];
  const portalSlugById = new Map<string, string>();
  for (const portal of portals) {
    if (!portal.slug) continue;
    portalSlugById.set(portal.id, portal.slug);
  }
  const portalPages: MetadataRoute.Sitemap = portals
    .filter((portal) => Boolean(portal.slug))
    .map((portal) => ({
      url: `${BASE_URL}/${portal.slug}`,
      lastModified: portal.updated_at ? new Date(portal.updated_at) : new Date(),
      changeFrequency: "hourly",
      priority: portal.slug === DEFAULT_PORTAL_SLUG ? 0.9 : 0.8,
    }));

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  if (portalPages.length === 0) {
    staticPages.push({
      url: `${BASE_URL}/${DEFAULT_PORTAL_SLUG}`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    });
  } else {
    staticPages.push(...portalPages);
  }

  // Fetch upcoming events (limit for performance)
  const today = getLocalDateString();
  const { data: eventsData } = await supabase
    .from("events")
    .select("id, start_date, updated_at, portal_id")
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .limit(1000);

  const events = (eventsData || []) as EventRow[];
  const eventPages: MetadataRoute.Sitemap = events.map((event) => ({
    url: `${BASE_URL}/${resolvePortalSlug(event.portal_id, portalSlugById)}/events/${event.id}`,
    lastModified: event.updated_at ? new Date(event.updated_at) : new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  // Fetch venues/spots
  const { data: spotsData } = await supabase
    .from("venues")
    .select("slug, updated_at, portal_id")
    .limit(500);

  const spots = (spotsData || []) as SpotRow[];
  const spotPages: MetadataRoute.Sitemap = spots
    .filter((spot) => spot.slug)
    .map((spot) => ({
      url: `${BASE_URL}/${resolvePortalSlug(spot.portal_id, portalSlugById)}/spots/${spot.slug}`,
      lastModified: spot.updated_at ? new Date(spot.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

  // Fetch event series
  const { data: seriesData } = await supabase
    .from("series")
    .select("slug, updated_at, portal_id")
    .limit(200);

  const series = (seriesData || []) as SeriesRow[];
  const seriesPages: MetadataRoute.Sitemap = series
    .filter((s) => Boolean(s.slug))
    .map((s) => ({
      url: `${BASE_URL}/${resolvePortalSlug(s.portal_id, portalSlugById)}/series/${s.slug}`,
      lastModified: s.updated_at ? new Date(s.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  return [...staticPages, ...eventPages, ...spotPages, ...seriesPages];
}
