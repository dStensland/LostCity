import type {
  EmoryFederationEventPreview,
  EmoryFederationOrgPreview,
  EmoryFederationVenuePreview,
} from "@/lib/emory-federation-showcase";

export type DiscoveryTab = "events" | "venues" | "organizations";
export type DiscoveryView = "list" | "map" | "timeline";
export type DiscoverySort = "relevant" | "soonest" | "closest" | "active" | "alpha";

export type DiscoveryFilter = {
  id: string;
  label: string;
  keywords: string[];
  tabs?: DiscoveryTab[];
};

export type DiscoveryItem = {
  key: string;
  kind: "event" | "venue" | "organization";
  id: string;
  title: string;
  subtitle: string;
  detailHref: string;
  mapsHref: string | null;
  imageUrl: string | null;
  lat: number | null;
  lng: number | null;
  distanceMiles: number | null;
  startDate: string | null;
  startTime: string | null;
  upcomingCount: number;
  searchBlob: string;
};

function normalize(value: string | null | undefined): string {
  return (value || "").toLowerCase();
}

function includesQuery(haystack: string, query: string): boolean {
  if (!query.trim()) return true;
  return haystack.includes(query.trim().toLowerCase());
}

function eventTimestamp(item: DiscoveryItem): number {
  if (!item.startDate) return Number.MAX_SAFE_INTEGER;
  const t = item.startTime || "23:59:00";
  const parsed = Date.parse(`${item.startDate}T${t}`);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function recencyBoost(item: DiscoveryItem, now: Date): number {
  if (item.kind !== "event" || !item.startDate) return 0;
  const ts = eventTimestamp(item);
  if (!Number.isFinite(ts)) return 0;
  const diffHours = (ts - now.getTime()) / (1000 * 60 * 60);
  if (diffHours < -12) return -2;
  if (diffHours <= 2) return 8;
  if (diffHours <= 8) return 6;
  if (diffHours <= 24) return 4;
  if (diffHours <= 72) return 2;
  return 0;
}

function proximityBoost(item: DiscoveryItem): number {
  if (item.distanceMiles === null) return 0;
  if (item.distanceMiles <= 0.5) return 7;
  if (item.distanceMiles <= 1.5) return 5;
  if (item.distanceMiles <= 3) return 3;
  if (item.distanceMiles <= 6) return 1;
  return -1;
}

function activityBoost(item: DiscoveryItem): number {
  if (item.upcomingCount <= 0) return 0;
  if (item.upcomingCount >= 8) return 5;
  if (item.upcomingCount >= 4) return 3;
  return 1;
}

function keywordBoost(item: DiscoveryItem, filter: DiscoveryFilter | null): number {
  if (!filter || filter.keywords.length === 0) return 0;
  const blob = item.searchBlob;
  const matches = filter.keywords.filter((k) => blob.includes(normalize(k))).length;
  if (matches === 0) return -3;
  return matches * 2;
}

function toEventItem(item: EmoryFederationEventPreview): DiscoveryItem {
  const subtitle = [item.scheduleLabel, item.neighborhood].filter(Boolean).join(" · ");
  return {
    key: `event:${item.id}`,
    kind: "event",
    id: String(item.id),
    title: item.title,
    subtitle: subtitle || "Community event",
    detailHref: item.detailHref,
    mapsHref: item.mapsHref,
    imageUrl: item.imageUrl || null,
    lat: item.lat,
    lng: item.lng,
    distanceMiles: null,
    startDate: item.startDate || null,
    startTime: item.startTime || null,
    upcomingCount: 1,
    searchBlob: normalize([item.title, item.category, item.neighborhood, item.venueName].filter(Boolean).join(" ")),
  };
}

function toVenueItem(item: EmoryFederationVenuePreview): DiscoveryItem {
  const subtitle = [item.neighborhood, item.distanceLabel].filter(Boolean).join(" · ");
  return {
    key: `venue:${item.id}`,
    kind: "venue",
    id: String(item.id),
    title: item.name,
    subtitle: subtitle || "Venue",
    detailHref: item.detailHref,
    mapsHref: item.mapsHref,
    imageUrl: item.imageUrl || null,
    lat: item.lat,
    lng: item.lng,
    distanceMiles: item.distanceMiles,
    startDate: null,
    startTime: null,
    upcomingCount: item.upcomingCount,
    searchBlob: normalize([item.name, item.neighborhood, item.venueType].filter(Boolean).join(" ")),
  };
}

function toOrgItem(item: EmoryFederationOrgPreview): DiscoveryItem {
  return {
    key: `org:${item.id}`,
    kind: "organization",
    id: item.id,
    title: item.name,
    subtitle: [item.orgType || "Organization", `${item.upcomingCount} upcoming`].join(" · "),
    detailHref: item.detailHref,
    mapsHref: null,
    imageUrl: item.imageUrl || null,
    lat: null,
    lng: null,
    distanceMiles: null,
    startDate: null,
    startTime: null,
    upcomingCount: item.upcomingCount,
    searchBlob: normalize([item.name, item.orgType].filter(Boolean).join(" ")),
  };
}

export function buildDiscoveryItems(args: {
  events: EmoryFederationEventPreview[];
  venues: EmoryFederationVenuePreview[];
  organizations: EmoryFederationOrgPreview[];
}): Record<DiscoveryTab, DiscoveryItem[]> {
  return {
    events: args.events.map(toEventItem),
    venues: args.venues.map(toVenueItem),
    organizations: args.organizations.map(toOrgItem),
  };
}

export function rankDiscoveryItems(args: {
  items: DiscoveryItem[];
  now: Date;
  query: string;
  filter: DiscoveryFilter | null;
  sort: DiscoverySort;
}): DiscoveryItem[] {
  const { items, now, query, filter, sort } = args;

  const filtered = items.filter((item) => {
    const queryMatch = includesQuery(item.searchBlob, query);
    const keywordMatch = !filter || filter.keywords.length === 0
      ? true
      : filter.keywords.some((keyword) => item.searchBlob.includes(normalize(keyword)));
    return queryMatch && keywordMatch;
  });

  const scored = filtered.map((item) => {
    const score = keywordBoost(item, filter) + proximityBoost(item) + activityBoost(item) + recencyBoost(item, now);
    return { item, score };
  });

  const byRelevance = (a: typeof scored[number], b: typeof scored[number]) =>
    b.score - a.score
    || (a.item.distanceMiles ?? Number.MAX_SAFE_INTEGER) - (b.item.distanceMiles ?? Number.MAX_SAFE_INTEGER)
    || eventTimestamp(a.item) - eventTimestamp(b.item)
    || a.item.title.localeCompare(b.item.title);

  if (sort === "alpha") {
    return scored.map((row) => row.item).sort((a, b) => a.title.localeCompare(b.title));
  }
  if (sort === "soonest") {
    return scored.map((row) => row.item).sort((a, b) => eventTimestamp(a) - eventTimestamp(b));
  }
  if (sort === "closest") {
    return scored.map((row) => row.item).sort((a, b) => (a.distanceMiles ?? Number.MAX_SAFE_INTEGER) - (b.distanceMiles ?? Number.MAX_SAFE_INTEGER));
  }
  if (sort === "active") {
    return scored.map((row) => row.item).sort((a, b) => b.upcomingCount - a.upcomingCount || a.title.localeCompare(b.title));
  }

  return scored.sort(byRelevance).map((row) => row.item);
}

export function groupEventItemsByDay(items: DiscoveryItem[]): Array<{ day: string; items: DiscoveryItem[] }> {
  const grouped = new Map<string, DiscoveryItem[]>();

  for (const item of items) {
    const day = item.startDate || "Upcoming";
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day)?.push(item);
  }

  return [...grouped.entries()]
    .sort((a, b) => {
      if (a[0] === "Upcoming") return 1;
      if (b[0] === "Upcoming") return -1;
      return a[0].localeCompare(b[0]);
    })
    .map(([day, rows]) => ({
      day,
      items: rows.sort((a, b) => eventTimestamp(a) - eventTimestamp(b)),
    }));
}
