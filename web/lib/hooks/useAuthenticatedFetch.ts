"use client";

import { useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";

type FetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  timeout?: number;
  requireAuth?: boolean;
  showErrorToast?: boolean;
};

type AuthFetchResult<T> = {
  data: T | null;
  error: string | null;
  status: number;
};

/**
 * Hook for making authenticated API calls with proper error handling.
 *
 * Features:
 * - Automatic timeout (default 10s)
 * - Redirects to login if unauthenticated
 * - Shows error toasts
 * - Handles common error cases
 *
 * Usage:
 * ```
 * const { authFetch } = useAuthenticatedFetch();
 *
 * const result = await authFetch<{ success: boolean }>("/api/rsvp", {
 *   method: "POST",
 *   body: { event_id: 123, status: "going" },
 * });
 *
 * if (result.error) {
 *   // Handle error
 * } else {
 *   // Use result.data
 * }
 * ```
 */
export function useAuthenticatedFetch() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  // Use ref to track latest authLoading value to avoid stale closures in the wait loop
  const authLoadingRef = useRef(authLoading);
  useEffect(() => {
    authLoadingRef.current = authLoading;
  }, [authLoading]);

  const authFetch = useCallback(
    async <T = unknown>(
      url: string,
      options: FetchOptions = {}
    ): Promise<AuthFetchResult<T>> => {
      const {
        timeout = 10000,
        requireAuth = true,
        showErrorToast = true,
        body,
        ...fetchOptions
      } = options;

      // Check auth if required
      if (requireAuth && !authLoadingRef.current && !user) {
        router.push(`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        return { data: null, error: "Please log in to continue", status: 401 };
      }

      // Wait for auth to settle if still loading
      if (authLoadingRef.current && requireAuth) {
        // Wait up to 3 seconds for auth to settle
        let waited = 0;
        while (waited < 3000) {
          await new Promise((r) => setTimeout(r, 100));
          waited += 100;
          // Use ref to get latest value, not stale closure value
          if (!authLoadingRef.current) break;
        }
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...fetchOptions.headers,
          },
          ...(body !== undefined && { body: JSON.stringify(body) }),
        });

        clearTimeout(timeoutId);

        // Handle common HTTP errors
        if (!response.ok) {
          let errorMessage = "Something went wrong";

          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            // Response wasn't JSON
          }

          // Handle specific status codes
          if (response.status === 401) {
            if (requireAuth) {
              router.push(`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`);
            }
            errorMessage = "Please log in to continue";
          } else if (response.status === 403) {
            errorMessage = "You don't have permission to do that";
          } else if (response.status === 404) {
            errorMessage = "Not found";
          } else if (response.status >= 500) {
            errorMessage = "Server error - please try again";
          }

          if (showErrorToast) {
            showToast(errorMessage, "error");
          }

          return { data: null, error: errorMessage, status: response.status };
        }

        // Parse successful response
        const data = await response.json();
        return { data: data as T, error: null, status: response.status };
      } catch (error) {
        let errorMessage = "Request failed";

        if (error instanceof Error) {
          if (error.name === "AbortError") {
            errorMessage = "Request timed out - please try again";
          } else if (error.message.includes("fetch")) {
            errorMessage = "Network error - check your connection";
          } else {
            errorMessage = error.message;
          }
        }

        if (showErrorToast) {
          showToast(errorMessage, "error");
        }

        return { data: null, error: errorMessage, status: 0 };
      }
    },
    [user, router, showToast]
  );

  return { authFetch, user, isLoading: authLoading };
}
