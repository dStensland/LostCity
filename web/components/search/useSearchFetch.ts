"use client";

import { useEffect, useRef } from "react";
import { useSearchStore } from "@/lib/search/store";

const DEBOUNCE_MS = 100;

interface UseSearchFetchArgs {
  portalSlug: string;
}

export function useSearchFetch({ portalSlug }: UseSearchFetchArgs) {
  const raw = useSearchStore((s) => s.raw);
  const startFetch = useSearchStore((s) => s.startFetch);
  const commitResults = useSearchStore((s) => s.commitResults);
  const commitError = useSearchStore((s) => s.commitError);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (raw.trim().length < 2) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    timerRef.current = setTimeout(() => {
      const requestId = crypto.randomUUID();
      startFetch(requestId);

      const controller = new AbortController();
      abortRef.current = controller;

      const url = `/${portalSlug}/api/search/unified?q=${encodeURIComponent(raw)}&limit=20`;
      fetch(url, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => commitResults(data, requestId))
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === "AbortError") return;
          commitError(err instanceof Error ? err.message : "Unknown error", requestId);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [raw, portalSlug, startFetch, commitResults, commitError]);
}
