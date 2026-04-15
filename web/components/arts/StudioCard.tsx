"use client";

import Link from "next/link";
import { MapPin, ArrowSquareOut } from "@phosphor-icons/react";
import type { StudioVenue } from "@/lib/types/studios";
import {
  STUDIO_TYPE_LABELS,
  AVAILABILITY_LABELS,
  AVAILABILITY_COLORS,
} from "@/lib/types/studios";

interface StudioCardProps {
  studio: StudioVenue;
  portalSlug: string;
}

export function StudioCard({ studio, portalSlug }: StudioCardProps) {
  const typeLabel = STUDIO_TYPE_LABELS[studio.studio_type] ?? studio.studio_type;
  const availLabel = studio.availability_status
    ? AVAILABILITY_LABELS[studio.availability_status]
    : null;
  const availColor = studio.availability_status
    ? AVAILABILITY_COLORS[studio.availability_status]
    : "--muted";

  return (
    <div className="border border-[var(--twilight)] rounded-none p-4 sm:p-5 space-y-3 transition-colors hover:border-[var(--action-primary)]/40">
      {/* Header: type + availability */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
          {`// ${typeLabel.toLowerCase()}`}
        </span>
        {availLabel && (
          <span
            className="font-mono text-xs uppercase tracking-wider"
            style={{ color: `var(${availColor})` }}
          >
            {availLabel}
          </span>
        )}
      </div>

      {/* Name */}
      <Link
        href={`/${portalSlug}/spots/${studio.slug}`}
        className="block group"
      >
        <h3 className="font-mono text-lg font-semibold text-[var(--cream)] group-hover:text-[var(--action-primary)] transition-colors leading-tight">
          {studio.name}
        </h3>
      </Link>

      {/* Location */}
      {studio.neighborhood && (
        <div className="flex items-center gap-1.5">
          <MapPin size={14} weight="duotone" className="text-[var(--muted)] flex-shrink-0" />
          <span className="font-mono text-sm text-[var(--soft)]">
            {studio.neighborhood}
            {studio.address && ` · ${studio.address}`}
          </span>
        </div>
      )}

      {/* Description */}
      {studio.description && (
        <p className="font-mono text-sm text-[var(--muted)] line-clamp-2 leading-relaxed">
          {studio.description}
        </p>
      )}

      {/* Footer: rate + links */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3">
          {studio.monthly_rate_range && (
            <span className="font-mono text-sm text-[var(--soft)]">
              {studio.monthly_rate_range}/mo
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {studio.studio_application_url && (
            <a
              href={studio.studio_application_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs text-[var(--action-primary)] hover:opacity-80 transition-opacity"
            >
              Apply
              <ArrowSquareOut size={12} weight="bold" />
            </a>
          )}
          {studio.website && !studio.studio_application_url && (
            <a
              href={studio.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs text-[var(--action-primary)] hover:opacity-80 transition-opacity"
            >
              Website
              <ArrowSquareOut size={12} weight="bold" />
            </a>
          )}
        </div>
      </div>

      {/* Vibes */}
      {studio.vibes && studio.vibes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {studio.vibes.slice(0, 5).map((vibe) => (
            <span
              key={vibe}
              className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)] border border-[var(--twilight)] px-2 py-0.5 rounded-none"
            >
              {vibe.replace(/-/g, " ")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
