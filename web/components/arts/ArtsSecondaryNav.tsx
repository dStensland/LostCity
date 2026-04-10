"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Eye,
  PaintBrush,
  Megaphone,
  UserCircle,
  Warehouse,
} from "@phosphor-icons/react";
import type { ElementType } from "react";
import { buildCommunityHubUrl } from "@/lib/find-url";

interface ArtsTab {
  key: string;
  label: string;
  icon: ElementType;
  href: string;
}

function getArtsTabs(portalSlug: string): ArtsTab[] {
  return [
    {
      key: "whats-on",
      label: "What's On",
      icon: Eye,
      href: `/${portalSlug}`,
    },
    {
      key: "exhibitions",
      label: "Exhibitions",
      icon: PaintBrush,
      href: `/${portalSlug}/exhibitions`,
    },
    {
      key: "open-calls",
      label: "Open Calls",
      icon: Megaphone,
      href: `/${portalSlug}/open-calls`,
    },
    {
      key: "artists",
      label: "Artists",
      icon: UserCircle,
      href: buildCommunityHubUrl({ portalSlug }),
    },
    {
      key: "studios",
      label: "Studios",
      icon: Warehouse,
      href: `/${portalSlug}/studios`,
    },
  ];
}

function isArtsTabActive(
  tabKey: string,
  pathname: string,
  searchParams: URLSearchParams,
  portalSlug: string
): boolean {
  const isRoot = pathname === `/${portalSlug}`;
  switch (tabKey) {
    case "whats-on":
      return isRoot;
    case "exhibitions":
      return pathname === `/${portalSlug}/exhibitions`;
    case "open-calls":
      return pathname === `/${portalSlug}/open-calls`;
    case "artists":
      return pathname === `/${portalSlug}/community-hub` || pathname.startsWith(`/${portalSlug}/community/`);
    case "studios":
      return pathname === `/${portalSlug}/studios`;
    default:
      return false;
  }
}

interface ArtsSecondaryNavProps {
  portalSlug: string;
}

export function ArtsSecondaryNav({ portalSlug }: ArtsSecondaryNavProps) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const tabs = getArtsTabs(portalSlug);

  return (
    <nav
      className="sticky top-14 z-30 border-b border-[var(--twilight)] bg-[var(--void)]/98 backdrop-blur-sm"
      aria-label="Arts portal navigation"
    >
      <div className="flex overflow-x-auto scrollbar-hide px-4 sm:px-0 sm:justify-center">
        <div className="max-w-4xl mx-auto w-full flex items-stretch gap-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isArtsTabActive(tab.key, pathname, searchParams, portalSlug);

            return (
              <Link
                key={tab.key}
                href={tab.href}
                className="relative flex flex-shrink-0 items-center gap-1.5 py-3 px-3 font-mono text-xs uppercase tracking-wider transition-colors"
                style={{
                  color: active ? "var(--action-primary)" : "var(--muted)",
                }}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  size={13}
                  weight={active ? "fill" : "regular"}
                />
                <span>{tab.label}</span>
                {/* Active indicator — copper bottom border */}
                {active && (
                  <span
                    className="absolute bottom-0 inset-x-0 h-[2px]"
                    style={{ background: "var(--action-primary)" }}
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export type { ArtsSecondaryNavProps };
