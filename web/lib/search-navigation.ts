/**
 * Search Navigation Decision Engine
 *
 * Determines how to navigate when a user selects a search result,
 * based on the result type and current context.
 */

import type { ViewMode, FindType } from "./search-context";

// ============================================
// Types
// ============================================

export type ResultType =
  | "event"
  | "venue"
  | "organizer"
  | "series"
  | "list"
  | "neighborhood"
  | "category";

export type NavigationActionType =
  | "openModal"      // Open in-page modal (e.g., ?event=123)
  | "applyFilter"    // Apply as a filter to current list
  | "navigate";      // Full navigation to a new page

export interface NavigationAction {
  type: NavigationActionType;
  /** URL or param to use for the action */
  url: string;
  /** For applyFilter: the filter key to use (e.g., "venue", "neighborhoods") */
  filterKey?: string;
  /** For applyFilter: the filter value to apply */
  filterValue?: string | number;
}

export interface NavigationContext {
  viewMode: ViewMode;
  findType: FindType;
  portalSlug: string;
}

export interface SearchResultForNavigation {
  type: ResultType;
  id: number | string;
  slug?: string;
  title: string;
  href?: string;
}

// ============================================
// Navigation Decision Logic
// ============================================

/**
 * Determine how to navigate when a search result is selected.
 *
 * Navigation rules:
 * - Events: Always open modal (?event={id})
 * - Venues in Find > Events: Apply as filter (venue={id})
 * - Venues elsewhere: Open modal (?spot={slug})
 * - Organizers: Open modal (?org={slug})
 * - Series: Open modal (?series={slug})
 * - Lists: Navigate to /list/{slug}
 * - Neighborhoods: Apply as filter (neighborhoods={name})
 * - Categories: Apply as filter (categories={name})
 */
export function getNavigationAction(
  result: SearchResultForNavigation,
  context: NavigationContext
): NavigationAction {
  const { viewMode, findType, portalSlug } = context;

  switch (result.type) {
    case "event":
      // Events always open in modal
      return {
        type: "openModal",
        url: `/${portalSlug}?event=${result.id}`,
      };

    case "venue":
      // In Find > Events, selecting a venue filters the list
      if (viewMode === "find" && findType === "events") {
        return {
          type: "applyFilter",
          url: `/${portalSlug}?view=find&type=events&venue=${result.id}`,
          filterKey: "venue",
          filterValue: result.id,
        };
      }
      // Elsewhere, open venue modal
      return {
        type: "openModal",
        url: `/${portalSlug}?spot=${result.slug || result.id}`,
      };

    case "organizer":
      // Organizers open in modal
      return {
        type: "openModal",
        url: `/${portalSlug}?org=${result.slug || result.id}`,
      };

    case "series":
      // Series open in modal
      return {
        type: "openModal",
        url: `/${portalSlug}?series=${result.slug || result.id}`,
      };

    case "list":
      // Lists navigate to full page
      return {
        type: "navigate",
        url: `/list/${result.slug || result.id}`,
      };

    case "neighborhood":
      // Neighborhoods apply as filter
      return {
        type: "applyFilter",
        url: `/${portalSlug}?view=find&neighborhoods=${encodeURIComponent(result.title)}`,
        filterKey: "neighborhoods",
        filterValue: result.title,
      };

    case "category":
      // Categories apply as filter
      return {
        type: "applyFilter",
        url: `/${portalSlug}?view=find&categories=${encodeURIComponent(result.title)}`,
        filterKey: "categories",
        filterValue: result.title,
      };

    default:
      // Fallback to provided href or portal home
      return {
        type: "navigate",
        url: result.href || `/${portalSlug}`,
      };
  }
}

/**
 * Build a URL with the navigation action applied to current search params.
 */
export function buildNavigationUrl(
  action: NavigationAction,
  currentParams: URLSearchParams,
  portalSlug: string
): string {
  const params = new URLSearchParams(currentParams.toString());

  switch (action.type) {
    case "openModal":
      // For modals, we want to preserve current view state and add the modal param
      // The action.url already has the full path, extract just the query param
      const urlParts = action.url.split("?");
      if (urlParts[1]) {
        const modalParams = new URLSearchParams(urlParts[1]);
        // Add modal param to existing params
        modalParams.forEach((value, key) => {
          params.set(key, value);
        });
      }
      return `/${portalSlug}?${params.toString()}`;

    case "applyFilter":
      // For filters, add/update the filter param
      if (action.filterKey && action.filterValue !== undefined) {
        params.set(action.filterKey, String(action.filterValue));
        // Clear search query when applying a filter from suggestions
        params.delete("search");
        // Ensure we're in find view for filters
        if (!params.get("view")) {
          params.set("view", "find");
        }
      }
      return `/${portalSlug}?${params.toString()}`;

    case "navigate":
      // For full navigation, just return the target URL
      return action.url;

    default:
      return action.url;
  }
}

/**
 * Get user-friendly label for the navigation action.
 */
export function getActionLabel(action: NavigationAction, result: SearchResultForNavigation): string {
  switch (action.type) {
    case "openModal":
      return `View ${result.type}`;
    case "applyFilter":
      return `Filter by ${result.type}`;
    case "navigate":
      return `Go to ${result.type}`;
    default:
      return "Select";
  }
}

/**
 * Check if a result type should be prioritized based on context.
 */
export function isResultPrioritizedInContext(
  resultType: ResultType,
  viewMode: ViewMode,
  findType: FindType
): boolean {
  if (viewMode === "find") {
    switch (findType) {
      case "events":
        return resultType === "event";
      case "destinations":
        return resultType === "venue";
      case "orgs":
        return resultType === "organizer";
    }
  }

  // In feed and community, events are prioritized
  return resultType === "event";
}
