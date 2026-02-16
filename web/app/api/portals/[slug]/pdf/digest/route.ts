import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { errorApiResponse } from "@/lib/api-utils";
import { getPortalWeather } from "@/lib/weather";
import { haversineDistanceMeters } from "@/lib/itinerary-utils";
import { generateDigestPdf } from "@/lib/pdf/pdf-generator";
import type {
  DigestEvent,
  DigestRestaurant,
} from "@/lib/pdf/forth-digest-template";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

// GET /api/portals/[slug]/pdf/digest?dates=2026-03-15,2026-03-17
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.expensive,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await context.params;
  const { searchParams } = new URL(request.url);
  const datesParam = searchParams.get("dates");

  const supabase = await createClient();

  // Fetch portal
  const { data: portal } = await supabase
    .from("portals")
    .select("id, name, filters")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  const portalData = portal as {
    id: string;
    name: string;
    filters: { geo_center?: [number, number]; geo_radius_km?: number };
  } | null;

  if (!portalData) {
    return errorApiResponse("Portal not found", 404);
  }

  // Parse dates
  let startDate: string | null = null;
  let endDate: string | null = null;
  let dateDisplay = "Upcoming";

  if (datesParam) {
    const parts = datesParam.split(",").map((d) => d.trim());
    if (parts[0] && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
      startDate = parts[0];
      endDate = parts[1] && /^\d{4}-\d{2}-\d{2}$/.test(parts[1]) ? parts[1] : parts[0];

      // Format for display
      const start = new Date(startDate + "T00:00:00");
      const end = new Date(endDate + "T00:00:00");
      const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      if (startDate === endDate) {
        dateDisplay = `${months[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`;
      } else {
        dateDisplay = `${months[start.getMonth()]} ${start.getDate()}\u2013${end.getDate()}, ${start.getFullYear()}`;
      }
    }
  }

  // Fetch weather
  let weather = null;
  const geoCenter = portalData.filters?.geo_center;
  if (geoCenter && geoCenter.length >= 2) {
    const w = await getPortalWeather(portalData.id, geoCenter[0], geoCenter[1]);
    if (w) {
      weather = { temperature_f: w.temperature_f, condition: w.condition };
    }
  }

  // Fetch events
  let eventsQuery = supabase
    .from("events")
    .select("title, start_time, category, venue_name:venues(name)")
    .eq("portal_id", portalData.id)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(12);

  if (startDate) {
    eventsQuery = eventsQuery.gte("start_date", startDate);
  }
  if (endDate) {
    eventsQuery = eventsQuery.lte("start_date", endDate);
  }

  const { data: eventsData } = await eventsQuery;

  const events: DigestEvent[] = (eventsData || []).map((e: Record<string, unknown>) => ({
    title: String(e.title || ""),
    start_time: typeof e.start_time === "string" ? e.start_time : null,
    venue_name:
      e.venue_name && typeof e.venue_name === "object" && "name" in (e.venue_name as Record<string, unknown>)
        ? String((e.venue_name as Record<string, unknown>).name)
        : null,
    category: typeof e.category === "string" ? e.category : null,
  }));

  // Fetch nearby restaurants/venues for this portal's area
  const { data: venuesData } = await supabase
    .from("venues")
    .select("name, venue_type, neighborhood, lat, lng")
    .eq("status", "active")
    .limit(20);

  const restaurants: DigestRestaurant[] = (venuesData || [])
    .map((v: Record<string, unknown>) => {
      const vLat = typeof v.lat === "number" ? v.lat : null;
      const vLng = typeof v.lng === "number" ? v.lng : null;
      let distKm = 0;
      if (geoCenter && vLat != null && vLng != null) {
        distKm = haversineDistanceMeters(geoCenter[0], geoCenter[1], vLat, vLng) / 1000;
      }
      return {
        name: String(v.name || ""),
        venue_type: typeof v.venue_type === "string" ? v.venue_type : null,
        neighborhood: typeof v.neighborhood === "string" ? v.neighborhood : null,
        distance_km: Math.round(distKm * 10) / 10,
      };
    })
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, 10);

  // Generate PDF
  try {
    const pdfBuffer = await generateDigestPdf({
      portalName: portalData.name,
      dates: dateDisplay,
      weather,
      events,
      restaurants,
      generatedAt: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    });

    return new Response(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${slug.replace(/[^a-zA-Z0-9_-]/g, "")}-weekend-brief.pdf"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return errorApiResponse("Failed to generate PDF", 500);
  }
}
