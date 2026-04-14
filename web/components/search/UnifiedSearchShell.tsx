"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { useSearchStore } from "@/lib/search/store";
import { useVisualViewportHeight } from "@/lib/hooks/useVisualViewportHeight";
import { SearchInput } from "@/components/search/SearchInput";
import { PresearchBody } from "@/components/search/PresearchBody";
import { ResultsBody } from "@/components/search/ResultsBody";
import { useSearchFetch } from "@/components/search/useSearchFetch";

const RECENT_KEY = "lc:search:recent";

function loadRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecents(terms: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(terms.slice(0, 50)));
  } catch {
    // ignore
  }
}

interface UnifiedSearchShellProps {
  portalSlug: string;
  mode: "inline" | "overlay";
}

export function UnifiedSearchShell({ portalSlug, mode }: UnifiedSearchShellProps) {
  const raw = useSearchStore((s) => s.raw);
  const setRaw = useSearchStore((s) => s.setRaw);
  const overlayOpen = useSearchStore((s) => s.overlayOpen);
  const closeOverlay = useSearchStore((s) => s.closeOverlay);
  const [recents, setRecents] = useState<string[]>([]);
  const vpOffset = useVisualViewportHeight();
  const [mounted, setMounted] = useState(false);

  // Hydration-safe client-only flag: setState-in-effect is the canonical
  // React pattern for gating createPortal on post-mount, so the server
  // renders null and the client upgrades after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  // localStorage is only available client-side, so the read has to happen
  // after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setRecents(loadRecents()), []);

  // Inline mode only: seed store from URL on mount
  useEffect(() => {
    if (mode !== "inline") return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q") ?? "";
    if (q) useSearchStore.getState().setRaw(q);
  }, [mode]);

  // Inline mode only: write raw back to URL (debounced 400ms)
  useEffect(() => {
    if (mode !== "inline") return;
    if (typeof window === "undefined") return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const trimmed = raw.trim();
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      const next = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
      window.history.replaceState(window.history.state, "", next);
    }, 400);
    return () => clearTimeout(t);
  }, [mode, raw]);

  // Body-scroll lock in overlay mode
  useEffect(() => {
    if (mode !== "overlay" || !overlayOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mode, overlayOpen]);

  // ESC closes overlay, clear closes inline search
  useEffect(() => {
    if (mode !== "overlay" || !overlayOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (raw) {
          setRaw("");
        } else {
          closeOverlay();
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mode, overlayOpen, raw, setRaw, closeOverlay]);

  useSearchFetch({ portalSlug });

  // Persist query to recents when it passes 3+ chars and stays there
  useEffect(() => {
    if (raw.length < 3) return;
    const t = setTimeout(() => {
      setRecents((current) => {
        if (current[0] === raw) return current;
        const next = [raw, ...current.filter((r) => r !== raw)].slice(0, 50);
        saveRecents(next);
        return next;
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [raw]);

  const handleSelectRecent = (term: string) => setRaw(term);
  const handleClearRecent = () => {
    setRecents([]);
    saveRecents([]);
  };
  const handleRemoveRecent = (term: string) => {
    setRecents((current) => {
      const next = current.filter((r) => r !== term);
      saveRecents(next);
      return next;
    });
  };

  const body = (
    <>
      <SearchInput autoFocus={mode === "overlay" && overlayOpen} />
      <div className="mt-4">
        {raw.length < 2 ? (
          <PresearchBody
            portalSlug={portalSlug}
            mode={mode}
            recentSearches={recents}
            onSelectRecent={handleSelectRecent}
            onClearRecent={handleClearRecent}
            onRemoveRecent={handleRemoveRecent}
          />
        ) : (
          <ResultsBody portalSlug={portalSlug} />
        )}
      </div>
    </>
  );

  if (mode === "inline") {
    return <div className="relative">{body}</div>;
  }

  // Overlay mode
  if (!mounted || !overlayOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-[var(--night)]"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-[var(--twilight)]/60 flex-shrink-0"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <div className="flex-1">
          <SearchInput autoFocus placeholder="Search events, places, classes..." />
        </div>
        <button
          type="button"
          onClick={closeOverlay}
          className="flex-shrink-0 text-sm font-medium text-[var(--coral)] px-2 py-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Close search"
        >
          <X weight="bold" className="w-5 h-5" />
        </button>
      </div>
      <div
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-4"
        style={{
          maxHeight: `calc(100dvh - 72px - ${vpOffset}px - env(safe-area-inset-bottom))`,
        }}
      >
        {raw.length < 2 ? (
          <PresearchBody
            portalSlug={portalSlug}
            mode="overlay"
            recentSearches={recents}
            onSelectRecent={handleSelectRecent}
            onClearRecent={handleClearRecent}
            onRemoveRecent={handleRemoveRecent}
          />
        ) : (
          <ResultsBody portalSlug={portalSlug} />
        )}
      </div>
    </div>,
    document.body
  );
}
