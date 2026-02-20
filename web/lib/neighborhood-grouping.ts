import type { AroundMeItem, AroundMeSpot, AroundMeEvent } from "@/app/api/around-me/route";
import { getNeighborhoodByName, ITP_NEIGHBORHOODS } from "@/config/neighborhoods";

export type NeighborhoodCluster = {
  neighborhood: string;
  tier: 1 | 2 | 3;
  eventCount: number;
  spotCount: number;
  events: AroundMeItem[];
  spots: AroundMeItem[];
};

function getItemNeighborhood(item: AroundMeItem): string {
  if (item.type === "spot") {
    return (item.data as AroundMeSpot).neighborhood || "Other";
  }
  const eventData = item.data as AroundMeEvent;
  return eventData.venue?.neighborhood || "Other";
}

export function groupItemsByNeighborhood(items: AroundMeItem[]): NeighborhoodCluster[] {
  const clusterMap = new Map<string, { events: AroundMeItem[]; spots: AroundMeItem[] }>();

  for (const item of items) {
    const hood = getItemNeighborhood(item);
    if (!clusterMap.has(hood)) {
      clusterMap.set(hood, { events: [], spots: [] });
    }
    const cluster = clusterMap.get(hood)!;
    if (item.type === "event") {
      cluster.events.push(item);
    } else {
      cluster.spots.push(item);
    }
  }

  const clusters: NeighborhoodCluster[] = [];
  for (const [name, { events, spots }] of clusterMap) {
    if (events.length === 0 && spots.length === 0) continue;
    const hoodInfo = name !== "Other" ? getNeighborhoodByName(name) : undefined;
    clusters.push({
      neighborhood: name,
      tier: hoodInfo?.tier ?? 3,
      eventCount: events.length,
      spotCount: spots.length,
      events,
      spots,
    });
  }

  // Sort: tier ascending, then "Other" last, then by total count descending within tier
  clusters.sort((a, b) => {
    const aIsOther = a.neighborhood === "Other" ? 1 : 0;
    const bIsOther = b.neighborhood === "Other" ? 1 : 0;
    if (aIsOther !== bIsOther) return aIsOther - bIsOther;
    if (a.tier !== b.tier) return a.tier - b.tier;
    const aTotal = a.eventCount + a.spotCount;
    const bTotal = b.eventCount + b.spotCount;
    return bTotal - aTotal;
  });

  return clusters;
}

/**
 * Find the neighborhood whose center is closest to the given coordinates.
 * Only returns a match if the user is within 1.5x the neighborhood's radius.
 */
export function findNearestNeighborhood(lat: number, lng: number): string | null {
  let best: { name: string; dist: number; radius: number } | null = null;

  for (const hood of ITP_NEIGHBORHOODS) {
    const dLat = (hood.lat - lat) * 111_320; // meters per degree lat
    const dLng = (hood.lng - lng) * 111_320 * Math.cos((lat * Math.PI) / 180);
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);

    if (dist <= hood.radius * 1.5 && (!best || dist < best.dist)) {
      best = { name: hood.name, dist, radius: hood.radius };
    }
  }

  return best?.name ?? null;
}
