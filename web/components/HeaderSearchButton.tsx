"use client";

import { useState, useEffect } from "react";
import SearchOverlay from "./SearchOverlay";

export default function HeaderSearchButton() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Global keyboard shortcut for ⌘K (Mac) or Ctrl+K (Windows/Linux)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <button
        onClick={() => setIsSearchOpen(true)}
        className="flex items-center gap-2 p-2.5 rounded-lg text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors active:scale-95"
        aria-label="Search (⌘K)"
      >
        <svg
          className="w-5 h-5"
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
        <kbd className="hidden lg:inline px-1.5 py-0.5 rounded bg-[var(--twilight)]/50 text-[0.65rem] font-mono text-[var(--muted)] border border-[var(--twilight)]">
          ⌘K
        </kbd>
      </button>
      <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
