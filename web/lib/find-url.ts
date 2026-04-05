import type { LegacyLaneSlug } from "@/lib/explore-lane-meta";

type ExploreParamValue = string | number | boolean | null | undefined;

interface FindUrlParams {
  portalSlug: string;
  lane?: LegacyLaneSlug | (string & {});
  search?: string;
  date?: "today" | "tomorrow" | "weekend" | "week" | (string & {});
  categories?: string;
  price?: "free";
  genres?: string;
  tags?: string;
  vibes?: string;
  free?: "1";
  extraParams?: Record<string, ExploreParamValue>;
}

/**
 * Build a canonical Explore URL. Param names match what useFilterEngine reads.
 * Construction only — parsing/normalization stays in normalize-find-url.ts.
 */
export function buildExploreUrl(params: FindUrlParams): string {
  const sp = new URLSearchParams();

  if (params.lane) sp.set("lane", params.lane);
  if (params.search) sp.set("search", params.search);
  if (params.date) sp.set("date", params.date);
  if (params.categories) sp.set("categories", params.categories);
  if (params.price) sp.set("price", params.price);
  if (params.genres) sp.set("genres", params.genres);
  if (params.tags) sp.set("tags", params.tags);
  if (params.vibes) sp.set("vibes", params.vibes);
  if (params.free) sp.set("free", params.free);
  if (params.extraParams) {
    for (const [key, value] of Object.entries(params.extraParams)) {
      if (value === undefined || value === null || value === false) continue;
      sp.set(key, String(value));
    }
  }

  const queryString = sp.toString();
  return `/${params.portalSlug}/explore${queryString ? `?${queryString}` : ""}`;
}

interface CommunityHubUrlParams {
  portalSlug: string;
  search?: string;
}

interface BestOfUrlParams {
  portalSlug: string;
  categorySlug?: string;
}

interface CommunityOrgUrlParams {
  portalSlug: string;
  orgSlug: string;
}

interface SavedUrlParams {
  portalSlug: string;
}

interface DogMapUrlParams {
  portalSlug: string;
}

export function buildCommunityHubUrl(params: CommunityHubUrlParams): string {
  const sp = new URLSearchParams();
  if (params.search) sp.set("search", params.search);
  const queryString = sp.toString();
  return `/${params.portalSlug}/community-hub${queryString ? `?${queryString}` : ""}`;
}

export function buildCurationsUrl({ portalSlug }: { portalSlug: string }): string {
  return `/${portalSlug}/curations`;
}

export function buildBestOfUrl(params: BestOfUrlParams): string {
  return params.categorySlug
    ? `/${params.portalSlug}/best-of/${params.categorySlug}`
    : `/${params.portalSlug}/best-of`;
}

export function buildCommunityOrgUrl({ portalSlug, orgSlug }: CommunityOrgUrlParams): string {
  return `/${portalSlug}/community/${orgSlug}`;
}

export function buildSavedUrl({ portalSlug }: SavedUrlParams): string {
  return `/${portalSlug}/saved`;
}

export function buildDogMapUrl({ portalSlug }: DogMapUrlParams): string {
  return `/${portalSlug}/map`;
}

export const buildFindUrl = buildExploreUrl;

export type {
  FindUrlParams,
  CommunityHubUrlParams,
  BestOfUrlParams,
  CommunityOrgUrlParams,
  SavedUrlParams,
  DogMapUrlParams,
};
