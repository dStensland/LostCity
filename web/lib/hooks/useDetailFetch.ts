"use client";

import { useState, useEffect, useCallback } from "react";

interface UseDetailFetchOptions {
  timeout?: number;      // default 10000
  maxRetries?: number;   // default 2
  retryDelay?: number;   // default 500
  entityLabel?: string;  // "event", "venue" — for error messages
}

interface UseDetailFetchResult<T> {
  data: T | null;
  status: "loading" | "ready" | "error";
  error: string | null;
  retry: () => void;
}

export function useDetailFetch<T>(
  url: string | null,
  options: UseDetailFetchOptions = {}
): UseDetailFetchResult<T> {
  const {
    timeout = 10000,
    maxRetries = 2,
    retryDelay = 500,
    entityLabel = "data",
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    url ? "loading" : "ready"
  );
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!url) {
      setData(null);
      setStatus("ready");
      setError(null);
      return;
    }

    let cancelled = false;
    let activeController: AbortController | null = null;

    async function doFetch() {
      setStatus("loading");
      setError(null);

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (cancelled) return;

        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, retryDelay * attempt));
          if (cancelled) return;
        }

        // Per-attempt controller — never reuse an already-aborted controller
        activeController = new AbortController();
        let timedOut = false;
        const timeoutId = setTimeout(() => {
          timedOut = true;
          activeController?.abort();
        }, timeout);

        try {
          const res = await fetch(url as string, { signal: activeController.signal });
          clearTimeout(timeoutId);

          if (cancelled) return;

          if (!res.ok) {
            // Retryable server errors — try again
            if (
              (res.status === 503 || res.status === 429 || res.status >= 500) &&
              attempt < maxRetries
            ) {
              continue;
            }
            // Non-retryable errors (404, 400, etc.) — fail immediately
            const msg = res.status === 404
              ? `${entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)} not found`
              : `Failed to load ${entityLabel} (${res.status})`;
            setError(msg);
            setStatus("error");
            return;
          }

          const json = await res.json();
          if (cancelled) return;

          setData(json as T);
          setStatus("ready");
          return;
        } catch (err) {
          clearTimeout(timeoutId);
          if (cancelled) return;
          if (timedOut) {
            // Timeout on this attempt — retry if we have attempts left
            if (attempt < maxRetries) continue;
            setError(`Request timed out loading ${entityLabel}`);
            setStatus("error");
            return;
          }
          if (attempt === maxRetries) {
            setError(
              err instanceof Error ? err.message : `Failed to load ${entityLabel}`
            );
            setStatus("error");
          }
        }
      }
    }

    doFetch();

    return () => {
      cancelled = true;
      activeController?.abort();
    };
  }, [url, retryCount, maxRetries, retryDelay, timeout, entityLabel]);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  return { data, status, error, retry };
}
