"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { usePortal } from "@/lib/portal-context";
import { useAuth } from "@/lib/auth-context";

interface Props {
  portalSlug?: string;
}

type NavTab = {
  key: "feed" | "your_stuff" | "events" | "spots" | "community" | "happening_now";
  defaultLabel: string;
  href: string;
  authRequired?: boolean;
};

const DEFAULT_TABS: NavTab[] = [
  { key: "feed", defaultLabel: "Highlights", href: "feed" },
  { key: "your_stuff", defaultLabel: "Your Stuff", href: "foryou", authRequired: true },
  { key: "events", defaultLabel: "Events", href: "events" },
  { key: "spots", defaultLabel: "Places", href: "spots" },
  { key: "community", defaultLabel: "Groups", href: "community" },
  { key: "happening_now", defaultLabel: "Stuff around You", href: "happening-now" },
];

export default function MainNav({ portalSlug = "atlanta" }: Props) {
  const { portal } = usePortal();
  const { user } = useAuth();
  const navLabels = (portal.settings?.nav_labels || {}) as Record<string, string | undefined>;

  // Build tabs with custom labels, filtering out auth-required tabs when not logged in
  const TABS = DEFAULT_TABS
    .filter(tab => !tab.authRequired || user)
    .map(tab => ({
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
    if (tab.key === "your_stuff") {
      // Your Stuff links to the foryou page
      return "/foryou";
    }
    // All other tabs use ?view= parameter within the portal
    return `/${portalSlug}?view=${tab.href}`;
  };

  const isActive = (tab: NavTab & { label: string }) => {
    if (tab.key === "your_stuff") {
      return pathname === "/foryou" || pathname === "/saved";
    }
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
        {/* Tabs container with padding for glow */}
        <div className="flex gap-1 py-3 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => {
            const active = isActive(tab);
            return (
              <Link
                key={tab.key}
                href={getHref(tab)}
                className={`nav-tab relative px-4 py-2 rounded-md font-mono text-sm whitespace-nowrap transition-all duration-300 ${
                  active
                    ? "nav-tab-active text-[var(--void)] font-medium"
                    : "text-[var(--muted)] hover:text-[var(--neon-amber)] border border-transparent"
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
