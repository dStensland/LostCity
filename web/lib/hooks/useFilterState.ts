"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Read a single filter param from URL (supports back/forward).
 * Write via replaceState (fast, no Suspense thrash).
 */
export function useFilterParam(key: string): [string | null, (value: string | null) => void] {
  const searchParams = useSearchParams();
  const value = searchParams?.get(key) ?? null;

  const setValue = useCallback(
    (newValue: string | null) => {
      const url = new URL(window.location.href);
      if (newValue === null || newValue === "") {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, newValue);
      }
      window.history.replaceState(null, "", url.toString());
    },
    [key]
  );

  return [value, setValue];
}

/**
 * Read multiple filter params at once.
 * Write updates all specified params atomically.
 */
export function useFilterParams<K extends string>(
  keys: readonly K[]
): [Record<K, string | null>, (updates: Partial<Record<K, string | null>>) => void] {
  const searchParams = useSearchParams();

  const values = {} as Record<K, string | null>;
  for (const key of keys) {
    values[key] = searchParams?.get(key) ?? null;
  }

  const setValues = useCallback(
    (updates: Partial<Record<K, string | null>>) => {
      const url = new URL(window.location.href);
      for (const [key, val] of Object.entries(updates) as [K, string | null][]) {
        if (val === null || val === "") {
          url.searchParams.delete(key);
        } else {
          url.searchParams.set(key, val);
        }
      }
      window.history.replaceState(null, "", url.toString());
    },
    []
  );

  return [values, setValues];
}
