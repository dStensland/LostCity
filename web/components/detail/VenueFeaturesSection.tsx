"use client";

import {
  type VenueFeature,
  type FeatureType,
  getFeatureSectionConfig,
  FEATURE_TYPE_LABELS,
} from "@/lib/venue-features";
import { SectionHeader } from "./SectionHeader";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import Badge from "@/components/ui/Badge";
import Image from "@/components/SmartImage";

type VenueFeaturesSectionProps = {
  features: VenueFeature[];
  venueType: string | null | undefined;
};

function formatSeasonalRange(
  startDate: string | null,
  endDate: string | null
): string | null {
  if (!endDate) return null;
  try {
    const end = new Date(endDate + "T00:00:00");
    const month = end.toLocaleString("en-US", { month: "short" });
    const day = end.getDate();
    return `Through ${month} ${day}`;
  } catch {
    return null;
  }
}

function FeatureBadges({
  feature,
  seasonalLabel,
}: {
  feature: VenueFeature;
  seasonalLabel: string | null;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-2xs font-mono uppercase tracking-wider text-[var(--soft)]">
        {FEATURE_TYPE_LABELS[feature.feature_type as FeatureType] ??
          feature.feature_type}
      </span>
      {feature.is_free && (
        <Badge variant="success" size="sm">
          Free
        </Badge>
      )}
      {seasonalLabel && (
        <Badge variant="alert" size="sm">
          {seasonalLabel}
        </Badge>
      )}
    </div>
  );
}

function ExternalLinkIndicator() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-mono text-[var(--feature-accent)] mt-1">
      Learn more
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </span>
  );
}

function MaybeLink({
  url,
  children,
  className,
  style,
}: {
  url: string | null;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={style}
      >
        {children}
      </a>
    );
  }
  return <div className={className} style={style}>{children}</div>;
}

function ImageFeatureCard({
  feature,
  seasonalLabel,
  accentClassName,
}: {
  feature: VenueFeature;
  seasonalLabel: string | null;
  accentClassName: string;
}) {
  return (
    <MaybeLink
      url={feature.url}
      className={`group block rounded-xl overflow-hidden border border-[var(--twilight)]/60 bg-[var(--night)] transition-all ${feature.url ? "hover:border-[var(--soft)]" : ""} ${accentClassName}`}
    >
      <div className="relative w-full aspect-[16/9] overflow-hidden">
        <Image
          src={feature.image_url!}
          alt={feature.title}
          fill
          sizes="(max-width: 768px) 100vw, 680px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/40 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 p-4">
          <h3 className="text-base font-semibold text-white leading-tight">
            {feature.title}
          </h3>
        </div>
      </div>
      <div className="px-4 py-3 space-y-1.5">
        <FeatureBadges feature={feature} seasonalLabel={seasonalLabel} />
        {feature.description && (
          <p className="text-sm text-[var(--soft)] leading-relaxed line-clamp-3">
            {feature.description}
          </p>
        )}
        {feature.price_note && (
          <p className="text-xs text-[var(--muted)] font-mono">
            {feature.price_note}
          </p>
        )}
        {feature.url && <ExternalLinkIndicator />}
      </div>
    </MaybeLink>
  );
}

function TextFeatureCard({
  feature,
  seasonalLabel,
  accentColor,
  accentClassName,
  IconComp,
}: {
  feature: VenueFeature;
  seasonalLabel: string | null;
  accentColor: string;
  accentClassName: string;
  IconComp: React.ComponentType<{ size: number; weight: string; className: string }>;
}) {
  return (
    <MaybeLink
      url={feature.url}
      className={`group flex items-start gap-3 p-4 rounded-xl border border-[var(--twilight)]/60 bg-[var(--night)] border-l-2 transition-all ${feature.url ? "hover:border-[var(--soft)]" : ""} ${accentClassName}`}
      style={{ borderLeftColor: accentColor }}
    >
      <IconComp
        size={20}
        weight="light"
        className="flex-shrink-0 mt-0.5 text-[var(--feature-accent)]"
      />
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-[var(--cream)] leading-tight">
          {feature.title}
        </h3>
        <div className="mt-1">
          <FeatureBadges feature={feature} seasonalLabel={seasonalLabel} />
        </div>
        {feature.description && (
          <p className="text-sm text-[var(--soft)] mt-1.5 leading-relaxed">
            {feature.description}
          </p>
        )}
        {feature.price_note && (
          <p className="text-xs text-[var(--muted)] mt-1 font-mono">
            {feature.price_note}
          </p>
        )}
        {feature.url && <ExternalLinkIndicator />}
      </div>
    </MaybeLink>
  );
}

export default function VenueFeaturesSection({
  features,
  venueType,
}: VenueFeaturesSectionProps) {
  if (!features || features.length === 0) return null;

  const config = getFeatureSectionConfig(venueType);
  const IconComp = config.Icon;
  const colorClass = createCssVarClass(
    "--feature-accent",
    config.color,
    "feature-section"
  );

  // Sort: permanent first, then seasonal
  const sorted = [...features].sort((a, b) => {
    if (a.is_seasonal !== b.is_seasonal) return a.is_seasonal ? 1 : -1;
    return a.sort_order - b.sort_order;
  });

  return (
    <div className="mt-6">
      <ScopedStyles css={colorClass?.css} />
      <SectionHeader title={config.title} count={features.length} />
      <div className="space-y-3">
        {sorted.map((feature) => {
          const seasonalLabel = feature.is_seasonal
            ? formatSeasonalRange(feature.start_date, feature.end_date)
            : null;

          return feature.image_url ? (
            <ImageFeatureCard
              key={feature.id}
              feature={feature}
              seasonalLabel={seasonalLabel}
              accentClassName={colorClass?.className ?? ""}
            />
          ) : (
            <TextFeatureCard
              key={feature.id}
              feature={feature}
              seasonalLabel={seasonalLabel}
              accentColor={config.color}
              accentClassName={colorClass?.className ?? ""}
              IconComp={IconComp as React.ComponentType<{ size: number; weight: string; className: string }>}
            />
          );
        })}
      </div>
    </div>
  );
}
