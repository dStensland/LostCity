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
        className="flex items-center gap-2 p-2 sm:p-2.5 rounded-lg text-[var(--cream)] hover:text-[var(--neon-amber)] hover:bg-[var(--twilight)]/70 transition-colors active:scale-95 drop-shadow-strong"
        aria-label="Search (⌘K)"
      >
        <svg
          className="w-4 h-4 sm:w-5 sm:h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--twilight)]/80 text-[var(--muted)] font-mono text-[0.6rem] border border-[var(--twilight)]">
          <span className="text-[0.55rem]">⌘</span>K
        </kbd>
      </button>
      <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
