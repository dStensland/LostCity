"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";

type Producer = {
  id: string;
  name: string;
  slug: string;
  org_type: string;
  website: string | null;
  instagram: string | null;
  logo_url: string | null;
  description: string | null;
  categories: string[] | null;
  neighborhood: string | null;
  featured: boolean;
  event_count?: number;
};

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

interface Props {
  portalId: string;
  portalSlug: string;
  portalName: string;
}

// Producer card component
function ProducerCard({
  producer,
  portalSlug,
  orgConfig,
}: {
  producer: Producer;
  portalSlug: string;
  orgConfig: { label: string; color: string } | undefined;
}) {
  const hasEvents = (producer.event_count ?? 0) > 0;

  return (
    <Link
      href={`/${portalSlug}/community/${producer.slug}`}
      className="block p-5 rounded-xl border border-[var(--twilight)] card-atmospheric group"
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
            <div className="w-[72px] h-[72px] rounded-xl bg-white flex items-center justify-center overflow-hidden">
              <Image
                src={producer.logo_url}
                alt={producer.name}
                width={72}
                height={72}
                className="object-contain"
                style={{ width: 72, height: 72 }}
                unoptimized
              />
            </div>
          ) : (
            <div
              className="w-[72px] h-[72px] rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: producer.categories?.[0]
                  ? `${getCategoryColor(producer.categories[0])}20`
                  : "var(--twilight)",
              }}
            >
              <CategoryIcon
                type={producer.categories?.[0] || "community"}
                size={32}
                glow="subtle"
              />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div>
            <h3 className="text-lg text-[var(--cream)] font-medium truncate transition-colors group-hover:text-[var(--glow-color)]">
              {producer.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-mono font-medium uppercase tracking-wider"
                style={{
                  backgroundColor: orgConfig?.color ? `${orgConfig.color}20` : "var(--twilight)",
                  color: orgConfig?.color || "var(--muted)",
                }}
              >
                {orgConfig?.label || producer.org_type.replace(/_/g, " ")}
              </span>
            </div>
          </div>

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
                    <CategoryIcon type={cat} size={10} glow="none" />
                    {cat.replace(/_/g, " ")}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function PortalCommunityView({ portalId, portalSlug, portalName }: Props) {
  const [producers, setProducers] = useState<Producer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"category" | "alphabetical">("category");
  // Track which categories are expanded (collapsed by default)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (orgType: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(orgType)) {
        next.delete(orgType);
      } else {
        next.add(orgType);
      }
      return next;
    });
  };

  // Sort producers based on selected sort option
  const sortedProducers = useMemo(() => {
    const sorted = [...producers];
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
  }, [producers, sortBy]);

  // Group producers by category for collapsible view
  const groupedProducers = useMemo(() => {
    if (sortBy !== "category") return null;
    const groups: Record<string, Producer[]> = {};
    for (const producer of sortedProducers) {
      const orgType = producer.org_type;
      if (!groups[orgType]) groups[orgType] = [];
      groups[orgType].push(producer);
    }
    // Return in order
    return ORG_TYPE_ORDER
      .filter(type => groups[type]?.length > 0)
      .map(type => ({ type, producers: groups[type] }));
  }, [sortedProducers, sortBy]);

  useEffect(() => {
    async function loadProducers() {
      try {
        const res = await fetch(`/api/producers?portal_id=${portalId}`);
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setProducers(data.producers || []);
      } catch {
        // Fall back to all producers if portal-specific fails
        try {
          const res = await fetch("/api/producers");
          if (res.ok) {
            const data = await res.json();
            setProducers(data.producers || []);
          }
        } catch {
          setError("Unable to load community");
        }
      } finally {
        setLoading(false);
      }
    }
    loadProducers();
  }, [portalId]);

  if (loading) {
    return (
      <div className="py-6">
        <div className="mb-6">
          <div className="h-6 w-32 rounded skeleton-shimmer mb-2" />
          <div className="h-4 w-64 rounded skeleton-shimmer" style={{ animationDelay: "0.1s" }} />
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-5 rounded-xl border border-[var(--twilight)]" style={{ backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-start gap-4">
                <div className="w-[72px] h-[72px] rounded-xl skeleton-shimmer" style={{ animationDelay: `${i * 0.1}s` }} />
                <div className="flex-1 min-w-0">
                  <div className="h-5 w-2/3 rounded skeleton-shimmer mb-2" style={{ animationDelay: `${i * 0.1 + 0.05}s` }} />
                  <div className="h-4 w-24 rounded skeleton-shimmer mb-3" style={{ animationDelay: `${i * 0.1 + 0.1}s` }} />
                  <div className="h-8 w-36 rounded-lg skeleton-shimmer" style={{ animationDelay: `${i * 0.1 + 0.15}s` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <p className="text-[var(--muted)]">{error}</p>
      </div>
    );
  }

  if (producers.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/50 flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h2 className="text-lg text-[var(--cream)] mb-2">No organizers yet</h2>
        <p className="text-[var(--muted)] text-sm">
          Community organizers for {portalName} will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--cream)]">Community</h2>
            <p className="text-sm text-[var(--muted)] mt-1">
              <span className="text-[var(--soft)]">{producers.length}</span> organizations creating events in {portalName}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider mr-2 hidden sm:inline">
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

      {sortBy === "category" && groupedProducers ? (
        <div className="space-y-2">
          {groupedProducers.map(({ type, producers: groupProducers }) => {
            const orgConfig = ORG_TYPE_CONFIG[type];
            const isExpanded = expandedCategories.has(type);

            return (
              <div key={type}>
                {/* Collapsible Category Header */}
                <button
                  onClick={() => toggleCategory(type)}
                  className="w-full flex items-center gap-2 py-3 px-1 group/header"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: orgConfig?.color || "var(--muted)" }}
                  />
                  <h3
                    className="font-mono text-xs font-medium uppercase tracking-wider flex-1 text-left"
                    style={{ color: orgConfig?.color || "var(--muted)" }}
                  >
                    {orgConfig?.label || type.replace(/_/g, " ")}
                  </h3>
                  <span className="font-mono text-[0.6rem] text-[var(--muted)] mr-2">
                    {groupProducers.length}
                  </span>
                  <svg
                    className={`w-4 h-4 text-[var(--muted)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Collapsible Content */}
                {isExpanded && (
                  <div className="space-y-3 pb-4">
                    {groupProducers.map((producer) => (
                      <ProducerCard
                        key={producer.id}
                        producer={producer}
                        portalSlug={portalSlug}
                        orgConfig={orgConfig}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedProducers.map((producer) => {
            const orgConfig = ORG_TYPE_CONFIG[producer.org_type];
            return (
              <ProducerCard
                key={producer.id}
                producer={producer}
                portalSlug={portalSlug}
                orgConfig={orgConfig}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
