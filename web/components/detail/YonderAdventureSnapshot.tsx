import Badge from "@/components/ui/Badge";
import type {
  YonderAccommodationInventorySource,
  YonderInventoryCoverageLevel,
  YonderInventoryIntegrationStatus,
  YonderUnitInventoryBand,
} from "@/config/yonder-accommodation-inventory";
import { YONDER_INVENTORY_PROVIDERS } from "@/config/yonder-accommodation-inventory";
import type {
  YonderRuntimeInventoryRecord,
  YonderRuntimeInventorySnapshot,
} from "@/lib/yonder-provider-inventory";
import { MetadataGrid, type MetadataItem } from "./MetadataGrid";
import { SectionHeader } from "./SectionHeader";
import type {
  YonderAccommodationType,
  YonderDestinationIntelligence,
  YonderStayUnitType,
  YonderWeatherFitTag,
} from "@/config/yonder-destination-intelligence";

type YonderAdventureSnapshotProps = {
  intelligence: YonderDestinationIntelligence;
  accommodationInventorySource?: YonderAccommodationInventorySource | null;
  runtimeInventorySnapshot?: YonderRuntimeInventorySnapshot | null;
  bookingSupport?: {
    acceptsReservations: boolean | null;
    reservationRecommended: boolean | null;
    reservationUrl: string | null;
  };
};

const COMMITMENT_LABELS: Record<YonderDestinationIntelligence["commitmentTier"], string> = {
  hour: "An Hour",
  halfday: "Half Day",
  fullday: "Full Day",
  weekend: "Weekend",
};

const DIFFICULTY_LABELS: Record<YonderDestinationIntelligence["difficultyLevel"], string> = {
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
};

const WEATHER_TAG_LABELS: Record<YonderWeatherFitTag, string> = {
  "after-rain": "Best After Rain",
  "heat-exposed": "Heat Exposed",
  "summer-friendly": "Summer Friendly",
  "cool-weather": "Cool Weather",
  "leaf-season": "Leaf Season",
  "clear-day": "Clear Day",
  "all-season": "All Season",
  "dry-weather": "Dry Weather",
  "sunrise-friendly": "Sunrise Friendly",
};

const ACCOMMODATION_LABELS: Record<YonderAccommodationType, string> = {
  campground: "Campground",
  cabin: "Cabin",
  lodge: "Lodge",
  operator_trip: "Operator Trip",
  day_use_only: "Day Use",
};

const STAY_UNIT_LABELS: Record<YonderStayUnitType, string> = {
  tent_site: "Tent Site",
  rv_site: "RV Site",
  cabin: "Cabin",
  lodge_room: "Lodge Room",
  guide_package: "Guide Package",
  day_use: "Day Use",
};

const BOOKING_STYLE_LABELS = {
  reserveamerica_park: "Georgia State Parks",
  direct_lodge: "Direct Lodge",
  operator_direct: "Direct Operator",
  self_planned: "Self-Planned",
} as const;

const INVENTORY_DEPTH_LABELS = {
  single_mode: "Single Mode",
  focused: "Focused",
  balanced: "Balanced",
  broad: "Broad Mix",
} as const;

const LEAD_TIME_LABELS = {
  self_planned: "Self-Planned",
  same_week: "Same Week",
  book_early: "Plan Early",
  seasonal_rush: "Peak Dates",
} as const;

const INVENTORY_COVERAGE_LABELS: Record<YonderInventoryCoverageLevel, string> = {
  coarse_unit_mix: "Unit Mix Ready",
  package_only: "Package Inventory",
  self_guided: "Self Guided",
};

const INTEGRATION_STATUS_LABELS: Record<YonderInventoryIntegrationStatus, string> = {
  manual_link: "Manual Link",
  operator_checkout: "Operator Checkout",
  self_guided: "No Booking Flow",
};

const INVENTORY_BAND_LABELS: Record<YonderUnitInventoryBand, string> = {
  limited: "Limited",
  moderate: "Moderate",
  broad: "Broad",
};

const RUNTIME_UNIT_LABELS: Record<YonderRuntimeInventoryRecord["unitType"], string> = {
  tent_site: "Tent Sites",
  cabin: "Cabins",
  backcountry_site: "Backcountry",
  group_site: "Group Sites",
  group_lodge: "Group Lodge",
  guide_package: "Guide Packages",
  yurt: "Yurts",
  other: "Other Units",
};

function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!minutes) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours} hr ${minutes} min`;
}

function formatSeason(season: string): string {
  return season.charAt(0).toUpperCase() + season.slice(1);
}

export default function YonderAdventureSnapshot({
  intelligence,
  accommodationInventorySource,
  runtimeInventorySnapshot,
  bookingSupport,
}: YonderAdventureSnapshotProps) {
  const metadataItems: MetadataItem[] = [
    {
      label: "Commitment",
      value: COMMITMENT_LABELS[intelligence.commitmentTier],
      color: "var(--gold)",
    },
    {
      label: "Difficulty",
      value: DIFFICULTY_LABELS[intelligence.difficultyLevel],
      color: "var(--neon-green)",
    },
    {
      label: "Drive",
      value: `${intelligence.driveTimeMinutes} min`,
    },
    {
      label: "Duration",
      value: formatDuration(intelligence.typicalDurationMinutes),
    },
  ];
  const inventoryProvider = accommodationInventorySource
    ? YONDER_INVENTORY_PROVIDERS[accommodationInventorySource.providerId]
    : null;

  return (
    <section className="space-y-4">
      <SectionHeader title="Adventure Snapshot" variant="divider" />

      <div className="rounded-2xl border border-[var(--twilight)]/40 bg-[var(--night)]/70 p-4 sm:p-5 space-y-4">
        <MetadataGrid items={metadataItems} className="gap-x-6 gap-y-3" />

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-[var(--soft)]">
              {intelligence.summary}
            </p>
            <div className="rounded-xl border border-[var(--gold)]/20 bg-[var(--gold)]/[0.04] p-3">
              <p className="text-2xs font-mono uppercase tracking-[0.14em] text-[var(--gold)]">
                Why It Matters
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--cream)]">
                {intelligence.whyItMatters}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-2xs font-mono uppercase tracking-[0.14em] text-[var(--muted)]">
                Best Seasons
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {intelligence.bestSeasons.map((season) => (
                  <Badge key={season} variant="neutral" size="sm">
                    {formatSeason(season)}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="text-2xs font-mono uppercase tracking-[0.14em] text-[var(--muted)]">
                Weather Fit
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {intelligence.weatherFitTags.map((tag) => (
                  <Badge key={tag} variant="neutral" size="sm">
                    {WEATHER_TAG_LABELS[tag]}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-2xs font-mono uppercase tracking-[0.14em] text-[var(--muted)]">
              Practical Notes
            </p>
            <ul className="mt-2 space-y-2">
              {intelligence.practicalNotes.map((note) => (
                <li key={note} className="flex items-start gap-2 text-sm leading-relaxed text-[var(--soft)]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--coral)]" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-2xs font-mono uppercase tracking-[0.14em] text-[var(--muted)]">
              Quest Hooks
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {intelligence.questHooks.map((hook) => (
                <Badge
                  key={hook}
                  variant="accent"
                  accentColor="var(--coral)"
                  size="sm"
                >
                  {hook}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {bookingSupport &&
          bookingSupport.acceptsReservations !== null &&
          bookingSupport.reservationRecommended !== null && (
            <div className="rounded-xl border border-[var(--twilight)]/30 bg-[var(--twilight)]/10 p-3">
              <p className="text-2xs font-mono uppercase tracking-[0.14em] text-[var(--muted)]">
                Booking Readiness
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--soft)]">
                {bookingSupport.acceptsReservations
                  ? bookingSupport.reservationRecommended
                    ? "Reservations are available and usually worth handling ahead of time for this one."
                    : "Reservations are available, but this is usually manageable without hard advance planning."
                  : "This is generally a show-up-and-go destination rather than a booking-driven plan."}
              </p>
              {bookingSupport.reservationUrl && (
                <a
                  href={bookingSupport.reservationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center rounded-full border border-[var(--gold)]/40 px-3 py-1.5 text-xs font-mono uppercase tracking-[0.12em] text-[var(--gold)] transition hover:border-[var(--gold)] hover:bg-[var(--gold)]/10"
                >
                  Open Booking Link
                </a>
              )}
            </div>
          )}

        {intelligence.overnightSupport && (
          <div className="rounded-xl border border-[var(--twilight)]/30 bg-[var(--twilight)]/10 p-3">
            <p className="text-2xs font-mono uppercase tracking-[0.14em] text-[var(--muted)]">
              Overnight Setup
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {intelligence.overnightSupport.accommodationTypes.map((type) => (
                <Badge key={type} variant="neutral" size="sm">
                  {ACCOMMODATION_LABELS[type]}
                </Badge>
              ))}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--soft)]">
              {intelligence.overnightSupport.inventoryNote}
            </p>
            <p className="mt-2 text-xs font-mono uppercase tracking-[0.12em] text-[var(--gold)]">
              Booking Surface: {BOOKING_STYLE_LABELS[intelligence.overnightSupport.bookingStyle]}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="neutral" size="sm">
                {INVENTORY_DEPTH_LABELS[intelligence.overnightSupport.stayProfile.inventoryDepth]}
              </Badge>
              <Badge variant="neutral" size="sm">
                {LEAD_TIME_LABELS[intelligence.overnightSupport.stayProfile.leadTime]}
              </Badge>
              <Badge variant="neutral" size="sm">
                {intelligence.overnightSupport.stayProfile.priceSignal}
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--soft)]">
              {intelligence.overnightSupport.stayProfile.comparisonNote}
            </p>
            {inventoryProvider && accommodationInventorySource && (
              <div className="mt-3 rounded-lg border border-[var(--twilight)]/20 bg-black/10 p-2.5">
                <p className="text-2xs font-mono uppercase tracking-[0.12em] text-[var(--muted)]">
                  Inventory Source
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--cream)]">
                  {inventoryProvider.label}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="neutral" size="sm">
                    {INVENTORY_COVERAGE_LABELS[accommodationInventorySource.coverageLevel]}
                  </Badge>
                  <Badge variant="neutral" size="sm">
                    {
                      INTEGRATION_STATUS_LABELS[
                        accommodationInventorySource.integrationStatus
                      ]
                    }
                  </Badge>
                  <Badge variant="neutral" size="sm">
                    {inventoryProvider.providerHasLiveAvailability
                      ? "Provider Live Inventory"
                      : "No Live Inventory"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[var(--soft)]">
                  {accommodationInventorySource.sourceNote}
                </p>
              </div>
            )}
            {runtimeInventorySnapshot && runtimeInventorySnapshot.records.length > 0 && (
              <div className="mt-3 rounded-lg border border-[var(--twilight)]/20 bg-black/10 p-2.5">
                <p className="text-2xs font-mono uppercase tracking-[0.12em] text-[var(--muted)]">
                  Live Park Snapshot
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--cream)]">
                  {runtimeInventorySnapshot.windowLabel}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--soft)]">
                  {runtimeInventorySnapshot.totalResults
                    ? `${runtimeInventorySnapshot.totalResults} visible unit results across the provider search surface.`
                    : "Visible unit counts pulled from the current provider search surface."}
                </p>
                <div className="mt-3 space-y-2">
                  {runtimeInventorySnapshot.records.slice(0, 4).map((record) => (
                    <div
                      key={record.unitType}
                      className="rounded-lg border border-[var(--twilight)]/15 bg-black/10 p-2.5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="neutral" size="sm">
                          {RUNTIME_UNIT_LABELS[record.unitType]}
                        </Badge>
                        <p className="text-xs font-mono uppercase tracking-[0.12em] text-[var(--gold)]">
                          {record.visibleInventoryCount} visible
                        </p>
                        {record.sampleNightlyRate && (
                          <Badge variant="neutral" size="sm">
                            From {record.sampleNightlyRate}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-[var(--soft)]">
                        {record.rawLabels.join(", ")}
                      </p>
                      {(record.sampleNightlyRate || record.sampleDetailStatus) && (
                        <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
                          {record.sampleSiteLabel ? `${record.sampleSiteLabel}` : "Sample unit"}
                          {" · "}
                          {record.sampleDetailStatus
                            ? `${record.sampleDetailStatus === "bookable" ? "Sample unit is currently bookable" : record.sampleDetailStatus === "notify_only" ? "Sample unit is notify-only for this date window" : `Sample unit status: ${record.sampleDetailStatus}`}`
                            : "Sample unit inspected"}
                          {record.sampleNightlyRate
                            ? ` · sample nightly ${record.sampleNightlyRate}`
                            : ""}
                          {record.sampleWeeklyRate
                            ? ` · weekly ${record.sampleWeeklyRate}`
                            : ""}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {intelligence.overnightSupport.stayOptions.length > 0 && (
              <div className="mt-3 space-y-2">
                {intelligence.overnightSupport.stayOptions.map((option) => {
                  const inventoryUnit = accommodationInventorySource?.unitSummaries.find(
                    (unit) => unit.unitType === option.unitType,
                  );

                  return (
                    <div
                      key={`${option.unitType}-${option.label}`}
                      className="rounded-lg border border-[var(--twilight)]/20 bg-black/10 p-2.5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="neutral" size="sm">
                          {STAY_UNIT_LABELS[option.unitType]}
                        </Badge>
                        <p className="text-xs font-mono uppercase tracking-[0.12em] text-[var(--gold)]">
                          {option.label}
                        </p>
                        {inventoryUnit && (
                          <>
                            <Badge variant="neutral" size="sm">
                              {INVENTORY_BAND_LABELS[inventoryUnit.inventoryBand]}
                            </Badge>
                            {inventoryUnit.priceSignal && (
                              <Badge variant="neutral" size="sm">
                                {inventoryUnit.priceSignal}
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-[var(--soft)]">
                        {option.summary}
                      </p>
                      {inventoryUnit && (
                        <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
                          {inventoryUnit.note}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
