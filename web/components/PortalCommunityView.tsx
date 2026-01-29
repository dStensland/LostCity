"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import CategorySkeleton from "@/components/CategorySkeleton";

type Organization = {
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
  // Arts & Culture
  arts: { label: "Arts & Culture", color: "#C4B5FD" },
  film: { label: "Film", color: "#A5B4FC" },
  entertainment: { label: "Entertainment", color: "#60A5FA" },
  // Community & Advocacy
  community: { label: "Community", color: "#6EE7B7" },
  advocacy: { label: "Advocacy", color: "#F472B6" },
  // Environment & Outdoors
  environmental: { label: "Environmental", color: "#2DD4BF" },
  fitness: { label: "Fitness", color: "#5EEAD4" },
  // Food & Youth
  food: { label: "Food & Drink", color: "#FDBA74" },
  youth: { label: "Youth", color: "#FCD34D" },
};

// Order for category sorting
const ORG_TYPE_ORDER = [
  "arts",
  "film",
  "entertainment",
  "community",
  "advocacy",
  "environmental",
  "fitness",
  "food",
  "youth",
];

interface Props {
  portalId: string;
  portalSlug: string;
  portalName: string;
}

// Organization card component
function OrganizationCard({
  organization,
  portalSlug,
  orgConfig,
}: {
  organization: Organization;
  portalSlug: string;
  orgConfig: { label: string; color: string } | undefined;
}) {
  const hasEvents = (organization.event_count ?? 0) > 0;
  const glowColor = orgConfig?.color || "var(--coral)";

  return (
    <Link
      href={`/${portalSlug}?org=${organization.slug}`}
      scroll={false}
      className="block p-5 rounded-xl border border-[var(--twilight)] card-atmospheric group transition-all duration-300 hover:translate-y-[-2px]"
      style={{
        backgroundColor: "var(--card-bg)",
        "--glow-color": glowColor,
        "--reflection-color": orgConfig?.color ? `color-mix(in srgb, ${orgConfig.color} 15%, transparent)` : undefined,
      } as React.CSSProperties}
    >
      <div className="flex items-start gap-4">
        {/* Logo with subtle hover glow - reduced intensity */}
        <div className="flex-shrink-0 relative">
          <div
            className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-40 transition-opacity duration-300 blur-lg"
            style={{ backgroundColor: glowColor, transform: "scale(1.2)" }}
          />
          {organization.logo_url ? (
            <div className="relative w-[72px] h-[72px] rounded-xl bg-white flex items-center justify-center overflow-hidden">
              <Image
                src={organization.logo_url}
                alt={organization.name}
                width={72}
                height={72}
                className="object-contain"
                style={{ width: 72, height: 72 }}
                unoptimized
              />
            </div>
          ) : (
            <div
              className="relative w-[72px] h-[72px] rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: organization.categories?.[0]
                  ? `${getCategoryColor(organization.categories[0])}20`
                  : "var(--twilight)",
              }}
            >
              <CategoryIcon
                type={organization.categories?.[0] || "community"}
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
              {organization.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-mono font-medium uppercase tracking-wider"
                style={{
                  backgroundColor: orgConfig?.color ? `${orgConfig.color}20` : "var(--twilight)",
                  color: orgConfig?.color || "var(--muted)",
                }}
              >
                {orgConfig?.label || organization.org_type.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          {/* Prominent upcoming events badge with pulsing indicator */}
          {hasEvents && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--coral)]/15 border border-[var(--coral)]/30">
              {/* Pulsing dot */}
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--coral)] opacity-50" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--coral)]" />
              </span>
              <span className="text-[var(--coral)] font-mono text-sm font-medium">
                {organization.event_count} upcoming
              </span>
            </div>
          )}

          {organization.categories && organization.categories.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {organization.categories.slice(0, 5).map((cat) => {
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

        {/* Arrow indicator on hover */}
        <div className="flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
          <svg
            className="w-5 h-5 text-[var(--muted)] group-hover:translate-x-1 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

export default function PortalCommunityView({ portalId, portalSlug, portalName }: Props) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
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

  // Group organizations by category for collapsible view
  const groupedOrganizations = useMemo(() => {
    if (sortBy !== "category") return null;
    const groups: Record<string, Organization[]> = {};
    for (const organization of sortedOrganizations) {
      const orgType = organization.org_type;
      if (!groups[orgType]) groups[orgType] = [];
      groups[orgType].push(organization);
    }
    // Return in order
    return ORG_TYPE_ORDER
      .filter(type => groups[type]?.length > 0)
      .map(type => ({ type, organizations: groups[type] }));
  }, [sortedOrganizations, sortBy]);

  useEffect(() => {
    async function loadOrganizations() {
      try {
        const res = await fetch(`/api/organizations?portal_id=${portalId}`);
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setOrganizations(data.organizations || []);
      } catch {
        // Fall back to all organizations if portal-specific fails
        try {
          const res = await fetch("/api/organizations");
          if (res.ok) {
            const data = await res.json();
            setOrganizations(data.organizations || []);
          }
        } catch {
          setError("Unable to load community");
        }
      } finally {
        setLoading(false);
      }
    }
    loadOrganizations();
  }, [portalId]);

  if (loading) {
    return (
      <CategorySkeleton
        count={8}
        title="Community"
        subtitle="Loading organizations..."
      />
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <p className="text-[var(--muted)]">{error}</p>
      </div>
    );
  }

  if (organizations.length === 0) {
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
              <span className="text-[var(--soft)]">{organizations.length}</span> organizations creating events in {portalName}
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

      {sortBy === "category" && groupedOrganizations ? (
        <div className="space-y-2">
          {groupedOrganizations.map(({ type, organizations: groupOrganizations }) => {
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
                    {groupOrganizations.length}
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
                    {groupOrganizations.map((organization) => (
                      <OrganizationCard
                        key={organization.id}
                        organization={organization}
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
          {sortedOrganizations.map((organization) => {
            const orgConfig = ORG_TYPE_CONFIG[organization.org_type];
            return (
              <OrganizationCard
                key={organization.id}
                organization={organization}
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
