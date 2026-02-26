"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import { CATEGORIES } from "@/lib/search-constants";
import { formatGenre } from "@/lib/series-utils";

export default function ActiveFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get("search");
  const categories = useMemo(
    () => searchParams.get("categories")?.split(",").filter(Boolean) || [],
    [searchParams]
  );
  const genres = useMemo(
    () => searchParams.get("genres")?.split(",").filter(Boolean) || [],
    [searchParams]
  );
  const isFree = searchParams.get("free") === "true";
  const dateFilter = searchParams.get("date");
  const venueId = searchParams.get("venue");

  const hasFilters = search || categories.length > 0 || genres.length > 0 || isFree || dateFilter || venueId;

  const removeFilter = useCallback(
    (key: string, value?: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (key === "categories" && value) {
        const newCats = categories.filter((c) => c !== value);
        if (newCats.length > 0) {
          params.set("categories", newCats.join(","));
        } else {
          params.delete("categories");
        }
      } else if (key === "genres" && value) {
        const newGenres = genres.filter((g) => g !== value);
        if (newGenres.length > 0) {
          params.set("genres", newGenres.join(","));
        } else {
          params.delete("genres");
        }
      } else {
        params.delete(key);
      }

      params.delete("page");
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.push(newUrl, { scroll: false });
    },
    [router, pathname, searchParams, categories, genres]
  );

  const clearAll = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [router, pathname]);

  if (!hasFilters) return null;

  // Get display names
  const getCategoryLabel = (id: string) => {
    const cat = CATEGORIES.find((c) => c.value === id);
    return cat?.label || id;
  };

  const getDateLabel = (date: string) => {
    switch (date) {
      case "today": return "Today";
      case "weekend": return "The weekend";
      case "week": return "This Week";
      case "now": return "Live";
      default: return date;
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap py-2">
      <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Filters:</span>

      {search && (
        <button
          type="button"
          onClick={() => removeFilter("search")}
          className="active-filter-chip"
        >
          &ldquo;{search}&rdquo;
          <XIcon />
        </button>
      )}

      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => removeFilter("categories", cat)}
          className="active-filter-chip"
        >
          {getCategoryLabel(cat)}
          <XIcon />
        </button>
      ))}

      {genres.map((genre) => (
        <button
          key={genre}
          type="button"
          onClick={() => removeFilter("genres", genre)}
          className="active-filter-chip"
        >
          {formatGenre(genre)}
          <XIcon />
        </button>
      ))}

      {isFree && (
        <button
          type="button"
          onClick={() => removeFilter("free")}
          className="active-filter-chip"
        >
          Free
          <XIcon />
        </button>
      )}

      {dateFilter && (
        <button
          type="button"
          onClick={() => removeFilter("date")}
          className="active-filter-chip"
        >
          {getDateLabel(dateFilter)}
          <XIcon />
        </button>
      )}

      {venueId && (
        <button
          type="button"
          onClick={() => removeFilter("venue")}
          className="active-filter-chip"
        >
          Venue
          <XIcon />
        </button>
      )}

      <button
        type="button"
        onClick={clearAll}
        className="font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] transition-colors ml-1"
      >
        Clear all
      </button>
    </div>
  );
}

function XIcon() {
  return (
    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
