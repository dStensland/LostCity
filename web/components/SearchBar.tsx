"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

export default function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("search") || "");

  // Debounced search update
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (query.trim()) {
        params.set("search", query.trim());
      } else {
        params.delete("search");
      }

      // Reset to page 1 when search changes
      params.delete("page");

      const newUrl = params.toString() ? `/?${params.toString()}` : "/";
      router.push(newUrl, { scroll: false });
    }, 300);

    return () => clearTimeout(timer);
  }, [query, router, searchParams]);

  const handleClear = useCallback(() => {
    setQuery("");
  }, []);

  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <svg
          className="h-4 w-4 text-[var(--muted)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search events, venues..."
        className="block w-full pl-11 pr-10 py-3 bg-[var(--night)] border border-[var(--twilight)] rounded-lg text-[var(--cream)] placeholder-[var(--muted)] text-sm focus:outline-none focus:border-[var(--soft)] transition-colors"
      />
      {query && (
        <button
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-4 flex items-center group"
        >
          <svg
            className="h-4 w-4 text-[var(--muted)] group-hover:text-[var(--cream)] transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
