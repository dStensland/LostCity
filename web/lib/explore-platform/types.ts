import type { ComponentType } from "react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import type { SearchFacet, SearchResult } from "@/lib/search/legacy-result-types";
import type { LanePreview, LaneState } from "@/lib/types/explore-home";
import type { Portal } from "@/lib/portal-context";
import type { ExploreLaneInitialDataMap } from "./lane-data";

export type ExploreLaneId =
  | "events"
  | "shows"
  | "game-day"
  | "regulars"
  | "places"
  | "classes"
  | "neighborhoods";

export type ExploreUtilityView = "list" | "map" | "calendar";

export type ExploreLaneStatus = "loading" | "ready" | "error" | "empty";

export interface ExploreQuickIntent {
  id: string;
  label: string;
  description: string;
  href: string;
}

export interface ExploreEditorialPromo {
  id: string;
  title: string;
  description: string;
  href: string;
  accentToken: string;
}

export interface ExploreLaneSuggestion {
  lane: ExploreLaneId;
  reason: string;
}

export interface ExploreSearchQuickAction {
  label: string;
  href: string;
  description?: string;
}

export interface ExploreSearchResponse {
  query: string;
  results: SearchResult[];
  facets: SearchFacet[];
  total: number;
  didYouMean?: string[];
  entityCounts: Partial<Record<SearchResult["type"], number>>;
  laneSuggestions: ExploreLaneSuggestion[];
  quickActions: ExploreSearchQuickAction[];
}

export interface ExploreHomePayload {
  lanes: Partial<Record<ExploreLaneId, LanePreview>>;
  quickIntents: ExploreQuickIntent[];
  editorialPromos: ExploreEditorialPromo[];
}

export interface ExploreLaneComponentProps<TInitial = unknown> {
  portalId: string;
  portalSlug: string;
  portalExclusive: boolean;
  initialData?: TInitial | null;
}

export interface ExploreLaneServerLoaderArgs {
  portalId: string;
  portalSlug: string;
  portalExclusive: boolean;
  params: URLSearchParams;
}

export interface ExploreLaneDefinition {
  id: ExploreLaneId;
  label: string;
  icon: PhosphorIcon;
  accentToken: string;
  description: string;
  enabled: (portal: Portal) => boolean;
  defaultParams?: Record<string, string>;
  preload: () => Promise<unknown>;
  loadComponent: () => Promise<ComponentType<ExploreLaneComponentProps>>;
  clientHydrationKey: string;
  serverLoad?: (
    args: ExploreLaneServerLoaderArgs,
  ) => Promise<ExploreLaneInitialDataMap[ExploreLaneId] | null>;
  analyticsKey: string;
  searchPrompts: string[];
  supportsSearch: boolean;
  supportsMap: boolean;
  supportsCalendar: boolean;
  /** When set, clicking this lane navigates to this URL instead of rendering inline. */
  navigationHref?: (portalSlug: string) => string;
}

export type { LanePreview, LaneState, SearchResult };
