"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import FollowButton from "@/components/FollowButton";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import type { Producer } from "./page";

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
  producers: Producer[];
  selectedType: string;
  searchQuery: string;
}

// Helper to extract domain from URL for display
function getDomainFromUrl(url: string): string {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    return domain;
  } catch {
    return url;
  }
}

export default function CommunityContent({
  producers,
  selectedType,
  searchQuery,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchQuery);

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

      {/* Results Count */}
      <div className="max-w-3xl mx-auto px-4 border-b border-[var(--twilight)]">
        <p className="font-mono text-xs text-[var(--muted)] py-3">
          <span className="text-[var(--soft)]">{producers.length}</span> organizers
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      </div>

      {/* Producers List */}
      <main className="max-w-3xl mx-auto px-4 py-6 pb-12">
        {producers.length > 0 ? (
          <div className="space-y-4">
            {producers.map((producer) => {
              const orgConfig = ORG_TYPE_CONFIG[producer.org_type];
              const hasEvents = (producer.event_count ?? 0) > 0;

              return (
                <Link
                  key={producer.id}
                  href={`/community/${producer.slug}`}
                  className="block p-5 rounded-xl border border-[var(--twilight)] transition-all hover:border-[var(--coral)]/50 group"
                  style={{ backgroundColor: "var(--card-bg)" }}
                >
                  <div className="flex items-start gap-4">
                    {/* Logo - Larger size */}
                    <div className="flex-shrink-0">
                      {producer.logo_url ? (
                        <Image
                          src={producer.logo_url}
                          alt={producer.name}
                          width={72}
                          height={72}
                          className="rounded-xl object-cover"
                          style={{ width: 72, height: 72 }}
                        />
                      ) : (
                        <div
                          className="w-[72px] h-[72px] rounded-xl flex items-center justify-center"
                          style={{
                            backgroundColor: orgConfig?.color ? `${orgConfig.color}20` : "var(--twilight)",
                          }}
                        >
                          <svg
                            className="w-8 h-8"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            style={{ color: orgConfig?.color || "var(--muted)" }}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-lg text-[var(--cream)] font-medium truncate group-hover:text-[var(--coral)] transition-colors">
                            {producer.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            {/* Org Type Badge */}
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-mono font-medium uppercase tracking-wider"
                              style={{
                                backgroundColor: orgConfig?.color ? `${orgConfig.color}20` : "var(--twilight)",
                                color: orgConfig?.color || "var(--muted)",
                              }}
                            >
                              {orgConfig?.label || producer.org_type.replace(/_/g, " ")}
                            </span>
                            {producer.neighborhood && (
                              <span className="text-[0.65rem] text-[var(--muted)] font-mono">
                                {producer.neighborhood}
                              </span>
                            )}
                          </div>
                        </div>
                        <FollowButton targetProducerId={producer.id} size="sm" />
                      </div>

                      {/* Event Count - Prominent display */}
                      {hasEvents && (
                        <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)]/20">
                          <svg className="w-4 h-4 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-[var(--coral)] font-mono text-sm font-medium">
                            {producer.event_count} upcoming event{producer.event_count !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}

                      {producer.description && (
                        <p className="mt-3 text-sm text-[var(--soft)] line-clamp-2">
                          {producer.description}
                        </p>
                      )}

                      {/* Category tags - Using CategoryIcon colors */}
                      {producer.categories && producer.categories.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {producer.categories.slice(0, 5).map((cat) => {
                            const color = getCategoryColor(cat);
                            return (
                              <span
                                key={cat}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.6rem] font-mono uppercase tracking-wider"
                                style={{
                                  backgroundColor: `${color}15`,
                                  color: color,
                                }}
                              >
                                <CategoryIcon type={cat} size={10} />
                                {cat.replace(/_/g, " ")}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* View profile hint */}
                      <div className="mt-4 flex items-center gap-2 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors">
                        <span className="font-mono text-xs">View profile</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </Link>
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
            {(selectedType !== "all" || searchQuery) && (
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
