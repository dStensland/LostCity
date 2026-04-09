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
      // Skip View Transitions API — it silently swallows navigation failures
      // when combined with Next.js concurrent rendering. router.push alone
      // handles the navigation correctly.
      router.push(href);
    },
    [router]
  );

  return { navigate };
}
