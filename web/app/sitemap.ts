import { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PORTAL_SLUG } from "@/lib/constants";
import { getLocalDateString } from "@/lib/formats";
import { getSiteUrl, buildPortalOrigin } from "@/lib/site-url";
import type { Portal } from "@/lib/portal-context";

const BASE_URL = getSiteUrl();

type EventRow = {
  id: number;
  start_date: string;
  updated_at: string | null;
  portal_id: string | null;
  is_class: boolean | null;
  is_sensitive: boolean | null;
  canonical_event_id: number | null;
};
type SpotRow = { slug: string | null; updated_at: string | null; portal_id: string | null };
type SeriesRow = { slug: string | null; updated_at: string | null; portal_id: string | null };
type FestivalRow = { slug: string | null; updated_at: string | null; portal_id: string | null };
type PortalRow = { id: string; slug: string | null; updated_at: string | null; status: string | null; vertical_slug: string | null; city_slug: string | null };

function resolvePortalSlug(portalId: string | null, portalSlugById: Map<string, string>): string {
  if (!portalId) return DEFAULT_PORTAL_SLUG;
  return portalSlugById.get(portalId) || DEFAULT_PORTAL_SLUG;
}

function resolvePortalBaseUrl(portalId: string | null, portalDataById: Map<string, PortalRow>): string {
  if (!portalId) return BASE_URL;
  const portal = portalDataById.get(portalId);
  if (!portal?.vertical_slug) return BASE_URL;
  // Build subdomain origin for vertical portals
  return buildPortalOrigin({ vertical_slug: portal.vertical_slug, city_slug: portal.city_slug } as Portal);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const { data: portalData } = await supabase
    .from("portals")
    .select("id, slug, updated_at, status, vertical_slug, city_slug");

  const portals = ((portalData || []) as PortalRow[])
    .filter((portal) => portal.status === "active")
    .slice(0, 500);
  const portalSlugById = new Map<string, string>();
  const portalDataById = new Map<string, PortalRow>();
  for (const portal of portals) {
    if (!portal.slug) continue;
    portalSlugById.set(portal.id, portal.slug);
    portalDataById.set(portal.id, portal);
  }

  // For vertical portals, use subdomain origin; for base portals, use BASE_URL
  function getPortalSitemapUrl(portal: PortalRow): string {
    if (portal.vertical_slug && portal.city_slug) {
      const origin = buildPortalOrigin({ vertical_slug: portal.vertical_slug, city_slug: portal.city_slug } as Portal);
      return `${origin}/${portal.city_slug}`;
    }
    return `${BASE_URL}/${portal.slug}`;
  }

  const portalPages: MetadataRoute.Sitemap = portals
    .filter((portal) => Boolean(portal.slug))
    .map((portal) => ({
      url: getPortalSitemapUrl(portal),
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
    .select("id, start_date, updated_at, portal_id, is_class, is_sensitive, canonical_event_id");

  const events = ((eventsData || []) as EventRow[])
    .filter((event) => event.start_date >= today)
    .filter((event) => event.is_class !== true)
    .filter((event) => event.is_sensitive !== true)
    .filter((event) => event.canonical_event_id === null)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 1000);
  const eventPages: MetadataRoute.Sitemap = events.map((event) => {
    const base = resolvePortalBaseUrl(event.portal_id, portalDataById);
    const portalSlug = resolvePortalSlug(event.portal_id, portalSlugById);
    return {
      url: `${base}/${portalSlug}/events/${event.id}`,
      lastModified: event.updated_at ? new Date(event.updated_at) : new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    };
  });

  // Fetch venues/spots
  const { data: spotsData } = await supabase
    .from("places")
    .select("slug, updated_at, portal_id");

  const spots = ((spotsData || []) as SpotRow[]).slice(0, 500);
  const spotPages: MetadataRoute.Sitemap = spots
    .filter((spot) => spot.slug)
    .map((spot) => {
      const base = resolvePortalBaseUrl(spot.portal_id, portalDataById);
      const portalSlug = resolvePortalSlug(spot.portal_id, portalSlugById);
      return {
        url: `${base}/${portalSlug}/spots/${spot.slug}`,
        lastModified: spot.updated_at ? new Date(spot.updated_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      };
    });

  // Fetch event series
  const { data: seriesData } = await supabase
    .from("series")
    .select("slug, updated_at, portal_id");

  const series = ((seriesData || []) as SeriesRow[]).slice(0, 200);
  const seriesPages: MetadataRoute.Sitemap = series
    .filter((s) => Boolean(s.slug))
    .map((s) => {
      const base = resolvePortalBaseUrl(s.portal_id, portalDataById);
      const portalSlug = resolvePortalSlug(s.portal_id, portalSlugById);
      return {
        url: `${base}/${portalSlug}/series/${s.slug}`,
        lastModified: s.updated_at ? new Date(s.updated_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      };
    });

  // Fetch festivals
  const { data: festivalsData } = await supabase
    .from("series")
    .select("slug, updated_at, portal_id")
    .eq("series_type", "festival");

  const festivals = ((festivalsData || []) as FestivalRow[]).slice(0, 200);
  const festivalPages: MetadataRoute.Sitemap = festivals
    .filter((f) => Boolean(f.slug))
    .map((f) => {
      const base = resolvePortalBaseUrl(f.portal_id, portalDataById);
      const portalSlug = resolvePortalSlug(f.portal_id, portalSlugById);
      return {
        url: `${base}/${portalSlug}/festivals/${f.slug}`,
        lastModified: f.updated_at ? new Date(f.updated_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      };
    });

  // SEO landing pages (one per active portal)
  const landingPages: MetadataRoute.Sitemap = portals
    .filter((portal) => Boolean(portal.slug))
    .flatMap((portal) => {
      const baseUrl = getPortalSitemapUrl(portal);
      return [
        {
          url: `${baseUrl}/tonight`,
          lastModified: new Date(),
          changeFrequency: "hourly" as const,
          priority: 0.85,
        },
        {
          url: `${baseUrl}/this-weekend`,
          lastModified: new Date(),
          changeFrequency: "daily" as const,
          priority: 0.85,
        },
        {
          url: `${baseUrl}/free`,
          lastModified: new Date(),
          changeFrequency: "daily" as const,
          priority: 0.8,
        },
      ];
    });

  return [
    ...staticPages,
    ...eventPages,
    ...spotPages,
    ...seriesPages,
    ...festivalPages,
    ...landingPages,
  ];
}
