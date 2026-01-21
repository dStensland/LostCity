import { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://lostcity.ai";

type EventRow = { id: number; start_date: string; updated_at: string | null };
type SpotRow = { slug: string | null; updated_at: string | null };
type SeriesRow = { slug: string; updated_at: string | null };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/atlanta`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/happening-now`,
      lastModified: new Date(),
      changeFrequency: "always",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/spots`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/foryou`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
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

  // Fetch upcoming events (limit to recent/upcoming for performance)
  const today = new Date().toISOString().split("T")[0];
  const { data: eventsData } = await supabase
    .from("events")
    .select("id, start_date, updated_at")
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .limit(1000);

  const events = (eventsData || []) as EventRow[];
  const eventPages: MetadataRoute.Sitemap = events.map((event) => ({
    url: `${BASE_URL}/events/${event.id}`,
    lastModified: event.updated_at ? new Date(event.updated_at) : new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  // Fetch venues/spots
  const { data: spotsData } = await supabase
    .from("venues")
    .select("slug, updated_at")
    .not("slug", "is", null)
    .limit(500);

  const spots = (spotsData || []) as SpotRow[];
  const spotPages: MetadataRoute.Sitemap = spots
    .filter((spot) => spot.slug)
    .map((spot) => ({
      url: `${BASE_URL}/spots/${spot.slug}`,
      lastModified: spot.updated_at ? new Date(spot.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

  // Fetch event series
  const { data: seriesData } = await supabase
    .from("event_series")
    .select("slug, updated_at")
    .limit(200);

  const series = (seriesData || []) as SeriesRow[];
  const seriesPages: MetadataRoute.Sitemap = series.map((s) => ({
    url: `${BASE_URL}/series/${s.slug}`,
    lastModified: s.updated_at ? new Date(s.updated_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...eventPages, ...spotPages, ...seriesPages];
}
