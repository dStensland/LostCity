"use client";

import Link from "next/link";
import Image from "@/components/SmartImage";
import { HOLIDAYS } from "@/config/holidays";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import FeedSectionHeader, {
  type SectionPriority,
} from "@/components/feed/FeedSectionHeader";
import { Cake } from "@phosphor-icons/react";
import type { FeedSectionData } from "./types";
import { getSeeAllUrl } from "./types";

// ============================================================
// Holiday / themed icon helpers
// ============================================================

function buildHolidayGridIcon(iconPath: string): React.ReactNode {
  if (iconPath.startsWith("/")) {
    const isSvg = iconPath.endsWith(".svg");
    return (
      <Image
        src={iconPath}
        alt=""
        width={32}
        height={32}
        className={`w-full h-full ${isSvg ? "object-contain" : "object-cover"}`}
      />
    );
  }
  return <span className="text-3xl leading-none select-none">{iconPath}</span>;
}

export const THEMED_SECTION_ICONS: Record<
  string,
  { icon: React.ReactNode; color: string; iconBg?: string }
> = {
  // Derived from shared HOLIDAYS config
  ...HOLIDAYS.reduce(
    (acc, h) => {
      acc[h.slug] = {
        color: h.accentColor,
        icon: buildHolidayGridIcon(h.gridIcon || h.icon),
      };
      return acc;
    },
    {} as Record<string, { icon: React.ReactNode; color: string; iconBg?: string }>,
  ),
  // Non-holiday themed sections
  "super-bowl": {
    color: "var(--neon-green)",
    iconBg: "color-mix(in srgb, var(--neon-green) 20%, transparent)",
    icon: (
      <Image
        src="/icons/super-bowl-football.png"
        alt=""
        width={32}
        height={32}
        className="w-full h-full object-cover"
      />
    ),
  },
};

// Holiday card styling — derived from shared holiday config
const HOLIDAY_CARD_STYLES: Record<
  string,
  { gradient: string; glowColor: string; subtitle: string }
> = HOLIDAYS.reduce(
  (acc, h) => {
    acc[h.slug] = {
      gradient: h.gradient,
      glowColor: h.glowColor,
      subtitle: h.subtitle,
    };
    return acc;
  },
  {} as Record<string, { gradient: string; glowColor: string; subtitle: string }>,
);

// Export themed slugs for holiday grouping (consumed by FeedView)
export const THEMED_SLUGS = [
  ...HOLIDAYS.map((h) => h.slug),
  "super-bowl",
];

// ============================================================
// HolidayGrid — renders holiday sections as horizontal cards
// ============================================================

export function HolidayGrid({
  sections,
  portalSlug,
}: {
  sections: FeedSectionData[];
  portalSlug: string;
}) {
  if (sections.length === 0) return null;

  return (
    <section className="mb-4 sm:mb-6">
      <FeedSectionHeader
        title="Holidays and Special Times"
        subtitle="Good excuses to go out and get together"
        priority="tertiary"
        accentColor="var(--neon-amber)"
        icon={
          <Cake
            weight="fill"
            className="w-5 h-5 text-[var(--section-accent)]"
          />
        }
      />

      <div className="space-y-2">
        {sections.map((section) => {
          const themed = THEMED_SECTION_ICONS[section.slug];
          const cardStyle = HOLIDAY_CARD_STYLES[section.slug];
          const accentColor = themed?.color || "var(--coral)";
          const glowColor = cardStyle?.glowColor || accentColor;
          const tag = section.auto_filter?.tags?.[0];
          const filterUrl = tag
            ? `/${portalSlug}?tags=${tag}&view=happening`
            : getSeeAllUrl(section, portalSlug);
          const eventCount = section.events.length;

          return (
            <Link
              key={section.id}
              href={filterUrl}
              className="block relative rounded-2xl overflow-hidden group"
              style={{ background: cardStyle?.gradient || "var(--card-bg)" }}
            >
              {/* Glow accents */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse at 20% 50%, ${glowColor}40 0%, transparent 60%),
                               radial-gradient(ellipse at 80% 80%, ${glowColor}20 0%, transparent 50%)`,
                }}
              />

              <div className="relative flex items-center gap-4 px-5 py-4">
                {/* Icon with glow */}
                <div
                  className="w-14 h-14 flex-shrink-0 rounded-xl flex items-center justify-center overflow-hidden"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${glowColor} 12%, transparent)`,
                    boxShadow: `0 0 20px ${glowColor}15`,
                  }}
                >
                  <div className="w-14 h-14 flex items-center justify-center">
                    {themed?.icon}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-base text-[var(--cream)] group-hover:text-white transition-colors truncate">
                    {section.title}
                  </h4>
                  {cardStyle?.subtitle && (
                    <p className="text-xs text-[var(--soft)] mt-0.5 italic truncate">
                      {cardStyle.subtitle}
                    </p>
                  )}
                </div>

                {/* Event count + arrow */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className="font-mono text-sm font-medium px-2 py-0.5 rounded-full"
                    style={{
                      color: accentColor,
                      backgroundColor: `color-mix(in srgb, ${glowColor} 15%, transparent)`,
                    }}
                  >
                    {eventCount}
                  </span>
                  <svg
                    className="w-5 h-5 text-[var(--muted)] group-hover:text-[var(--cream)] transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================
// Section-level helpers
// ============================================================

const COMMUNITY_SECTION_HINT =
  /\b(get[-\s]?involved|volunteer|activism|civic|community\s+support|community\s+action)\b/i;

export function isCommunityActionSection(section: FeedSectionData): boolean {
  const categories = section.auto_filter?.categories || [];
  const tags = section.auto_filter?.tags || [];
  const titleSlug = `${section.slug} ${section.title}`;

  if (
    categories.some(
      (category) => category === "community" || category === "activism",
    )
  ) {
    return true;
  }

  if (
    tags.some((tag) => /\b(volunteer|activism|community|civic)\b/i.test(tag))
  ) {
    return true;
  }

  return COMMUNITY_SECTION_HINT.test(titleSlug);
}

export function getCommunityIconType(
  section: FeedSectionData,
): "community" | "activism" {
  const categories = section.auto_filter?.categories || [];
  const tags = section.auto_filter?.tags || [];
  const titleSlug = `${section.slug} ${section.title}`.toLowerCase();
  const activismSignal =
    categories.includes("activism") ||
    tags.some((tag) => /\bactivism|civic|protest\b/i.test(tag)) ||
    /activ|civic|organize/.test(titleSlug);
  return activismSignal ? "activism" : "community";
}

function getSectionPriority(section: FeedSectionData): SectionPriority {
  if (
    section.block_type === "featured_carousel" ||
    section.block_type === "hero_banner"
  ) {
    return "primary";
  }
  if (isCommunityActionSection(section)) {
    return "secondary";
  }
  return "tertiary";
}

// ============================================================
// SectionHeader — standard feed section header with "See all"
// ============================================================

export function SectionHeader({
  section,
  portalSlug,
  showCount = true,
  priorityOverride,
}: {
  section: FeedSectionData;
  portalSlug: string;
  showCount?: boolean;
  priorityOverride?: SectionPriority;
}) {
  const eventCount = section.events.length;
  const seeAllUrl = getSeeAllUrl(section, portalSlug);
  const displayTitle = /get active/i.test(section.title)
    ? "Get Involved"
    : section.title;

  let contextDescription = section.description;
  if (!contextDescription && showCount && eventCount > 0) {
    contextDescription = `${eventCount} event${eventCount !== 1 ? "s" : ""}`;
  }

  const themedConfig = THEMED_SECTION_ICONS[section.slug];
  const sectionStyle = section.style as { accent_color?: string } | null;
  const isCommunitySection = isCommunityActionSection(section);
  const isGetInvolvedSection = /get involved|get active/i.test(section.title);
  if (isCommunitySection && isGetInvolvedSection) {
    contextDescription = "Get Involved";
  }
  const communityIconType = getCommunityIconType(section);
  const communityAccentColor = getCategoryColor(communityIconType);
  const accentColor =
    themedConfig?.color ||
    sectionStyle?.accent_color ||
    (isCommunitySection ? communityAccentColor : undefined);

  const priority = priorityOverride || getSectionPriority(section);
  const communityIcon = isCommunitySection ? (
    <CategoryIcon
      type={communityIconType}
      size={18}
      glow="none"
      className="text-[var(--section-accent)]"
    />
  ) : undefined;

  return (
    <FeedSectionHeader
      title={displayTitle}
      subtitle={contextDescription || undefined}
      priority={priority}
      accentColor={accentColor}
      icon={themedConfig?.icon || communityIcon}
      badge={isCommunitySection ? "Get Involved" : undefined}
      seeAllHref={seeAllUrl}
      seeAllLabel={isGetInvolvedSection ? "Get Involved" : undefined}
    />
  );
}
