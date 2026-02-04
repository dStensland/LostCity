"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import FollowButton from "@/components/FollowButton";
import CategoryIcon, { getCategoryColor, CATEGORY_CONFIG } from "@/components/CategoryIcon";
import { EventsBadge } from "@/components/Badge";
import type { Organization } from "./page";

// Event categories that producers can create events in
const EVENT_CATEGORIES = [
  "music", "comedy", "art", "theater", "film", "community",
  "food_drink", "sports", "fitness", "nightlife", "family",
  "dance", "learning", "wellness", "outdoors"
] as const;

// Org type configuration with colors and labels
const ORG_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  arts_nonprofit: { label: "Arts & Culture", color: "#C4B5FD" },
  film_society: { label: "Film", color: "#A5B4FC" },
  community_group: { label: "Community", color: "#6EE7B7" },
  running_club: { label: "Fitness", color: "#5EEAD4" },
  cultural_org: { label: "Cultural", color: "#FBBF24" },
  food_festival: { label: "Food & Drink", color: "#FDBA74" },
  venue: { label: "Venue", color: "#A78BFA" },
  festival: { label: "Festival", color: "#F9A8D4" },
};

const ORG_TYPES = {
  all: "All",
  arts_nonprofit: "Arts & Culture",
  film_society: "Film",
  community_group: "Community",
  running_club: "Fitness",
  cultural_org: "Cultural",
  food_festival: "Food & Drink",
} as const;

interface Props {
  organizations: Organization[];
  selectedType: string;
  selectedCategories: string[];
  searchQuery: string;
}

// Order for category sorting
const ORG_TYPE_ORDER = [
  "arts_nonprofit",
  "film_society",
  "community_group",
  "running_club",
  "cultural_org",
  "food_festival",
  "venue",
  "festival",
];

export default function CommunityContent({
  organizations,
  selectedType,
  selectedCategories,
  searchQuery,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchQuery);
  const [sortBy, setSortBy] = useState<"category" | "alphabetical">("category");

  // Sort organizations based on selected sort option
  const sortedOrganizations = useMemo(() => {
    const sorted = [...organizations];
    if (sortBy === "alphabetical") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // Sort by category (org_type), then by name within category
      sorted.sort((a, b) => {
        const aOrder = ORG_TYPE_ORDER.indexOf(a.org_type);
        const bOrder = ORG_TYPE_ORDER.indexOf(b.org_type);
        const aIdx = aOrder === -1 ? 999 : aOrder;
        const bIdx = bOrder === -1 ? 999 : bOrder;
        if (aIdx !== bIdx) return aIdx - bIdx;
        return a.name.localeCompare(b.name);
      });
    }
    return sorted;
  }, [organizations, sortBy]);

  const handleTypeChange = (type: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (type === "all") {
      params.delete("type");
    } else {
      params.set("type", type);
    }
    const query = params.toString();
    router.push(`/community${query ? `?${query}` : ""}`, { scroll: false });
  };

  const handleCategoryToggle = (category: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const newCategories = selectedCategories.includes(category)
      ? selectedCategories.filter((c) => c !== category)
      : [...selectedCategories, category];

    if (newCategories.length > 0) {
      params.set("category", newCategories.join(","));
    } else {
      params.delete("category");
    }
    const query = params.toString();
    router.push(`/community${query ? `?${query}` : ""}`, { scroll: false });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (search.trim()) {
      params.set("search", search.trim());
    } else {
      params.delete("search");
    }
    const query = params.toString();
    router.push(`/community${query ? `?${query}` : ""}`, { scroll: false });
  };

  return (
    <>
      {/* Header */}
      <section className="py-6 border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="text-2xl font-bold text-[var(--cream)] mb-2">Community</h1>
          <p className="text-[var(--muted)] text-sm">
            Discover and follow organizations that create events in Atlanta
          </p>
        </div>
      </section>

      {/* Search */}
      <section className="py-3 border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organizers..."
              className="w-full py-2 pl-10 pr-4 bg-[var(--twilight)] border border-[var(--twilight)] rounded-lg font-mono text-sm text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)]"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </form>
        </div>
      </section>

      {/* Type Filter */}
      <section className="py-3 border-b border-[var(--twilight)] overflow-x-auto scrollbar-hide">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex gap-2">
            {Object.entries(ORG_TYPES).map(([value, label]) => {
              const isSelected = selectedType === value;
              const config = ORG_TYPE_CONFIG[value];
              return (
                <button
                  key={value}
                  onClick={() => handleTypeChange(value)}
                  className={`px-3 py-1.5 rounded-full font-mono text-xs font-medium whitespace-nowrap transition-all border ${
                    isSelected
                      ? "border-transparent"
                      : "border-transparent bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/80"
                  }`}
                  style={
                    isSelected && config
                      ? { backgroundColor: config.color, color: "#1a1a2e" }
                      : isSelected
                      ? { backgroundColor: "var(--coral)", color: "var(--void)" }
                      : undefined
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Category Filter */}
      <section className="py-3 border-b border-[var(--twilight)] overflow-x-auto scrollbar-hide">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider whitespace-nowrap">
              Creates:
            </span>
            <div className="flex gap-1.5">
              {EVENT_CATEGORIES.map((cat) => {
                const isSelected = selectedCategories.includes(cat);
                const config = CATEGORY_CONFIG[cat];
                const color = config?.color || "var(--muted)";
                return (
                  <button
                    key={cat}
                    onClick={() => handleCategoryToggle(cat)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full font-mono text-[0.65rem] font-medium whitespace-nowrap transition-all ${
                      isSelected
                        ? "text-[var(--void)]"
                        : "bg-[var(--twilight)]/50 text-[var(--muted)] hover:text-[var(--cream)]"
                    }`}
                    style={isSelected ? { backgroundColor: color } : undefined}
                  >
                    <CategoryIcon type={cat} size={12} glow={isSelected ? "none" : "subtle"} />
                    {config?.label || cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Results Count & Sort */}
      <div className="max-w-3xl mx-auto px-4 border-b border-[var(--twilight)]">
        <div className="flex items-center justify-between py-3">
          <p className="font-mono text-xs text-[var(--muted)]">
            <span className="text-[var(--soft)]">{organizations.length}</span> organizers
            {searchQuery && ` matching "${searchQuery}"`}
          </p>
          <div className="flex items-center gap-1">
            <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider mr-2">
              Sort:
            </span>
            <button
              onClick={() => setSortBy("category")}
              className={`px-2 py-1 rounded font-mono text-[0.65rem] transition-all ${
                sortBy === "category"
                  ? "bg-[var(--coral)] text-[var(--void)]"
                  : "bg-[var(--twilight)]/50 text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              Category
            </button>
            <button
              onClick={() => setSortBy("alphabetical")}
              className={`px-2 py-1 rounded font-mono text-[0.65rem] transition-all ${
                sortBy === "alphabetical"
                  ? "bg-[var(--coral)] text-[var(--void)]"
                  : "bg-[var(--twilight)]/50 text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              A-Z
            </button>
          </div>
        </div>
      </div>

      {/* Organizations List */}
      <main className="max-w-3xl mx-auto px-4 py-6 pb-12">
        {sortedOrganizations.length > 0 ? (
          <div className="space-y-4">
            {sortedOrganizations.map((producer, index) => {
              // Show category header when sorting by category
              const showCategoryHeader = sortBy === "category" && (
                index === 0 ||
                sortedOrganizations[index - 1].org_type !== producer.org_type
              );
              const orgConfig = ORG_TYPE_CONFIG[producer.org_type];
              const hasEvents = (producer.event_count ?? 0) > 0;

              return (
                <div key={producer.id}>
                  {showCategoryHeader && (
                    <div className="flex items-center gap-2 mb-3 mt-6 first:mt-0">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: orgConfig?.color || "var(--muted)" }}
                      />
                      <h2
                        className="font-mono text-xs font-medium uppercase tracking-wider"
                        style={{ color: orgConfig?.color || "var(--muted)" }}
                      >
                        {orgConfig?.label || producer.org_type.replace(/_/g, " ")}
                      </h2>
                    </div>
                  )}
                  <Link
                  href={`/community/${producer.slug}`}
                  className="block p-5 rounded-xl border border-[var(--twilight)] transition-all hover:border-[var(--coral)]/50 group card-atmospheric relative"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    "--glow-color": orgConfig?.color || "var(--coral)",
                    "--reflection-color": orgConfig?.color ? `color-mix(in srgb, ${orgConfig.color} 15%, transparent)` : undefined,
                  } as React.CSSProperties}
                >
                  <div className="flex items-start gap-4">
                    {/* Logo */}
                    <div className="flex-shrink-0">
                      {producer.logo_url ? (
                        <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center overflow-hidden">
                          <Image
                            src={producer.logo_url}
                            alt={producer.name}
                            width={64}
                            height={64}
                            className="object-contain"
                            style={{ width: 64, height: 64 }}
                          />
                        </div>
                      ) : (
                        <div
                          className="w-16 h-16 rounded-xl flex items-center justify-center"
                          style={{
                            backgroundColor: producer.categories?.[0]
                              ? `${getCategoryColor(producer.categories[0])}20`
                              : "var(--twilight)",
                          }}
                        >
                          <CategoryIcon
                            type={producer.categories?.[0] || "community"}
                            size={28}
                            glow="subtle"
                          />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-base text-[var(--cream)] font-medium truncate group-hover:text-[var(--coral)] transition-colors">
                            {producer.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            {/* Org Type Badge */}
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-[0.6rem] font-mono font-medium uppercase tracking-wider"
                              style={{
                                backgroundColor: orgConfig?.color ? `${orgConfig.color}20` : "var(--twilight)",
                                color: orgConfig?.color || "var(--muted)",
                              }}
                            >
                              {orgConfig?.label || producer.org_type.replace(/_/g, " ")}
                            </span>
                            {producer.neighborhood && (
                              <span className="text-[0.6rem] text-[var(--muted)] font-mono">
                                {producer.neighborhood}
                              </span>
                            )}
                          </div>
                        </div>
                        <FollowButton targetProducerId={producer.id} size="sm" />
                      </div>

                      {producer.description && (
                        <p className="mt-2 text-sm text-[var(--soft)] line-clamp-2">
                          {producer.description}
                        </p>
                      )}

                      {/* Category tags - Using CategoryIcon colors */}
                      {producer.categories && producer.categories.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {producer.categories.slice(0, 4).map((cat) => {
                            const color = getCategoryColor(cat);
                            return (
                              <span
                                key={cat}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.55rem] font-mono uppercase tracking-wider"
                                style={{
                                  backgroundColor: `${color}15`,
                                  color: color,
                                }}
                              >
                                <CategoryIcon type={cat} size={9} />
                                {cat.replace(/_/g, " ")}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Event Count - Bottom right badge */}
                  {hasEvents && (
                    <div className="absolute bottom-3 right-3">
                      <EventsBadge count={producer.event_count!} />
                    </div>
                  )}
                </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-[var(--muted)]">No organizers found</p>
            {(selectedType !== "all" || searchQuery || selectedCategories.length > 0) && (
              <Link
                href="/community"
                className="inline-block mt-4 font-mono text-sm text-[var(--coral)] hover:text-[var(--rose)]"
              >
                Clear filters
              </Link>
            )}
          </div>
        )}
      </main>
    </>
  );
}
