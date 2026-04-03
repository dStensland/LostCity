"use client";

import { useSyncExternalStore, useMemo } from "react";

// ─── Custom event for replaceState-driven URL changes ────────────────────────
// Next.js useSearchParams only reacts to router.push/replace navigations.
// When we use window.history.replaceState (to avoid Suspense), useSearchParams
// stays stale. This module provides a reactive alternative:
//
//   1. Call `dispatchReplaceState()` after every replaceState call.
//   2. Use `useReplaceStateParams()` instead of `useSearchParams()` in hooks
//      that need to react to filter changes (useTimeline, useEventFilters, etc.).
//
// The hook also listens for `popstate` (back/forward nav) so browser history
// navigation still triggers re-renders.

const REPLACE_STATE_EVENT = "lostcity:replacestate";

/** Dispatch after calling window.history.replaceState to notify subscribers. */
export function dispatchReplaceState(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(REPLACE_STATE_EVENT));
  }
}

// ─── useSyncExternalStore integration ────────────────────────────────────────
// We use useSyncExternalStore to avoid the tearing issues that useState +
// useEffect would have. The "store" is window.location.search.

function subscribe(callback: () => void): () => void {
  window.addEventListener(REPLACE_STATE_EVENT, callback);
  window.addEventListener("popstate", callback);
  return () => {
    window.removeEventListener(REPLACE_STATE_EVENT, callback);
    window.removeEventListener("popstate", callback);
  };
}

function getSnapshot(): string {
  return window.location.search;
}

function getServerSnapshot(): string {
  return "";
}

/**
 * Reactive URL search params that respond to replaceState changes.
 *
 * Drop-in replacement for `useSearchParams()` in hooks that need to react
 * to filter state written via `window.history.replaceState`.
 *
 * Returns a URLSearchParams instance (new on every URL change).
 */
export function useReplaceStateParams(): URLSearchParams {
  const search = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Memo so consumers don't get a new object reference when the URL hasn't changed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => new URLSearchParams(search), [search]);
}

/**
 * Convenience: get a stable search string for use as React Query keys.
 * Only triggers re-render when the search string actually changes.
 */
export function useReplaceStateSearch(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
