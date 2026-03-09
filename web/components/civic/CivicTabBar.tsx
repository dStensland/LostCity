"use client";

import type { ElementType } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Lightning, UsersThree, CalendarBlank } from "@phosphor-icons/react";

type TabKey = "act" | "groups" | "calendar";

type Tab = {
  key: TabKey;
  label: string;
  icon: ElementType;
  href: string;
};

function isTabActive(tab: TabKey, pathname: string, searchParams: URLSearchParams, portalSlug: string): boolean {
  const isPortalRoot = pathname === `/${portalSlug}`;
  const viewParam = searchParams.get("view");
  const tabParam = searchParams.get("tab");

  switch (tab) {
    case "act":
      // Active on portal root with no view param or view=feed
      return isPortalRoot && (!viewParam || viewParam === "feed");
    case "groups":
      // Active on /groups sub-route
      return pathname.startsWith(`/${portalSlug}/groups`);
    case "calendar":
      // Active on portal root with view=find and tab=calendar
      return isPortalRoot && viewParam === "find" && tabParam === "calendar";
    default:
      return false;
  }
}

interface CivicTabBarProps {
  portalSlug: string;
  actLabel?: string;
}

export function CivicTabBar({ portalSlug, actLabel = "Act" }: CivicTabBarProps) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams() ?? new URLSearchParams();

  const tabs: Tab[] = [
    {
      key: "act",
      label: actLabel,
      icon: Lightning,
      href: `/${portalSlug}`,
    },
    {
      key: "groups",
      label: "Groups",
      icon: UsersThree,
      href: `/${portalSlug}/groups`,
    },
    {
      key: "calendar",
      label: "Calendar",
      icon: CalendarBlank,
      href: `/${portalSlug}?view=find&tab=calendar`,
    },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-[140] bg-white border-t border-[var(--twilight)] pb-safe"
      aria-label="Civic portal navigation"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-14">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(tab.key, pathname, searchParams, portalSlug);

          return (
            <Link
              key={tab.key}
              href={tab.href}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors"
              style={{
                color: active ? "var(--action-primary)" : "var(--muted)",
              }}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                size={20}
                weight={active ? "fill" : "regular"}
              />
              <span
                className="text-2xs"
                style={{
                  fontFamily: "var(--font-outfit, var(--font-sans, sans-serif))",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export type { CivicTabBarProps };
