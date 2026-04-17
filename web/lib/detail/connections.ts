// web/lib/detail/connections.ts
import type {
  ConnectionRow,
  EntityData,
  EventApiResponse,
  PlaceApiResponse,
  SeriesApiResponse,
  FestivalApiResponse,
  OrgApiResponse,
} from "./types";

export function resolveConnections(data: EntityData, portalSlug: string): ConnectionRow[] {
  switch (data.entityType) {
    case "event":
      return resolveEventConnections(data.payload, portalSlug);
    case "place":
      return resolvePlaceConnections(data.payload, portalSlug);
    case "series":
      return resolveSeriesConnections(data.payload, portalSlug);
    case "festival":
      return resolveFestivalConnections(data.payload, portalSlug);
    case "org":
      return resolveOrgConnections(data.payload, portalSlug);
  }
}

function formatSeriesContext(series: {
  series_type: string;
  frequency?: string | null;
  day_of_week?: string | null;
}): string {
  if (series.series_type === "film") return "Film";
  const freq = series.frequency?.toLowerCase();
  const day = series.day_of_week?.toLowerCase();
  if (freq === "weekly" && day) {
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
    return `Weekly series · ${dayLabel}s`;
  }
  if (freq === "biweekly" && day) {
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
    return `Biweekly series · ${dayLabel}s`;
  }
  if (freq === "monthly") return "Monthly series";
  if (freq === "daily") return "Daily series";
  if (freq) {
    return `${freq.charAt(0).toUpperCase() + freq.slice(1)} series`;
  }
  return "Series";
}

function resolveEventConnections(data: EventApiResponse, portalSlug: string): ConnectionRow[] {
  const rows: ConnectionRow[] = [];
  const e = data.event;

  if (e.venue) {
    rows.push({
      id: `venue-${e.venue.id}`,
      type: "venue",
      label: e.venue.name,
      contextLine: [e.venue.place_type, e.venue.neighborhood].filter(Boolean).join(" · "),
      href: `/${portalSlug}?spot=${e.venue.slug}`,
      imageUrl: e.venue.image_url ?? null,
      accent: null,
    });
  }

  if (e.series?.festival) {
    const f = e.series.festival;
    rows.push({
      id: `festival-${f.id}`,
      type: "festival",
      label: f.name,
      contextLine: "Festival",
      href: `/${portalSlug}?festival=${f.slug}`,
      imageUrl: f.image_url,
      accent: "gold",
    });
  } else if (e.series) {
    rows.push({
      id: `series-${e.series.id}`,
      type: "series",
      label: e.series.title,
      contextLine: formatSeriesContext(e.series),
      // No href — series detail page adds little beyond what the event
      // already shows; display cadence inline instead.
      href: null,
      accent: null,
    });
  }

  if (e.producer) {
    rows.push({
      id: `org-${e.producer.id}`,
      type: "org",
      label: e.producer.name,
      contextLine: e.producer.org_type || "Presenter",
      href: `/${portalSlug}?org=${e.producer.slug}`,
      imageUrl: e.producer.logo_url,
      accent: null,
    });
  }

  return rows;
}

function resolvePlaceConnections(data: PlaceApiResponse, portalSlug: string): ConnectionRow[] {
  const rows: ConnectionRow[] = [];
  // Place connections are data-dependent — festival screenings, recurring series, etc.
  // These require additional data that may need supplemental API calls.
  // For now, surface what's available in the payload.

  if (data.screenings) {
    rows.push({
      id: "screenings-hub",
      type: "festival",
      label: "Now Showing",
      contextLine: `${data.upcomingEvents?.length ?? 0} screenings`,
      href: "#showtimes",
      accent: null,
    });
  }

  return rows;
}

function resolveSeriesConnections(data: SeriesApiResponse, portalSlug: string): ConnectionRow[] {
  const rows: ConnectionRow[] = [];

  if (data.series.festival) {
    const f = data.series.festival;
    rows.push({
      id: `festival-${f.id}`,
      type: "festival",
      label: f.name,
      contextLine: "Official Selection",
      href: `/${portalSlug}?festival=${f.slug}`,
      imageUrl: f.image_url,
      accent: "gold",
    });
  }

  if (data.venueShowtimes?.length > 1) {
    rows.push({
      id: "theaters",
      type: "venue",
      label: `Screening at ${data.venueShowtimes.length} theaters`,
      contextLine: data.venueShowtimes
        .map((v) => v.venue.name)
        .slice(0, 3)
        .join(", "),
      href: "#showtimes",
      accent: null,
    });
  }

  return rows;
}

function resolveFestivalConnections(
  data: FestivalApiResponse,
  portalSlug: string,
): ConnectionRow[] {
  const rows: ConnectionRow[] = [];

  const allVenues = new Map<number, { name: string; slug: string }>();
  for (const program of data.programs) {
    for (const session of program.sessions) {
      if (session.venue) {
        allVenues.set(session.venue.id, {
          name: session.venue.name,
          slug: session.venue.slug,
        });
      }
    }
  }

  if (allVenues.size > 0) {
    const names = [...allVenues.values()].map((v) => v.name).slice(0, 3);
    rows.push({
      id: "festival-venues",
      type: "venue",
      label: `${allVenues.size} festival venue${allVenues.size > 1 ? "s" : ""}`,
      contextLine:
        names.join(", ") + (allVenues.size > 3 ? `, +${allVenues.size - 3} more` : ""),
      href: "#schedule",
      accent: null,
    });
  }

  const totalSessions = data.programs.reduce((sum, p) => sum + p.sessions.length, 0);
  if (totalSessions > 0) {
    rows.push({
      id: "festival-programs",
      type: "series",
      label: `${totalSessions} event${totalSessions > 1 ? "s" : ""}`,
      contextLine: `Across ${data.programs.length} program${data.programs.length > 1 ? "s" : ""}`,
      href: "#schedule",
      accent: null,
    });
  }

  return rows;
}

function resolveOrgConnections(data: OrgApiResponse, portalSlug: string): ConnectionRow[] {
  const rows: ConnectionRow[] = [];

  if (data.events?.length > 0) {
    rows.push({
      id: "org-events",
      type: "venue",
      label: `${data.events.length} upcoming event${data.events.length > 1 ? "s" : ""}`,
      contextLine: "Produced by this organization",
      href: "#events",
      accent: null,
    });
  }

  return rows;
}
