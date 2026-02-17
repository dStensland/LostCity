"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import SearchOverlay from "./SearchOverlay";

interface HeaderSearchButtonProps {
  portalSlug?: string;
}

export default function HeaderSearchButton({ portalSlug }: HeaderSearchButtonProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const router = useRouter();

  // Global keyboard shortcut for ⌘K (Mac) or Ctrl+K (Windows/Linux)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (portalSlug) {
          router.push(`/${portalSlug}?view=find`);
        } else {
          setIsSearchOpen(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [portalSlug, router]);

  const handleClick = () => {
    if (portalSlug) {
      // Navigate to portal's find view
      router.push(`/${portalSlug}?view=find`);
    } else {
      // Open search overlay (default behavior)
      setIsSearchOpen(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2.5 rounded-lg text-[var(--cream)] hover:text-[var(--neon-amber)] hover:bg-[var(--twilight)]/70 transition-colors active:scale-95 drop-shadow-strong"
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
      {!portalSlug && <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />}
    </>
  );
}
