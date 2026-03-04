"use client";

import { useSyncExternalStore } from "react";

/**
 * Lightweight pub/sub for feed visibility.
 *
 * When a detail view is active, DetailViewRouter sets this to false so that
 * feed-resident effects (scroll listeners, polling, MutationObservers) can
 * pause. Uses useSyncExternalStore instead of createContext to avoid RSC
 * bundling issues with transitive context imports.
 */

let visible = true;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return visible;
}

function getServerSnapshot() {
  return true;
}

/** Call from DetailViewRouter to update feed visibility. */
export function setFeedVisible(v: boolean) {
  if (v === visible) return;
  visible = v;
  listeners.forEach((cb) => cb());
}

/** Returns false when the feed is hidden behind a detail view. */
export function useFeedVisible(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
