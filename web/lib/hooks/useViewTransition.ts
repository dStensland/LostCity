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
        document.startViewTransition(() => {
          router.push(href);
        });
      } else {
        router.push(href);
      }
    },
    [router]
  );

  return { navigate };
}
