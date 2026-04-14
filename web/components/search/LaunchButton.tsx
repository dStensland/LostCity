"use client";

import { useEffect } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useSearchStore } from "@/lib/search/store";

export function LaunchButton() {
  const openOverlay = useSearchStore((s) => s.openOverlay);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openOverlay();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [openOverlay]);

  return (
    <>
      {/* Desktop: compact pill */}
      <button
        type="button"
        onClick={openOverlay}
        className="hidden md:flex items-center gap-2 h-8 px-3 rounded-full border border-[var(--twilight)] bg-[var(--twilight)]/60 hover:bg-[var(--twilight)]/80 hover:border-[var(--soft)]/40 transition-colors"
        aria-label="Open search"
        aria-keyshortcuts="Meta+k Control+k"
      >
        <MagnifyingGlass weight="duotone" className="w-3.5 h-3.5 text-[var(--muted)]" />
        <span className="font-mono text-xs text-[var(--muted)]">Search</span>
        <kbd className="px-1.5 py-0.5 rounded bg-[var(--night)] border border-[var(--twilight)] font-mono text-2xs text-[var(--muted)] leading-none">⌘K</kbd>
      </button>

      {/* Mobile: icon button */}
      <button
        type="button"
        onClick={openOverlay}
        className="md:hidden flex items-center justify-center min-w-[44px] min-h-[44px] p-2.5 rounded-lg text-[var(--cream)] hover:bg-[var(--twilight)]/70 transition-colors"
        aria-label="Open search"
      >
        <MagnifyingGlass weight="duotone" className="w-5 h-5" />
      </button>
    </>
  );
}
