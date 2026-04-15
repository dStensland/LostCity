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

const URL_CHANGE_EVENT = "lostcity:urlchange";

// ─── Patch History API to auto-dispatch on all URL changes ───────────────────
// Next.js router.push uses pushState, filter writes use replaceState.
// We patch both so every URL change fires our custom event automatically.
// This eliminates the need to manually call dispatchReplaceState() after
// every replaceState call (though it still works for backward compat).
if (typeof window !== "undefined" && !(window as unknown as Record<string, boolean>).__lc_history_patched) {
  (window as unknown as Record<string, boolean>).__lc_history_patched = true;

  const origPush = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);

  history.pushState = function (...args: Parameters<typeof origPush>) {
    origPush(...args);
    // Defer so the event fires after React's current rendering phase completes.
    // Synchronous dispatch inside pushState violates React 19's concurrent
    // rendering rules (useInsertionEffect must not schedule updates).
    queueMicrotask(() => window.dispatchEvent(new Event(URL_CHANGE_EVENT)));
  };

  history.replaceState = function (...args: Parameters<typeof origReplace>) {
    origReplace(...args);
    queueMicrotask(() => window.dispatchEvent(new Event(URL_CHANGE_EVENT)));
  };
}

/** @deprecated — History API is now auto-patched. Kept for backward compat. */
export function dispatchReplaceState(): void {
  // No-op — the patched replaceState already dispatches automatically.
  // Kept as export so existing call sites don't break.
}

// ─── useSyncExternalStore integration ────────────────────────────────────────
// We use useSyncExternalStore to avoid the tearing issues that useState +
// useEffect would have. The "store" is window.location.search.

function subscribe(callback: () => void): () => void {
  window.addEventListener(URL_CHANGE_EVENT, callback);
  window.addEventListener("popstate", callback);
  return () => {
    window.removeEventListener(URL_CHANGE_EVENT, callback);
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
   
  return useMemo(() => new URLSearchParams(search), [search]);
}

/**
 * Convenience: get a stable search string for use as React Query keys.
 * Only triggers re-render when the search string actually changes.
 */
export function useReplaceStateSearch(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
