"use client";

import { memo, useState } from "react";
import { Globe, InstagramLogo, Envelope } from "@phosphor-icons/react";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import SmartImage from "@/components/SmartImage";
import Badge from "@/components/ui/Badge";
import type { OrgData } from "@/lib/detail/types";

// ── Config ────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function deriveActivitySummary(
  events: unknown[]
): string | null {
  if (!events || events.length === 0) return null;
  const next = events[0] as Record<string, unknown>;
  const title = typeof next.title === "string" ? next.title : null;
  if (!title) return null;
  return `Next: ${title}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface OrgIdentityProps {
  organization: OrgData;
  events: unknown[];
  portalSlug: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const OrgIdentity = memo(function OrgIdentity({
  organization,
  events,
}: OrgIdentityProps) {
  const [imageError, setImageError] = useState(false);

  const orgConfig = ORG_TYPE_CONFIG[organization.org_type];
  const orgAccent = orgConfig?.color ?? "var(--muted)";
  const orgAccentClass = createCssVarClass("--accent-color", orgAccent, "accent");

  const primaryCategory = organization.categories?.[0];
  const categoryAccentClass = primaryCategory
    ? createCssVarClass("--accent-color", getCategoryColor(primaryCategory), "cat-accent")
    : null;

  const showLogo = !!organization.logo_url && !imageError;
  const activitySummary = deriveActivitySummary(events);

  return (
    <div className={`space-y-3 ${orgAccentClass?.className ?? ""}`}>
      <ScopedStyles css={orgAccentClass?.css} />

      {/* Logo + Name row */}
      <div className="flex items-start gap-3">
        {/* Logo / icon fallback */}
        <div className="flex-shrink-0">
          {showLogo ? (
            <div className="w-12 h-12 rounded-xl bg-[var(--cream)] flex items-center justify-center overflow-hidden relative">
              <SmartImage
                src={organization.logo_url!}
                alt={organization.name}
                width={48}
                height={48}
                className="object-contain"
                onError={() => setImageError(true)}
              />
            </div>
          ) : (
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                primaryCategory ? "bg-accent-20" : "bg-[var(--twilight)]"
              } ${categoryAccentClass?.className ?? ""}`}
            >
              <ScopedStyles css={categoryAccentClass?.css} />
              <CategoryIcon
                type={primaryCategory ?? "community"}
                size={24}
                glow="subtle"
              />
            </div>
          )}
        </div>

        {/* Name + type */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-[var(--cream)] leading-tight">
            {organization.name}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {orgConfig ? (
              <Badge variant="accent" accentColor={orgConfig.color}>
                {orgConfig.label}
              </Badge>
            ) : (
              <Badge variant="neutral">
                {organization.org_type.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Location */}
      {(organization.neighborhood || organization.city) && (
        <p className="text-sm text-[var(--muted)]">
          {organization.neighborhood}
          {organization.neighborhood && organization.city ? ", " : ""}
          {organization.city}
        </p>
      )}

      {/* Activity summary */}
      {activitySummary && (
        <p className="text-sm text-[var(--soft)]">{activitySummary}</p>
      )}

      {/* Category tags */}
      {organization.categories && organization.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {organization.categories.map((cat) => {
            const color = getCategoryColor(cat);
            const tagAccentClass = createCssVarClass("--accent-color", color, "cat-tag");
            return (
              <span
                key={cat}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono uppercase tracking-widest bg-accent-15 text-accent ${
                  tagAccentClass?.className ?? ""
                }`}
              >
                <ScopedStyles css={tagAccentClass?.css} />
                <CategoryIcon type={cat} size={12} />
                {cat.replace(/_/g, " ")}
              </span>
            );
          })}
        </div>
      )}

      {/* Links */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {organization.website && (
          <a
            href={organization.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-lg bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] transition-colors text-sm focus-ring"
          >
            <Globe weight="duotone" className="w-4 h-4" aria-hidden="true" />
            {getDomainFromUrl(organization.website)}
          </a>
        )}
        {organization.instagram && (
          <a
            href={`https://instagram.com/${organization.instagram}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-lg bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] transition-colors text-sm focus-ring"
          >
            <InstagramLogo weight="duotone" className="w-4 h-4" aria-hidden="true" />
            Instagram
          </a>
        )}
        {organization.email && (
          <a
            href={`mailto:${organization.email}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-lg bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] transition-colors text-sm focus-ring"
          >
            <Envelope weight="duotone" className="w-4 h-4" aria-hidden="true" />
            Email
          </a>
        )}
      </div>
    </div>
  );
});

export type { OrgIdentityProps };
