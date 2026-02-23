"use client";

/**
 * QuickLinksBar — contextual shortcut chips that adapt to the current moment.
 * Links to pre-filtered Find views. Access layer, not recommendation engine.
 *
 * Optionally shows count badges from dashboard card data merged into matching links.
 */

import Link from "next/link";
import type { QuickLink, DashboardCard } from "@/lib/city-pulse/types";
import {
  Coffee,
  ForkKnife,
  Barbell,
  Storefront,
  CalendarBlank,
  Ticket,
  BeerStein,
  MoonStars,
  MusicNotes,
  SmileyWink,
  Champagne,
  CalendarCheck,
  Park,
  SunHorizon,
  Bank,
  GameController,
  UsersThree,
  PaintBrush,
} from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

// Map icon name strings to Phosphor components
const ICON_MAP: Record<string, PhosphorIcon> = {
  Coffee,
  ForkKnife,
  Barbell,
  Storefront,
  CalendarBlank,
  Ticket,
  BeerStein,
  MoonStars,
  MusicNotes,
  SmileyWink,
  Champagne,
  CalendarCheck,
  Park,
  SunHorizon,
  Bank,
  GameController,
  UsersThree,
  PaintBrush,
};

interface QuickLinksBarProps {
  links: QuickLink[];
  dashboardCards?: DashboardCard[];
}

/** Extract just the number from a card value like "523 today" or "Open now" */
function extractBadge(card: DashboardCard): string | null {
  const match = card.value.match(/^(\d+)/);
  return match ? match[1] : null;
}

/** Try to match a dashboard card to a quick link by comparing hrefs or icon names */
function findMatchingCard(
  link: QuickLink,
  cards: DashboardCard[],
): DashboardCard | undefined {
  // Match by icon name first (most reliable)
  const byIcon = cards.find((c) => c.icon === link.icon);
  if (byIcon) return byIcon;
  // Fallback: match by href overlap (both point to same filter)
  return cards.find((c) => {
    const linkBase = link.href.split("?")[1] || "";
    const cardBase = c.href.split("?")[1] || "";
    return linkBase && cardBase && linkBase === cardBase;
  });
}

export default function QuickLinksBar({ links, dashboardCards }: QuickLinksBarProps) {
  if (links.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1 -mx-1 px-1">
      {links.map((link) => {
        const IconComponent = ICON_MAP[link.icon];
        const matchedCard = dashboardCards ? findMatchingCard(link, dashboardCards) : undefined;
        const badge = matchedCard ? extractBadge(matchedCard) : null;

        return (
          <Link
            key={link.label}
            href={link.href}
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-[0.875rem] font-semibold border transition-colors hover:brightness-125 active:brightness-90"
            style={{
              color: link.accent_color,
              borderColor: `color-mix(in srgb, ${link.accent_color} 35%, transparent)`,
              backgroundColor: `color-mix(in srgb, ${link.accent_color} 14%, transparent)`,
            }}
          >
            {IconComponent && (
              <IconComponent weight="duotone" className="w-5 h-5" />
            )}
            {link.label}
            {badge && (
              <span
                className="font-mono text-[0.625rem] font-bold tabular-nums px-1.5 py-0.5 rounded-full leading-none"
                style={{
                  backgroundColor: `color-mix(in srgb, ${link.accent_color} 25%, transparent)`,
                }}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
