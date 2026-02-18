"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Resets scroll position to top when the route or view changes.
 *
 * Next.js preserves scroll when navigating between query-param variations
 * of the same page (e.g. ?view=feed → ?view=find). This component detects
 * meaningful navigation changes and scrolls to top.
 *
 * It ignores filter-only changes (categories, tags, search, etc.) so that
 * applying a filter doesn't jump users back to the top.
 */
export default function ScrollReset() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevRef = useRef<string>("");

  // Keys that represent a "view change" worth scrolling to top for.
  // Filter params (categories, tags, search, etc.) are excluded.
  const view = searchParams.get("view") || "";
  const tab = searchParams.get("tab") || "";
  const type = searchParams.get("type") || "";
  const display = searchParams.get("display") || "";
  // Detail overlays
  const event = searchParams.get("event") || "";
  const spot = searchParams.get("spot") || "";
  const series = searchParams.get("series") || "";
  const festival = searchParams.get("festival") || "";
  const org = searchParams.get("org") || "";

  const navKey = `${pathname}|${view}|${tab}|${type}|${display}|${event}|${spot}|${series}|${festival}|${org}`;

  useEffect(() => {
    if (prevRef.current && prevRef.current !== navKey) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
    prevRef.current = navKey;
  }, [navKey]);

  return null;
}
