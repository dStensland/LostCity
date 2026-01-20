"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { usePortal } from "@/lib/portal-context";

interface Props {
  portalSlug?: string;
}

type NavTab = {
  key: "feed" | "events" | "spots" | "happening_now";
  defaultLabel: string;
  href: string;
  isView: boolean;
};

const DEFAULT_TABS: NavTab[] = [
  { key: "feed", defaultLabel: "Feed", href: "feed", isView: true },
  { key: "events", defaultLabel: "Events", href: "events", isView: true },
  { key: "spots", defaultLabel: "Spots", href: "spots", isView: true },
  { key: "happening_now", defaultLabel: "Happening Now", href: "happening-now", isView: true },
];

export default function MainNav({ portalSlug = "atlanta" }: Props) {
  const { portal } = usePortal();
  const navLabels = portal.settings?.nav_labels || {};

  // Build tabs with custom labels
  const TABS = DEFAULT_TABS.map(tab => ({
    ...tab,
    label: navLabels[tab.key] || tab.defaultLabel,
  }));
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") || "events";

  const getHref = (tab: NavTab & { label: string }) => {
    if (tab.isView) {
      if (tab.key === "events") {
        return `/${portalSlug}`;
      }
      return `/${portalSlug}?view=${tab.href}`;
    }
    return tab.href;
  };

  const isActive = (tab: NavTab & { label: string }) => {
    if (tab.isView) {
      // Check if we're on the portal page with this view
      const isPortalPage = pathname === `/${portalSlug}` || pathname === "/atlanta";
      if (tab.key === "events") {
        // Events tab is active for both list and map views
        return isPortalPage && (currentView === "events" || currentView === "map");
      }
      return isPortalPage && currentView === tab.href;
    }
    // For non-view tabs, check pathname
    return pathname === tab.href || pathname.startsWith(tab.href + "/");
  };

  return (
    <nav className="sticky top-14 z-30 bg-[var(--night)]/95 backdrop-blur-sm border-b border-[var(--twilight)]/50">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex gap-1 py-2 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => {
            const active = isActive(tab);
            return (
              <Link
                key={tab.key}
                href={getHref(tab)}
                className={`px-4 py-2 rounded-lg font-mono text-sm whitespace-nowrap transition-all ${
                  active
                    ? "bg-[var(--coral)] text-white font-medium shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
