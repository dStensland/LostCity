"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const DETAIL_PARAMS = ["event", "spot", "series", "festival", "org"] as const;

export function useDetailNavigation(portalSlug: string) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const navigateTo = useCallback(
    (param: string, value: string | number) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      for (const key of DETAIL_PARAMS) {
        params.delete(key);
      }
      params.set(param, String(value));
      router.push(`/${portalSlug}?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, portalSlug]
  );

  const toEvent = useCallback(
    (id: number) => navigateTo("event", id),
    [navigateTo]
  );

  const toSpot = useCallback(
    (slug: string) => navigateTo("spot", slug),
    [navigateTo]
  );

  const toSeries = useCallback(
    (slug: string) => navigateTo("series", slug),
    [navigateTo]
  );

  const toFestival = useCallback(
    (slug: string) => navigateTo("festival", slug),
    [navigateTo]
  );

  const toOrg = useCallback(
    (slug: string) => navigateTo("org", slug),
    [navigateTo]
  );

  return { toEvent, toSpot, toSeries, toFestival, toOrg };
}
