"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { usePortalOptional, DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";
import { useAuth } from "@/lib/auth-context";
import { useRealtimeFriendRequests } from "@/lib/hooks/useRealtimeFriendRequests";
import { getPortalNavLabel } from "@/lib/nav-labels";

interface Props {
  portalSlug?: string;
}

type NavTab = {
  key: "feed" | "explore" | "plans" | "people";
  defaultLabel: string;
  href: string;
  authRequired?: boolean;
};

const DEFAULT_TABS: NavTab[] = [
  { key: "feed", defaultLabel: "Discover", href: "" },
  { key: "explore", defaultLabel: "Explore", href: "explore" },
  { key: "plans", defaultLabel: "Plans", href: "plans", authRequired: true },
  { key: "people", defaultLabel: "People", href: "foryou", authRequired: true },
];

export default function MainNav({ portalSlug = DEFAULT_PORTAL_SLUG }: Props) {
  const portalContext = usePortalOptional();
  const { user } = useAuth();
  const navLabels = (portalContext?.portal?.settings?.nav_labels || {}) as Record<string, string | undefined>;
  const { pendingCount } = useRealtimeFriendRequests();

  // Build tabs with custom labels, filtering out auth-required tabs when not logged in
  const TABS = DEFAULT_TABS
    .filter(tab => !tab.authRequired || user)
    .map(tab => ({
      ...tab,
      label: tab.key === "feed"
        ? getPortalNavLabel(navLabels, "feed", tab.defaultLabel)
        : navLabels[tab.key] || tab.defaultLabel,
    }));

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getHref = (tab: NavTab & { label: string }) => {
    if (tab.key === "feed") return `/${portalSlug}`;
    if (tab.key === "people") return "/foryou";
    return `/${portalSlug}/${tab.href}`;
  };

  const isActive = (tab: NavTab & { label: string }) => {
    if (tab.key === "people") return pathname === "/foryou";
    if (tab.key === "feed") return pathname === `/${portalSlug}` && !searchParams.get("view");
    if (tab.key === "explore") return pathname.startsWith(`/${portalSlug}/explore`);
    if (tab.key === "plans") return pathname.startsWith(`/${portalSlug}/plans`);
    return false;
  };

  return (
    <nav className="sticky top-14 z-30 bg-[var(--night)]/95 backdrop-blur-sm border-b border-[var(--twilight)]/50">
      <div className="max-w-3xl mx-auto px-4">
        {/* Tabs container with padding for glow */}
        <div className="flex gap-1 py-3 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => {
            const active = isActive(tab);
            const showBadge = tab.key === "people" && pendingCount > 0;
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
                {showBadge && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--coral)] text-[var(--void)] text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
