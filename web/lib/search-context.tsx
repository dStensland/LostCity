"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

// ============================================
// Types
// ============================================

export type ViewMode = "feed" | "find" | "community";
export type FindType = "events" | "classes" | "destinations" | null;

export interface UserPreferences {
  favoriteCategories: string[];
  followedOrganizers: string[];
  followedVenues: number[];
}

export interface SearchContextValue {
  /** Current view mode (feed, find, community) */
  viewMode: ViewMode;
  /** Current find sub-type (events, classes, destinations) - only set when viewMode is "find" */
  findType: FindType;
  /** Portal slug (e.g., "atlanta") */
  portalSlug: string;
  /** Portal database ID */
  portalId: string;
  /** User preferences for personalization (populated when logged in) */
  userPreferences?: UserPreferences;
}

export interface SearchContextProviderProps {
  children: ReactNode;
  viewMode: ViewMode;
  findType: FindType;
  portalSlug: string;
  portalId: string;
  userPreferences?: UserPreferences;
}

// ============================================
// Context
// ============================================

const SearchContext = createContext<SearchContextValue | null>(null);

// ============================================
// Provider Component
// ============================================

export function SearchContextProvider({
  children,
  viewMode,
  findType,
  portalSlug,
  portalId,
  userPreferences,
}: SearchContextProviderProps) {
  const value = useMemo<SearchContextValue>(
    () => ({
      viewMode,
      findType,
      portalSlug,
      portalId,
      userPreferences,
    }),
    [viewMode, findType, portalSlug, portalId, userPreferences]
  );

  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

/**
 * Hook to access search context.
 * Returns null if used outside of SearchContextProvider (allows graceful degradation).
 */
export function useSearchContext(): SearchContextValue | null {
  return useContext(SearchContext);
}

/**
 * Hook to require search context.
 * Throws if used outside of SearchContextProvider.
 */
export function useRequiredSearchContext(): SearchContextValue {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error(
      "useRequiredSearchContext must be used within a SearchContextProvider"
    );
  }
  return context;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get the effective search context for API calls.
 * Provides default values when context is not available.
 */
export function getSearchContextForAPI(context: SearchContextValue | null): {
  viewMode: ViewMode;
  findType: FindType;
} {
  if (!context) {
    return {
      viewMode: "feed",
      findType: null,
    };
  }
  return {
    viewMode: context.viewMode,
    findType: context.findType,
  };
}
