"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

type ViewMode = "events" | "venues" | "map";

const VIEW_STORAGE_KEY = "lostcity-view-preference";

interface Props {
  className?: string;
}

export default function ViewToggle({ className = "" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const hasAppliedStoredPref = useRef(false);

  const urlView = searchParams.get("view") as ViewMode | null;
  const currentView = urlView || "events";

  // On mount, apply stored preference if no view param in URL
  useEffect(() => {
    if (hasAppliedStoredPref.current) return;
    if (urlView) {
      // URL has explicit view, don't override
      hasAppliedStoredPref.current = true;
      return;
    }

    const stored = localStorage.getItem(VIEW_STORAGE_KEY) as ViewMode | null;
    if (stored && stored !== "events") {
      hasAppliedStoredPref.current = true;
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", stored);
      router.replace(pathname + `?${params.toString()}`, { scroll: false });
    } else {
      hasAppliedStoredPref.current = true;
    }
  }, [urlView, searchParams, pathname, router]);

  const setView = useCallback(
    (view: ViewMode) => {
      // Save preference to localStorage
      localStorage.setItem(VIEW_STORAGE_KEY, view);

      const params = new URLSearchParams(searchParams.toString());

      if (view === "events") {
        params.delete("view");
      } else {
        params.set("view", view);
      }

      const query = params.toString();
      router.push(pathname + (query ? `?${query}` : ""), { scroll: false });
    },
    [router, searchParams, pathname]
  );

  const views: { value: ViewMode; label: string; shortLabel: string; icon: React.ReactNode }[] = [
    {
      value: "events",
      label: "Events",
      shortLabel: "List",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      value: "venues",
      label: "Venues",
      shortLabel: "Spots",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      ),
    },
    {
      value: "map",
      label: "Map",
      shortLabel: "Map",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className={`flex items-center gap-1 bg-[var(--twilight)]/50 rounded-lg p-1 ${className}`}>
      {views.map((view) => (
        <button
          key={view.value}
          type="button"
          onClick={() => setView(view.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs font-medium transition-all ${
            currentView === view.value
              ? "bg-[var(--neon-cyan)] text-[var(--void)] shadow-[0_0_10px_hsl(var(--neon-cyan-hsl)/0.4)]"
              : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]"
          }`}
        >
          {view.icon}
          <span className="sm:hidden text-[0.65rem]">{view.shortLabel}</span>
          <span className="hidden sm:inline">{view.label}</span>
        </button>
      ))}
    </div>
  );
}
