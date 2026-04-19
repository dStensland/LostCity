"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

/**
 * Client wrapper providing the EVENTS / PLACES tab bar on the neighborhood
 * detail page. Takes both views as children (server-rendered) and toggles
 * visibility on tab change. URL state is synced via window.history.replaceState
 * per web/CLAUDE.md client-side filter pattern — no router.push.
 *
 * Active-tab underline renders in the neighborhood's accent color (the identity
 * thread that runs from map → hero → detail → nearby chips).
 */
export type NeighborhoodDetailTab = "events" | "places";

interface Props {
  initialTab: NeighborhoodDetailTab;
  accentColor: string;
  eventsContent: ReactNode;
  placesContent: ReactNode;
  eventsCount?: number;
  placesCount?: number;
}

export default function NeighborhoodDetailTabs({
  initialTab,
  accentColor,
  eventsContent,
  placesContent,
  eventsCount,
  placesCount,
}: Props) {
  const [tab, setTab] = useState<NeighborhoodDetailTab>(initialTab);

  const setActive = useCallback((next: NeighborhoodDetailTab) => {
    setTab(next);
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (next === "events") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    const q = params.toString();
    const url = `${window.location.pathname}${q ? `?${q}` : ""}`;
    window.history.replaceState(null, "", url);
  }, []);

  // Sync initial tab if URL changes externally (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tab");
      setTab(t === "places" ? "places" : "events");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <>
      <div
        className="flex items-center gap-8 border-b border-[var(--twilight)]"
        role="tablist"
        aria-label="Neighborhood content type"
      >
        <TabButton
          active={tab === "events"}
          accentColor={accentColor}
          onClick={() => setActive("events")}
          label="Events"
          count={eventsCount}
        />
        <TabButton
          active={tab === "places"}
          accentColor={accentColor}
          onClick={() => setActive("places")}
          label="Places"
          count={placesCount}
        />
      </div>

      <div role="tabpanel" hidden={tab !== "events"}>
        {eventsContent}
      </div>
      <div role="tabpanel" hidden={tab !== "places"}>
        {placesContent}
      </div>
    </>
  );
}

function TabButton({
  active,
  accentColor,
  onClick,
  label,
  count,
}: {
  active: boolean;
  accentColor: string;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="group flex flex-col items-start gap-2 pb-3 -mb-px"
    >
      <div className="flex items-center gap-2">
        <span
          className={`font-mono text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
            active
              ? "text-[var(--cream)]"
              : "text-[var(--muted)] group-hover:text-[var(--soft)]"
          }`}
        >
          {label}
        </span>
        {typeof count === "number" && (
          <span
            className={`font-mono text-2xs tabular-nums transition-colors ${
              active ? "text-[var(--soft)]" : "text-[var(--muted)]"
            }`}
          >
            {count}
          </span>
        )}
      </div>
      <span
        aria-hidden="true"
        className="block w-14 h-[2px] rounded-sm transition-opacity"
        style={{
          backgroundColor: accentColor,
          opacity: active ? 1 : 0,
        }}
      />
    </button>
  );
}
