"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface HeaderSearchButtonProps {
  portalSlug?: string;
}

export default function HeaderSearchButton({ portalSlug }: HeaderSearchButtonProps) {
  const router = useRouter();

  const destination = portalSlug ? `/${portalSlug}?view=happening` : null;

  // Global keyboard shortcut for ⌘K (Mac) or Ctrl+K (Windows/Linux)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (destination) {
          router.push(destination);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [destination, router]);

  const handleClick = () => {
    if (destination) {
      router.push(destination);
    }
  };

  return (
    <>
      {/* Desktop: visible search pill — acts as a clickable prompt to Find view */}
      <button
        onClick={handleClick}
        className="hidden sm:flex items-center gap-2 h-8 pl-3 pr-2 rounded-full bg-[var(--twilight)]/60 border border-[var(--twilight)] hover:border-[var(--soft)]/40 hover:bg-[var(--twilight)]/80 transition-all group"
        aria-label="Search events, places, and more"
      >
        <svg
          className="w-3.5 h-3.5 text-[var(--muted)] group-hover:text-[var(--soft)] transition-colors flex-shrink-0"
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
        <span className="font-mono text-xs text-[var(--muted)] group-hover:text-[var(--soft)] transition-colors whitespace-nowrap">
          Search...
        </span>
        <kbd className="ml-1 px-1.5 py-0.5 rounded bg-[var(--night)] border border-[var(--twilight)] font-mono text-2xs text-[var(--muted)] leading-none">
          ⌘K
        </kbd>
      </button>

      {/* Mobile: icon-only button */}
      <button
        onClick={handleClick}
        className="sm:hidden flex items-center justify-center min-w-[44px] min-h-[44px] p-2.5 rounded-lg text-[var(--cream)] hover:text-[var(--soft)] hover:bg-[var(--twilight)]/70 transition-colors active:scale-95"
        aria-label="Search"
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
            strokeWidth={2.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </button>
    </>
  );
}
