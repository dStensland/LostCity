"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { usePortal } from "@/lib/portal-context";

interface Props {
  portalSlug?: string;
}

type NavTab = {
  key: "feed" | "events" | "spots" | "community" | "happening_now";
  defaultLabel: string;
  href: string;
};

const DEFAULT_TABS: NavTab[] = [
  { key: "feed", defaultLabel: "Feed", href: "feed" },
  { key: "events", defaultLabel: "Events", href: "events" },
  { key: "spots", defaultLabel: "Spots", href: "spots" },
  { key: "community", defaultLabel: "Community", href: "community" },
  { key: "happening_now", defaultLabel: "Live", href: "happening-now" },
];

export default function MainNav({ portalSlug = "atlanta" }: Props) {
  const { portal } = usePortal();
  const navLabels = (portal.settings?.nav_labels || {}) as Record<string, string | undefined>;

  // Build tabs with custom labels
  const TABS = DEFAULT_TABS.map(tab => ({
    ...tab,
    label: navLabels[tab.key] || tab.defaultLabel,
  }));
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") || "feed";

  const getHref = (tab: NavTab & { label: string }) => {
    if (tab.key === "feed") {
      // Feed is the default view (no query param needed)
      return `/${portalSlug}`;
    }
    // All other tabs use ?view= parameter within the portal
    return `/${portalSlug}?view=${tab.href}`;
  };

  const isActive = (tab: NavTab & { label: string }) => {
    const isPortalPage = pathname === `/${portalSlug}`;
    if (tab.key === "feed") {
      // Feed is the default - active when no view param or view=feed
      return isPortalPage && currentView === "feed";
    }
    if (tab.key === "events") {
      // Events tab is active for events and map views
      return isPortalPage && (currentView === "events" || currentView === "map");
    }
    return isPortalPage && currentView === tab.href;
  };

  return (
    <nav className="sticky top-14 z-30 bg-[var(--night)]/95 backdrop-blur-sm border-b border-[var(--twilight)]/50">
      <div className="max-w-3xl mx-auto px-4">
        <div className="relative">
          {/* Fade gradient on left edge */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[var(--night)]/95 to-transparent z-10 pointer-events-none" />
          {/* Fade gradient on right edge */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--night)]/95 to-transparent z-10 pointer-events-none" />

          <div className="flex gap-1.5 py-2.5 overflow-x-auto scrollbar-hide px-2">
            {TABS.map((tab) => {
              const active = isActive(tab);
              return (
                <Link
                  key={tab.key}
                  href={getHref(tab)}
                  className={`relative px-4 py-2 rounded-lg font-mono text-sm whitespace-nowrap transition-all duration-200 ${
                    active
                      ? "bg-[var(--coral)] text-[var(--void)] font-medium border border-[#8B4513]/50 shadow-[0_0_15px_rgba(232,145,45,0.25),inset_0_1px_0_rgba(255,255,255,0.1)]"
                      : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/60 border border-transparent hover:border-[var(--coral)]/20"
                  }`}
                >
                  {tab.label}
                  {/* Active indicator dot */}
                  {active && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--coral)] shadow-[0_0_4px_var(--coral)]" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
