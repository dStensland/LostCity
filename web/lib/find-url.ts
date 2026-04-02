import type { LaneSlug } from "@/lib/explore-lane-meta";

interface FindUrlParams {
  portalSlug: string;
  lane?: LaneSlug;
  search?: string;
  date?: "today" | "tomorrow" | "weekend" | "week" | (string & {});
  categories?: string;
  price?: "free";
  genres?: string;
  tags?: string;
  vibes?: string;
  free?: "1";
}

/**
 * Build a canonical Find URL. Param names match what useFilterEngine reads.
 * Construction only — parsing/normalization stays in normalize-find-url.ts.
 */
export function buildFindUrl(params: FindUrlParams): string {
  const sp = new URLSearchParams();
  sp.set("view", "find");

  if (params.lane) sp.set("lane", params.lane);
  if (params.search) sp.set("search", params.search);
  if (params.date) sp.set("date", params.date);
  if (params.categories) sp.set("categories", params.categories);
  if (params.price) sp.set("price", params.price);
  if (params.genres) sp.set("genres", params.genres);
  if (params.tags) sp.set("tags", params.tags);
  if (params.vibes) sp.set("vibes", params.vibes);
  if (params.free) sp.set("free", params.free);

  return `/${params.portalSlug}?${sp.toString()}`;
}

export type { FindUrlParams };
