"use client";

import { SearchContextProvider, type ViewMode, type FindType } from "@/lib/search-context";
import SearchBar from "./SearchBar";

interface SearchBarWrapperProps {
  viewMode: ViewMode;
  findType: FindType;
  portalSlug: string;
  portalId: string;
}

/**
 * Client-side wrapper that provides SearchContext to SearchBar.
 * Used in server components that need to render the search bar with context.
 */
export default function SearchBarWrapper({
  viewMode,
  findType,
  portalSlug,
  portalId,
}: SearchBarWrapperProps) {
  return (
    <SearchContextProvider
      viewMode={viewMode}
      findType={findType}
      portalSlug={portalSlug}
      portalId={portalId}
    >
      <SearchBar />
    </SearchContextProvider>
  );
}
