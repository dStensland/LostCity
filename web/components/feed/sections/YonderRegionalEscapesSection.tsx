"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import Image from "@/components/SmartImage";
import Badge from "@/components/ui/Badge";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import {
  YONDER_INVENTORY_PROVIDERS,
  type YonderAccommodationInventorySource,
} from "@/config/yonder-accommodation-inventory";
import type {
  YonderCommitmentTier,
  YonderDestinationIntelligence,
  YonderWeatherFitTag,
} from "@/config/yonder-destination-intelligence";
import type { TimeSlot } from "@/lib/city-pulse/types";
import type {
  YonderRuntimeInventoryRecord,
  YonderRuntimeInventorySnapshot,
} from "@/lib/yonder-provider-inventory";
import { ArrowRight, Mountains } from "@phosphor-icons/react";
import { buildExploreUrl } from "@/lib/find-url";

type Props = {
  portalSlug: string;
  weatherSignal?: string | null;
  dayOfWeek?: string | null;
  timeSlot?: TimeSlot | null;
};

type YonderDestinationCard = YonderDestinationIntelligence & {
  id: number;
  city: string | null;
  state: string | null;
  imageUrl: string | null;
  shortDescription: string | null;
  venueType: string | null;
  reservationUrl: string | null;
  acceptsReservations: boolean | null;
  reservationRecommended: boolean | null;
  accommodationInventorySource: YonderAccommodationInventorySource | null;
  runtimeInventorySnapshot: YonderRuntimeInventorySnapshot | null;
};

const COMMITMENT_LABELS: Record<YonderCommitmentTier, string> = {
  hour: "An Hour",
  halfday: "Half Day",
  fullday: "Full Day",
  weekend: "Weekend",
};

const WEATHER_TAG_LABELS: Partial<Record<YonderWeatherFitTag, string>> = {
  "after-rain": "After rain",
  "cool-weather": "Cool weather",
  "leaf-season": "Leaf season",
  "clear-day": "Clear day",
  "summer-friendly": "Summer friendly",
  "sunrise-friendly": "Sunrise friendly",
};

const BOOKING_STYLE_BADGES = {
  reserveamerica_park: "GA State Parks",
  direct_lodge: "Direct Lodge",
  operator_direct: "Direct Operator",
  self_planned: "Self-Planned",
} as const;

const LEAD_TIME_BADGES = {
  self_planned: "Self-Planned",
  same_week: "Flexible",
  book_early: "Plan Early",
  seasonal_rush: "Peak Dates",
} as const;

const INVENTORY_COVERAGE_BADGES = {
  coarse_unit_mix: "Unit Mix Ready",
  package_only: "Package Inventory",
  self_guided: "Self Guided",
} as const;

const RUNTIME_UNIT_LABELS: Record<YonderRuntimeInventoryRecord["unitType"], string> = {
  tent_site: "tent sites",
  cabin: "cabins",
  backcountry_site: "backcountry",
  group_site: "group sites",
  group_lodge: "group lodge",
  guide_package: "guide packages",
  yurt: "yurts",
  other: "other units",
};

function getTierBaseScore(
  tier: YonderCommitmentTier,
  isWeekendWindow: boolean,
  timeSlot: TimeSlot | null | undefined,
): number {
  switch (tier) {
    case "weekend":
      return isWeekendWindow ? 28 : 8;
    case "fullday":
      return isWeekendWindow || timeSlot === "morning" || timeSlot === "midday"
        ? 24
        : 14;
    case "halfday":
      return timeSlot === "happy_hour" || timeSlot === "evening" ? 20 : 16;
    case "hour":
      return timeSlot === "late_night" ? 18 : 10;
  }
}

function scoreDestinationForConditions(
  destination: YonderDestinationCard,
  weatherSignal: string | null | undefined,
  isWeekendWindow: boolean,
  timeSlot: TimeSlot | null | undefined,
): number {
  let score = getTierBaseScore(
    destination.commitmentTier,
    isWeekendWindow,
    timeSlot,
  );
  const tags = new Set(destination.weatherFitTags);

  if (weatherSignal === "nice") {
    if (tags.has("clear-day")) score += 8;
    if (tags.has("sunrise-friendly")) score += 4;
    if (destination.commitmentTier === "weekend") score += 5;
    if (destination.commitmentTier === "fullday") score += 3;
  } else if (weatherSignal === "rain") {
    if (tags.has("after-rain")) score += 10;
    if (tags.has("clear-day")) score -= 4;
    if (destination.commitmentTier === "weekend") score -= 3;
  } else if (weatherSignal === "hot") {
    if (tags.has("summer-friendly")) score += 8;
    if (tags.has("heat-exposed")) score -= 8;
    if (destination.commitmentTier === "halfday") score += 4;
    if (destination.commitmentTier === "weekend") score -= 2;
  } else if (weatherSignal === "cold") {
    if (tags.has("cool-weather")) score += 8;
    if (tags.has("clear-day")) score += 3;
  }

  if (destination.driveTimeMinutes <= 95) score += 2;
  if (destination.difficultyLevel === "easy") score += 1;
  if (destination.primaryActivity === "camping_base" && isWeekendWindow) score += 2;

  return score;
}

function getDynamicSubtitle(
  weatherSignal: string | null | undefined,
  selectedTier: YonderCommitmentTier | null,
  isWeekendWindow: boolean,
): string {
  if (weatherSignal === "rain") {
    return "Rain-adjusted picks with strong payoff once conditions clear";
  }
  if (weatherSignal === "hot") {
    return "Heat-aware escapes biased toward lower-friction and better-condition trips";
  }
  if (weatherSignal === "cold") {
    return "Cool-weather regional anchors that still justify the drive";
  }
  if (weatherSignal === "nice" && isWeekendWindow) {
    return "Best-fit weekend and full-day escapes for a good-weather window";
  }
  if (selectedTier === "weekend") {
    return "Regional anchors with enough upside to turn into a real weekend plan";
  }
  return "Commitment-based regional anchors with enough payoff to justify the drive";
}

function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!minutes) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours}h ${minutes}m`;
}

export default function YonderRegionalEscapesSection({
  portalSlug,
  weatherSignal,
  dayOfWeek,
  timeSlot,
}: Props) {
  const { data, isLoading } = useQuery<{ destinations: YonderDestinationCard[] }>({
    queryKey: ["yonder-regional-escapes", portalSlug],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(`/api/portals/${portalSlug}/yonder/destinations`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Yonder destinations fetch failed: ${res.status}`);
        return res.json();
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const destinations = useMemo(
    () => data?.destinations ?? [],
    [data?.destinations],
  );
  const isWeekendWindow =
    dayOfWeek === "friday" || dayOfWeek === "saturday" || dayOfWeek === "sunday";
  const rankedDestinations = useMemo(
    () =>
      [...destinations].sort(
        (a, b) =>
          scoreDestinationForConditions(b, weatherSignal, isWeekendWindow, timeSlot) -
          scoreDestinationForConditions(a, weatherSignal, isWeekendWindow, timeSlot),
      ),
    [destinations, weatherSignal, isWeekendWindow, timeSlot],
  );
  const availableTiers = useMemo(() => {
    const seen = new Set<YonderCommitmentTier>();
    const ordered: YonderCommitmentTier[] = [];
    for (const tier of ["hour", "halfday", "fullday", "weekend"] as const) {
      if (rankedDestinations.some((entry) => entry.commitmentTier === tier)) {
        seen.add(tier);
      }
      if (seen.has(tier)) {
        ordered.push(tier);
      }
    }
    return ordered;
  }, [rankedDestinations]);

  const defaultTier = useMemo(() => {
    if (availableTiers.length === 0) return null;
    const tierScores = availableTiers.map((tier) => {
      const bestDestinationScore = rankedDestinations
        .filter((entry) => entry.commitmentTier === tier)
        .reduce(
          (max, entry) =>
            Math.max(
              max,
              scoreDestinationForConditions(
                entry,
                weatherSignal,
                isWeekendWindow,
                timeSlot,
              ),
            ),
          Number.NEGATIVE_INFINITY,
        );
      return { tier, score: bestDestinationScore };
    });
    tierScores.sort((a, b) => b.score - a.score);
    return tierScores[0]?.tier ?? null;
  }, [availableTiers, rankedDestinations, weatherSignal, isWeekendWindow, timeSlot]);

  const [activeTier, setActiveTier] = useState<YonderCommitmentTier | null>(null);
  const selectedTier = activeTier ?? defaultTier ?? null;

  const filtered = useMemo(() => {
    if (!selectedTier) return [];
    return rankedDestinations.filter((entry) => entry.commitmentTier === selectedTier);
  }, [rankedDestinations, selectedTier]);
  const subtitle = getDynamicSubtitle(weatherSignal, selectedTier, isWeekendWindow);

  if (isLoading) {
    return (
      <section className="mt-8">
        <FeedSectionHeader
          title="Pick Your Escape"
          subtitle="Regional anchors worth the drive"
          priority="secondary"
          accentColor="var(--gold)"
          icon={<Mountains weight="duotone" className="w-5 h-5" />}
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, idx) => (
            <div
              key={idx}
              className="h-[280px] rounded-2xl border border-[var(--twilight)]/40 skeleton-shimmer"
            />
          ))}
        </div>
      </section>
    );
  }

  if (destinations.length === 0 || !selectedTier) return null;

  return (
    <section className="mt-8">
      <FeedSectionHeader
        title="Pick Your Escape"
        subtitle={subtitle}
        priority="secondary"
        accentColor="var(--gold)"
        icon={<Mountains weight="duotone" className="w-5 h-5" />}
        seeAllHref={buildExploreUrl({ portalSlug, lane: "places" })}
        seeAllLabel="All spots"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {availableTiers.map((tier) => {
          const isActive = tier === selectedTier;
          return (
            <button
              key={tier}
              type="button"
              onClick={() => setActiveTier(tier)}
              className={`rounded-full border px-3 py-1.5 text-xs font-mono uppercase tracking-[0.12em] transition-colors ${
                isActive
                  ? "border-[var(--gold)]/50 bg-[var(--gold)]/12 text-[var(--gold)]"
                  : "border-[var(--twilight)]/50 text-[var(--muted)] hover:border-[var(--gold)]/30 hover:text-[var(--soft)]"
              }`}
            >
              {COMMITMENT_LABELS[tier]}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {filtered.map((destination) => {
          const weatherFit = destination.weatherFitTags
            .map((tag) => WEATHER_TAG_LABELS[tag])
            .filter((tag): tag is string => !!tag)
            .slice(0, 2);

          return (
            <Link
              key={destination.slug}
              href={`/${portalSlug}/spots/${destination.slug}`}
              className="group overflow-hidden rounded-2xl border border-[var(--twilight)]/40 bg-[var(--night)] transition-all hover:border-[var(--gold)]/35 hover:shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                {destination.imageUrl ? (
                  <Image
                    src={destination.imageUrl}
                    alt={destination.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(212,173,83,0.18),rgba(12,16,26,0.85))]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,10,16,0.95)] via-[rgba(8,10,16,0.18)] to-transparent" />

                <div className="absolute left-3 top-3">
                  <Badge variant="accent" accentColor="var(--gold)" size="sm">
                    {COMMITMENT_LABELS[destination.commitmentTier]}
                  </Badge>
                </div>

                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="text-2xs font-mono uppercase tracking-[0.14em] text-[var(--gold)]">
                    {destination.city}
                    {destination.state ? `, ${destination.state}` : ""}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold leading-tight text-white group-hover:text-[var(--gold)] transition-colors">
                    {destination.name}
                  </h3>
                </div>
              </div>

              <div className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-[var(--soft)]">
                  <span>{destination.driveTimeMinutes} min drive</span>
                  <span className="opacity-40">•</span>
                  <span>{formatDuration(destination.typicalDurationMinutes)}</span>
                  <span className="opacity-40">•</span>
                  <span className="capitalize">{destination.difficultyLevel}</span>
                </div>

                <p className="text-sm leading-relaxed text-[var(--soft)]">
                  {destination.summary}
                </p>

                {weatherFit.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {weatherFit.map((tag) => (
                      <Badge key={tag} variant="neutral" size="sm">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {destination.commitmentTier === "weekend" &&
                  destination.acceptsReservations !== null &&
                  destination.reservationRecommended !== null && (
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="accent"
                        accentColor={
                          destination.acceptsReservations
                            ? "var(--gold)"
                            : "var(--twilight)"
                        }
                        size="sm"
                      >
                        {destination.acceptsReservations
                          ? destination.reservationRecommended
                            ? "Book Ahead"
                            : "Booking Available"
                          : "Show Up"}
                      </Badge>
                      {destination.overnightSupport?.accommodationTypes?.[0] && (
                        <Badge variant="neutral" size="sm">
                          {destination.overnightSupport.accommodationTypes[0] === "campground"
                            ? "Camp"
                            : destination.overnightSupport.accommodationTypes[0] === "cabin"
                              ? "Cabin"
                              : destination.overnightSupport.accommodationTypes[0] === "lodge"
                                ? "Lodge"
                                : destination.overnightSupport.accommodationTypes[0] === "operator_trip"
                                  ? "Booked Trip"
                                  : "Day Use"}
                        </Badge>
                      )}
                      {destination.overnightSupport?.bookingStyle && (
                        <Badge variant="neutral" size="sm">
                          {BOOKING_STYLE_BADGES[destination.overnightSupport.bookingStyle]}
                        </Badge>
                      )}
                      {destination.overnightSupport?.stayProfile && (
                        <Badge variant="neutral" size="sm">
                          {LEAD_TIME_BADGES[destination.overnightSupport.stayProfile.leadTime]}
                        </Badge>
                      )}
                      {destination.accommodationInventorySource && (
                        <Badge variant="neutral" size="sm">
                          {
                            INVENTORY_COVERAGE_BADGES[
                              destination.accommodationInventorySource.coverageLevel
                            ]
                          }
                        </Badge>
                      )}
                    </div>
                  )}

                {destination.commitmentTier === "weekend" &&
                  destination.accommodationInventorySource && (
                    <p className="text-xs leading-relaxed text-[var(--muted)]">
                      Inventory source:{" "}
                      {
                        YONDER_INVENTORY_PROVIDERS[
                          destination.accommodationInventorySource.providerId
                        ].shortLabel
                      }
                      {" · "}
                      {destination.accommodationInventorySource.unitSummaries.length} tracked
                      stay mode
                      {destination.accommodationInventorySource.unitSummaries.length === 1
                        ? ""
                        : "s"}
                    </p>
                  )}

                {destination.commitmentTier === "weekend" &&
                  destination.runtimeInventorySnapshot &&
                  destination.runtimeInventorySnapshot.records.length > 0 && (
                    <div className="rounded-xl border border-[var(--twilight)]/25 bg-white/[0.02] p-3">
                      <p className="text-2xs font-mono uppercase tracking-[0.14em] text-[var(--muted)]">
                        {destination.runtimeInventorySnapshot.windowLabel}
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-[var(--soft)]">
                        {destination.runtimeInventorySnapshot.records
                          .slice(0, 2)
                          .map(
                            (record) =>
                              `${record.visibleInventoryCount} ${RUNTIME_UNIT_LABELS[record.unitType]}`,
                          )
                          .join(" · ")}
                      </p>
                      {destination.runtimeInventorySnapshot.records[0]?.sampleNightlyRate && (
                        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                          {destination.runtimeInventorySnapshot.records[0].sampleSiteLabel
                            ? `${destination.runtimeInventorySnapshot.records[0].sampleSiteLabel}`
                            : "Sample unit"}
                          {" · from "}
                          {destination.runtimeInventorySnapshot.records[0].sampleNightlyRate}
                          {destination.runtimeInventorySnapshot.records[0].sampleDetailStatus
                            ? ` · ${destination.runtimeInventorySnapshot.records[0].sampleDetailStatus === "bookable" ? "bookable" : destination.runtimeInventorySnapshot.records[0].sampleDetailStatus === "notify_only" ? "notify only" : "check availability"}`
                            : ""}
                        </p>
                      )}
                    </div>
                  )}

                <div className="rounded-xl border border-[var(--twilight)]/35 bg-white/[0.02] p-3">
                  <p className="text-2xs font-mono uppercase tracking-[0.14em] text-[var(--muted)]">
                    Why This Trip Works
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--cream)]">
                    {destination.whyItMatters}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-[var(--gold)]">
                  <span>{destination.questHooks[0] ?? "Regional escape"}</span>
                  <span className="inline-flex items-center gap-1">
                    Open
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
