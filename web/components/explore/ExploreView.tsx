"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "@/components/SmartImage";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import CategoryIcon from "@/components/CategoryIcon";
import type { ExploreVenue, ExploreCollection } from "@/lib/explore-constants";

type ExploreData = {
  featured: ExploreVenue[];
  collections: ExploreCollection[];
};

// Category icon mapping
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  museums_galleries: <CategoryIcon type="art" size={18} glow="none" />,
  performing_arts: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  ),
  parks_outdoors: <CategoryIcon type="outdoors" size={18} glow="none" />,
  landmarks_attractions: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  tours_experiences: <CategoryIcon type="tours" size={18} glow="none" />,
  food_culture: <CategoryIcon type="food_drink" size={18} glow="none" />,
  hidden_gems: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
};

export default function ExploreView({ portalSlug }: { portalSlug: string }) {
  const [data, setData] = useState<ExploreData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/portals/${portalSlug}/explore`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // Silently fail - UI shows empty state
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [portalSlug]);

  const scrollToCategory = (categoryId: string) => {
    setActiveCategory(categoryId);
    const el = sectionRefs.current.get(categoryId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (isLoading) {
    return <ExploreSkeleton />;
  }

  if (!data || (data.featured.length === 0 && data.collections.length === 0)) {
    return (
      <div className="py-16 text-center">
        <p className="text-[var(--muted)] font-mono text-sm">
          Explore content is coming soon
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero: Featured venue */}
      {data.featured.length > 0 && (
        <ExploreHero venue={data.featured[0]} portalSlug={portalSlug} />
      )}

      {/* Category nav */}
      {data.collections.length > 1 && (
        <ExploreCategoryNav
          collections={data.collections}
          activeCategory={activeCategory}
          onSelect={scrollToCategory}
        />
      )}

      {/* Category sections */}
      {data.collections.map((collection) => (
        <div
          key={collection.category.id}
          ref={(el) => {
            if (el) sectionRefs.current.set(collection.category.id, el);
          }}
        >
          <ExploreCategorySection
            collection={collection}
            portalSlug={portalSlug}
          />
        </div>
      ))}
    </div>
  );
}

// ============================================
// HERO - Featured venue spotlight
// ============================================

function ExploreHero({ venue, portalSlug }: { venue: ExploreVenue; portalSlug: string }) {
  const imageUrl = venue.hero_image_url || venue.image_url;

  return (
    <Link
      href={`/${portalSlug}?spot=${venue.slug}`}
      className="block relative rounded-2xl overflow-hidden group"
    >
      {/* Image */}
      <div className="relative aspect-[16/9] sm:aspect-[21/9] bg-[var(--dusk)]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={venue.name}
            fill
            sizes="(max-width: 768px) 100vw, 800px"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--twilight)] to-[var(--void)]" />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded-full bg-[var(--coral)]/90 text-[var(--void)] font-mono text-[0.6rem] font-semibold uppercase tracking-wider">
              Featured
            </span>
            {venue.neighborhood && (
              <span className="font-mono text-xs text-white/70">
                {venue.neighborhood}
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white group-hover:text-[var(--coral)] transition-colors">
            {venue.name}
          </h2>
          {(venue.explore_blurb || venue.short_description) && (
            <p className="text-sm text-white/80 mt-1 line-clamp-2 max-w-lg">
              {venue.explore_blurb || venue.short_description}
            </p>
          )}
          {venue.next_event_title && (
            <p className="font-mono text-xs text-[var(--coral)] mt-2">
              Now: {venue.next_event_title}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

// ============================================
// CATEGORY NAV - Horizontal scrolling pills
// ============================================

function ExploreCategoryNav({
  collections,
  activeCategory,
  onSelect,
}: {
  collections: ExploreCollection[];
  activeCategory: string | null;
  onSelect: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4"
    >
      {collections.map((collection) => {
        const isActive = activeCategory === collection.category.id;
        const icon = CATEGORY_ICONS[collection.category.id];
        return (
          <button
            key={collection.category.id}
            onClick={() => onSelect(collection.category.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs whitespace-nowrap transition-all flex-shrink-0 border ${
              isActive
                ? "bg-[var(--cream)] text-[var(--void)] border-[var(--cream)] font-semibold shadow-md"
                : "bg-[var(--card-bg)] text-[var(--soft)] border-[var(--twilight)] hover:border-[var(--coral)]/40 hover:text-[var(--cream)]"
            }`}
          >
            <span className={isActive ? "text-[var(--void)]" : "text-[var(--muted)]"}>
              {icon}
            </span>
            {collection.category.label}
            <span className={`text-[0.6rem] ${isActive ? "text-[var(--void)]/60" : "text-[var(--muted)]"}`}>
              {collection.venues.length}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================
// CATEGORY SECTION - Group of venue cards
// ============================================

function ExploreCategorySection({
  collection,
  portalSlug,
}: {
  collection: ExploreCollection;
  portalSlug: string;
}) {
  const { category, venues } = collection;
  const icon = CATEGORY_ICONS[category.id];

  return (
    <section>
      <FeedSectionHeader
        title={category.label}
        subtitle={category.description}
        priority="tertiary"
        icon={
          <span className="text-[var(--section-accent)]">{icon}</span>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {venues.map((venue) => (
          <ExploreVenueCard
            key={venue.id}
            venue={venue}
            portalSlug={portalSlug}
          />
        ))}
      </div>
    </section>
  );
}

// ============================================
// VENUE CARD - Editorial venue card
// ============================================

function ExploreVenueCard({
  venue,
  portalSlug,
}: {
  venue: ExploreVenue;
  portalSlug: string;
}) {
  const imageUrl = venue.hero_image_url || venue.image_url;

  return (
    <Link
      href={`/${portalSlug}?spot=${venue.slug}`}
      className="group block rounded-xl border border-[var(--twilight)] overflow-hidden bg-[var(--card-bg)] hover:border-[var(--coral)]/40 transition-all hover:shadow-lg"
    >
      {/* Image */}
      <div className="relative aspect-[16/9] bg-[var(--dusk)]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={venue.name}
            fill
            sizes="(max-width: 640px) 100vw, 400px"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--twilight)]/50 to-[var(--void)]/50 flex items-center justify-center">
            <span className="text-3xl opacity-30">
              {CATEGORY_ICONS[venue.explore_category || ""] || "📍"}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors truncate">
              {venue.name}
            </h3>
            {venue.neighborhood && (
              <p className="font-mono text-[0.65rem] text-[var(--muted)] mt-0.5">
                {venue.neighborhood}
              </p>
            )}
          </div>
        </div>

        {(venue.explore_blurb || venue.short_description) && (
          <p className="text-xs text-[var(--soft)] mt-1.5 line-clamp-2">
            {venue.explore_blurb || venue.short_description}
          </p>
        )}

        {/* Live data */}
        <div className="flex items-center gap-2 mt-2">
          {venue.next_event_title && (
            <span className="font-mono text-[0.6rem] text-[var(--coral)] bg-[var(--coral)]/10 px-2 py-0.5 rounded-full truncate">
              Now: {venue.next_event_title}
            </span>
          )}
          {!venue.next_event_title && venue.upcoming_event_count > 0 && (
            <span className="font-mono text-[0.6rem] text-[var(--muted)] bg-[var(--twilight)]/50 px-2 py-0.5 rounded-full">
              {venue.upcoming_event_count} upcoming
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ============================================
// SKELETON - Loading state
// ============================================

function ExploreSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero skeleton */}
      <div className="rounded-2xl overflow-hidden">
        <div className="aspect-[16/9] sm:aspect-[21/9] skeleton-shimmer" />
      </div>

      {/* Category nav skeleton */}
      <div className="flex gap-2 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 w-32 skeleton-shimmer rounded-xl flex-shrink-0" />
        ))}
      </div>

      {/* Cards skeleton */}
      <div>
        <div className="h-6 w-48 skeleton-shimmer rounded mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-[var(--twilight)]">
              <div className="aspect-[16/9] skeleton-shimmer" />
              <div className="p-3 space-y-2">
                <div className="h-4 w-3/4 skeleton-shimmer rounded" />
                <div className="h-3 w-1/2 skeleton-shimmer rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
