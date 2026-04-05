import { buildExploreUrl } from "@/lib/find-url";

// Shared types and utilities for FeedSection sub-components

export type FeedEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  category: string | null;
  subcategory: string | null;
  image_url: string | null;
  description: string | null;
  featured_blurb?: string | null;
  going_count?: number;
  interested_count?: number;
  recommendation_count?: number;
  is_trending?: boolean;
  activity_type?: string;
  series_id?: string | null;
  series?: {
    id: string;
    slug: string;
    title: string;
    series_type: string;
    image_url: string | null;
    frequency: string | null;
    day_of_week: string | null;
    festival?: {
      id: string;
      slug: string;
      name: string;
      image_url: string | null;
      festival_type?: string | null;
      location: string | null;
      neighborhood: string | null;
    } | null;
  } | null;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
    slug: string | null;
  } | null;
};

export type FeedSectionData = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  section_type: "auto" | "curated" | "mixed";
  block_type: string;
  layout: string;
  items_per_row?: number;
  style?: Record<string, unknown> | null;
  block_content?: Record<string, unknown> | null;
  auto_filter?: {
    categories?: string[];
    tags?: string[];
    is_free?: boolean;
    date_filter?: string;
    sort_by?: string;
  } | null;
  events: FeedEvent[];
};

/** Block javascript: and data: URLs from DB content to prevent XSS */
export function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("/")
  );
}

/** Build "See all" URL based on section filters */
export function getSeeAllUrl(section: FeedSectionData, portalSlug: string): string {
  const autoFilter = section.auto_filter;
  const extraParams: Record<string, string> = {};

  if (autoFilter?.categories?.length) {
    extraParams.categories = autoFilter.categories.join(",");
  }
  if ((autoFilter as Record<string, unknown>)?.nightlife_mode) {
    extraParams.categories = "games,dance";
  }
  if (autoFilter?.tags?.length) {
    extraParams.tags = autoFilter.tags.join(",");
  }
  if (autoFilter?.is_free) {
    extraParams.price = "free";
    extraParams.free = "1";
  }
  if (autoFilter?.date_filter === "today") {
    extraParams.date = "today";
  } else if (autoFilter?.date_filter === "this_weekend") {
    extraParams.date = "weekend";
  }

  if (Object.keys(extraParams).length > 0) {
    return buildExploreUrl({
      portalSlug,
      lane: "events",
      extraParams,
    });
  }
  return `/${portalSlug}`;
}
