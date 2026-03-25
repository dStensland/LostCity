"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * Wraps router.push() in View Transitions API when supported.
 * Progressive enhancement: Chrome/Edge get crossfade, others get normal navigation.
 */
export function useViewTransition() {
  const router = useRouter();

  const navigate = useCallback(
    (href: string) => {
      if (
        typeof document !== "undefined" &&
        "startViewTransition" in document
      ) {
        try {
          document.startViewTransition(() => {
            router.push(href);
          });
        } catch {
          // Transition may throw if another is already in progress.
          // Fall back to normal navigation.
          router.push(href);
        }
      } else {
        router.push(href);
      }
    },
    [router]
  );

  return { navigate };
}
