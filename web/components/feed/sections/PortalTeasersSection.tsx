"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Globe } from "@phosphor-icons/react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

// ── Types ──────────────────────────────────────────────────────────

interface PortalHeadline {
  portal: {
    slug: string;
    label: string;
    accent_color: string;
  };
  headline: string;
  context: string;
  href: string;
}

interface HeadlinesResponse {
  headlines: PortalHeadline[];
}

interface PortalTeasersSectionProps {
  portalSlug: string;
}

// ── Skeleton ───────────────────────────────────────────────────────

function TeaserCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-60 rounded-card bg-[var(--night)] border border-[var(--twilight)] p-4 animate-pulse">
      {/* Badge */}
      <div className="h-3 w-24 bg-[var(--twilight)] rounded mb-3" />
      {/* Headline lines */}
      <div className="h-4 w-full bg-[var(--twilight)] rounded mb-1.5" />
      <div className="h-4 w-4/5 bg-[var(--twilight)] rounded mb-3" />
      {/* Context */}
      <div className="h-3 w-3/5 bg-[var(--twilight)] rounded mb-3" />
      {/* Link */}
      <div className="h-3 w-24 bg-[var(--twilight)] rounded" />
    </div>
  );
}

// ── Card ───────────────────────────────────────────────────────────

function PortalTeaserCard({ item }: { item: PortalHeadline }) {
  const { portal, headline, context, href } = item;
  // Use ScopedStyles for dynamic portal accent color
  const accentClass = createCssVarClass("--teaser-accent", portal.accent_color, "teaser-accent");

  return (
    <div
      className={`flex-shrink-0 w-60 rounded-card bg-[var(--night)] border border-[var(--twilight)] border-l-[3px] overflow-hidden hover-lift transition-transform ${
        accentClass?.className ?? ""
      }`}
      style={{ borderLeftColor: portal.accent_color }}
    >
      <ScopedStyles css={accentClass?.css} />
      <div className="p-4">
        {/* Portal badge */}
        <span
          className="font-mono text-2xs font-bold tracking-[0.12em] uppercase block mb-2.5"
          style={{ color: portal.accent_color }}
        >
          {portal.label}
        </span>

        {/* Headline */}
        <p className="text-base font-semibold text-[var(--cream)] line-clamp-2 mb-1.5 leading-snug">
          {headline}
        </p>

        {/* Context: venue · date */}
        {context && (
          <p className="text-xs text-[var(--muted)] mb-3 truncate">{context}</p>
        )}

        {/* Detail link */}
        <Link
          href={href}
          className="font-mono text-xs inline-flex items-center gap-1 transition-opacity hover:opacity-80"
          style={{ color: portal.accent_color }}
        >
          See details
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}

// ── Section ────────────────────────────────────────────────────────

export function PortalTeasersSection({ portalSlug }: PortalTeasersSectionProps) {
  const { data, isLoading } = useQuery<HeadlinesResponse>({
    queryKey: ["portal-headlines", portalSlug],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8_000);
      try {
        const res = await fetch(`/api/portals/${portalSlug}/headlines`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`headlines fetch failed: ${res.status}`);
        return res.json();
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 60 * 1000, // 60s — matches s-maxage on the route
    gcTime: 5 * 60 * 1000,
  });

  // Graceful degradation: no section if no headlines and not loading
  if (!isLoading && (!data?.headlines || data.headlines.length === 0)) {
    return null;
  }

  return (
    <section className="pb-2">
      <FeedSectionHeader
        title="Around the City"
        priority="secondary"
        accentColor="var(--neon-cyan)"
        icon={<Globe weight="duotone" className="w-5 h-5" />}
      />

      {/* Horizontal carousel */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1 -mx-4 px-4">
        {isLoading ? (
          // Skeleton cards — show 3 placeholders
          <>
            <TeaserCardSkeleton />
            <TeaserCardSkeleton />
            <TeaserCardSkeleton />
          </>
        ) : (
          data?.headlines.map((item) => (
            <div key={item.portal.slug} className="snap-start">
              <PortalTeaserCard item={item} />
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export type { PortalTeasersSectionProps };
