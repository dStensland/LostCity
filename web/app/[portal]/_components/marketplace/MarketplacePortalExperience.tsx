import Image from "next/image";
import Link from "next/link";
import type { Portal } from "@/lib/portal-context";
import {
  getPCMEvents,
  getPCMTenants,
  getNeighborhoodEvents,
  getNeighborhoodVenues,
  type PCMEvent,
  type PCMTenant,
  type NeighborhoodEvent,
  type NeighborhoodVenue,
} from "@/lib/marketplace-data";
import {
  classifyTenant,
  TENANT_CATEGORY_LABELS,
  TENANT_CATEGORY_ORDER,
  PERSONA_CATEGORY_ORDER,
  type TenantCategory,
  type MarketplacePersona,
} from "@/lib/marketplace-art";
import { getLocalDateString } from "@/lib/formats";
import { getProxiedImageSrc } from "@/lib/image-proxy";
import MarketplaceSection from "./MarketplaceSection";
import MarketplaceTenantCard from "./MarketplaceTenantCard";
import MarketplaceEventCard from "./MarketplaceEventCard";
import MarketplaceTimeGreeting from "./MarketplaceTimeGreeting";
import MarketplaceNav from "./MarketplaceNav";

// ============================================================================
// Types
// ============================================================================

type MarketplacePortalExperienceProps = {
  portal: Portal;
  persona?: MarketplacePersona;
};

// ============================================================================
// Helpers
// ============================================================================

const PCM_HERO_IMAGE =
  "https://images.unsplash.com/photo-1565017228812-84e0dff015a0?auto=format&fit=crop&w=1800&q=80";

// Maximum instances of recurring events (e.g. weekly farmers market)
const MAX_RECURRING_INSTANCES = 2;

/**
 * Normalize a title for dedup comparison:
 * lowercase, strip non-alphanumeric, collapse whitespace.
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9\s']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fix broken title-case where apostrophe-S gets uppercased: "Valentine'S" → "Valentine's"
 */
function fixTitleCase(title: string): string {
  // Fix possessive S after apostrophe: Word'S → Word's
  let fixed = title.replace(/(\w)'S\b/g, "$1's");
  // If entire title is ALL CAPS (>60% uppercase letters), convert to title case
  const letters = fixed.replace(/[^a-zA-Z]/g, "");
  const upperCount = (letters.match(/[A-Z]/g) || []).length;
  if (letters.length > 3 && upperCount / letters.length > 0.6) {
    fixed = fixed
      .toLowerCase()
      .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
  }
  return fixed;
}

/**
 * Deduplicate events by normalized title + date.
 * Also limits recurring events (same normalized title, different dates) to MAX_RECURRING_INSTANCES.
 */
function deduplicateEvents<T extends { title: string; start_date: string }>(
  events: T[]
): T[] {
  const seen = new Set<string>();
  const recurringCount = new Map<string, number>();
  const result: T[] = [];

  for (const event of events) {
    const normTitle = normalizeTitle(event.title);
    const dayKey = `${normTitle}::${event.start_date}`;

    // Skip exact date duplicates
    if (seen.has(dayKey)) continue;
    seen.add(dayKey);

    // Limit recurring events across dates
    const count = recurringCount.get(normTitle) || 0;
    if (count >= MAX_RECURRING_INSTANCES) continue;
    recurringCount.set(normTitle, count + 1);

    result.push(event);
  }

  return result;
}

/**
 * Filter out junk events: venue-name-as-title, permanent attractions, etc.
 */
function isJunkEvent(event: { title: string; venue_name: string | null }): boolean {
  const normTitle = normalizeTitle(event.title);
  const normVenue = event.venue_name ? normalizeTitle(event.venue_name) : "";

  // Title is just the venue name
  if (normVenue && normTitle === normVenue) return true;

  // Title is suspiciously short (< 4 chars after normalization)
  if (normTitle.length < 4) return true;

  return false;
}

function formatShortDate(isoDate: string): string {
  const utcMidday = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(utcMidday);
}

function formatTime(time: string | null): string {
  if (!time) return "";
  const hour = Number(time.slice(0, 2));
  const minute = time.slice(3, 5);
  if (Number.isNaN(hour)) return time;
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  const period = hour >= 12 ? "PM" : "AM";
  return `${normalizedHour}:${minute} ${period}`;
}

function groupEventsByDate(events: PCMEvent[]): Map<string, PCMEvent[]> {
  const groups = new Map<string, PCMEvent[]>();
  for (const event of events) {
    const existing = groups.get(event.start_date) || [];
    existing.push(event);
    groups.set(event.start_date, existing);
  }
  return groups;
}

function groupTenantsByCategory(
  tenants: PCMTenant[],
  categoryOrder: TenantCategory[]
): { category: TenantCategory; label: string; tenants: PCMTenant[] }[] {
  const buckets = new Map<TenantCategory, PCMTenant[]>();

  for (const tenant of tenants) {
    const cat = classifyTenant(tenant.venue_type, tenant.vibes);
    const existing = buckets.get(cat) || [];
    existing.push(tenant);
    buckets.set(cat, existing);
  }

  return categoryOrder
    .filter((cat) => buckets.has(cat))
    .map((cat) => ({
      category: cat,
      label: TENANT_CATEGORY_LABELS[cat],
      tenants: buckets.get(cat)!,
    }));
}

// ============================================================================
// Main Component
// ============================================================================

export default async function MarketplacePortalExperience({
  portal,
  persona = "visitor",
}: MarketplacePortalExperienceProps) {
  const [rawPcmEvents, pcmTenants, rawNeighborhoodEvents, neighborhoodVenues] =
    await Promise.all([
      getPCMEvents(60),
      getPCMTenants(),
      getNeighborhoodEvents(40),
      getNeighborhoodVenues(12),
    ]);

  // Clean up event data: fix titles, remove junk, deduplicate
  const pcmEvents = deduplicateEvents(
    rawPcmEvents
      .filter((e) => !isJunkEvent(e))
      .map((e) => ({ ...e, title: fixTitleCase(e.title) }))
  );

  const neighborhoodEvents = deduplicateEvents(
    rawNeighborhoodEvents
      .filter((e) => !isJunkEvent(e))
      .map((e) => ({ ...e, title: fixTitleCase(e.title) }))
  );

  const today = getLocalDateString();
  const todayEvents = pcmEvents.filter((e) => e.start_date === today);

  // Next 7 days events (including today)
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split("T")[0];
  const thisWeekEvents = pcmEvents.filter(
    (e) => e.start_date >= today && e.start_date <= weekEndStr
  );
  const weekGrouped = groupEventsByDate(thisWeekEvents);

  // Tenant directory with persona-specific ordering
  const categoryOrder =
    PERSONA_CATEGORY_ORDER[persona] || TENANT_CATEGORY_ORDER;
  const tenantGroups = groupTenantsByCategory(pcmTenants, categoryOrder);

  // Find The Roof venue if it exists
  const roofTenant = pcmTenants.find(
    (t) =>
      t.name.toLowerCase().includes("roof") ||
      t.vibes.some((v) => v.includes("rooftop"))
  );

  const hasBeltLineContent =
    neighborhoodEvents.length > 0 || neighborhoodVenues.length > 0;

  return (
    <div className="mkt-enter">
      {/* ================================================================
          HERO
          ================================================================ */}
      <section className="relative -mx-4 mb-8 overflow-hidden rounded-b-3xl sm:rounded-b-[2rem]">
        <div className="relative h-[340px] sm:h-[400px] md:h-[460px]">
          <Image
            src={PCM_HERO_IMAGE}
            alt="Ponce City Market"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 mkt-hero-gradient" />
          <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8 md:p-10">
            <MarketplaceTimeGreeting persona={persona} />
            <p className="mt-2 font-body text-sm sm:text-base text-white/80 max-w-lg">
              Atlanta&apos;s iconic market on the BeltLine — food, shops,
              rooftop views, and neighborhood culture in one destination.
            </p>
          </div>
        </div>
      </section>

      {/* Sticky Nav */}
      <MarketplaceNav />

      <div className="space-y-12 mt-8">
        {/* ================================================================
            HAPPENING TODAY
            ================================================================ */}
        <MarketplaceSection
          id="today"
          kicker="What&apos;s On"
          title="Happening Today"
          subtitle={
            todayEvents.length > 0
              ? `${todayEvents.length} event${todayEvents.length !== 1 ? "s" : ""} at the Market today`
              : undefined
          }
        >
          {todayEvents.length > 0 ? (
            <div className="space-y-2 mkt-grid">
              {todayEvents.map((event) => (
                <MarketplaceEventCard
                  key={event.id}
                  id={event.id}
                  title={event.title}
                  startDate={event.start_date}
                  startTime={event.start_time}
                  imageUrl={event.image_url}
                  venueName={event.venue_name}
                  category={event.category}
                  tags={event.tags}
                  portalSlug={portal.slug}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--mkt-sand)] bg-white p-8 text-center">
              <p className="text-[var(--mkt-steel)] font-body text-sm">
                No scheduled events today — explore the Market&apos;s shops and
                restaurants below.
              </p>
              <a
                href="#eat-drink"
                className="mt-3 inline-block text-xs font-label uppercase tracking-[0.1em] text-[var(--mkt-brick)] hover:text-[var(--mkt-amber)] transition-colors"
              >
                Explore the Market &rarr;
              </a>
            </div>
          )}
        </MarketplaceSection>

        <div className="mkt-divider" />

        {/* ================================================================
            EAT & DRINK
            ================================================================ */}
        <MarketplaceSection
          id="eat-drink"
          kicker="Tenant Directory"
          title="Eat & Drink"
          subtitle="30+ restaurants, bars, and food stalls under one historic roof"
        >
          {tenantGroups.length > 0 ? (
            <div className="space-y-8">
              {tenantGroups.map((group) => (
                <div key={group.category}>
                  <h3 className="font-label text-xs uppercase tracking-[0.1em] text-[var(--mkt-steel)] mb-3">
                    {group.label}
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2 mkt-grid">
                    {group.tenants.map((tenant) => (
                      <MarketplaceTenantCard
                        key={tenant.id}
                        tenant={tenant}
                        portalSlug={portal.slug}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--mkt-sand)] bg-white p-8 text-center">
              <p className="text-[var(--mkt-steel)] font-body text-sm">
                Tenant directory coming soon. Visit{" "}
                <a
                  href="https://poncecitymarket.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--mkt-brick)] underline"
                >
                  poncecitymarket.com
                </a>{" "}
                for the full listing.
              </p>
            </div>
          )}
        </MarketplaceSection>

        <div className="mkt-divider" />

        {/* ================================================================
            THE ROOF
            ================================================================ */}
        <MarketplaceSection
          id="the-roof"
          kicker="Rooftop"
          title="The Roof"
          subtitle="Skyline views, mini golf, games, and seasonal pop-ups"
        >
          <div className="relative overflow-hidden rounded-2xl border border-[var(--mkt-sand)] bg-gradient-to-br from-[var(--mkt-sky)]/10 to-[var(--mkt-cream)]">
            <div className="p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--mkt-sky)]/15 text-2xl">
                  🎡
                </div>
                <div>
                  <h3 className="font-display text-xl font-semibold text-[var(--mkt-charcoal)]">
                    {roofTenant?.name || "The Roof at Ponce City Market"}
                  </h3>
                  <p className="mt-1 font-body text-sm text-[var(--mkt-steel)] leading-relaxed max-w-lg">
                    Atlanta&apos;s favorite rooftop destination — amusement
                    park rides, carnival games, skyline mini golf, and craft
                    cocktails with panoramic views of the city.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["Mini Golf", "Skyline Views", "Games", "Cocktails"].map(
                      (tag) => (
                        <span
                          key={tag}
                          className="inline-block rounded-full border border-[var(--mkt-sand)] bg-white/60 px-2.5 py-1 text-[10px] font-label uppercase tracking-[0.08em] text-[var(--mkt-steel)]"
                        >
                          {tag}
                        </span>
                      )
                    )}
                  </div>
                  {roofTenant?.slug && (
                    <Link
                      href={`/${portal.slug}?spot=${roofTenant.slug}`}
                      className="mt-4 inline-block text-xs font-label uppercase tracking-[0.1em] text-[var(--mkt-sky)] hover:text-[var(--mkt-brick)] transition-colors"
                    >
                      View Details &rarr;
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </MarketplaceSection>

        <div className="mkt-divider" />

        {/* ================================================================
            BELTLINE & NEIGHBORHOOD
            ================================================================ */}
        {hasBeltLineContent && (
          <>
            <MarketplaceSection
              id="beltline"
              kicker="Beyond the Market"
              title="BeltLine & Neighborhood"
              subtitle="What&apos;s happening steps away on the Atlanta BeltLine and in Old Fourth Ward"
            >
              <div className="space-y-6">
                {/* Neighborhood Events */}
                {neighborhoodEvents.length > 0 && (
                  <div>
                    <h3 className="font-label text-xs uppercase tracking-[0.1em] text-[var(--mkt-steel)] mb-3">
                      Nearby Events
                    </h3>
                    <div className="space-y-2 mkt-grid">
                      {neighborhoodEvents.slice(0, 8).map((event) => (
                        <MarketplaceEventCard
                          key={event.id}
                          id={event.id}
                          title={event.title}
                          startDate={event.start_date}
                          startTime={event.start_time}
                          imageUrl={event.image_url}
                          venueName={event.venue_name}
                          category={event.category}
                          tags={event.tags}
                          portalSlug={portal.slug}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Neighborhood Venues */}
                {neighborhoodVenues.length > 0 && (
                  <div>
                    <h3 className="font-label text-xs uppercase tracking-[0.1em] text-[var(--mkt-steel)] mb-3">
                      Nearby Spots
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 mkt-grid">
                      {neighborhoodVenues.map((venue) => (
                        <Link
                          key={venue.id}
                          href={`/${portal.slug}?spot=${venue.slug}`}
                          className="group flex items-center gap-3 rounded-xl border border-[var(--mkt-sand)] bg-white p-3 transition-all hover:border-[var(--mkt-beltline)]/30 hover:shadow-[var(--mkt-shadow-soft)]"
                        >
                          <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--mkt-cream)]">
                            {venue.image_url ? (
                              <Image
                                src={getProxiedImageSrc(venue.image_url)}
                                alt={venue.name}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs font-display text-[var(--mkt-steel)]">
                                {venue.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-body font-medium text-[var(--mkt-charcoal)] truncate group-hover:text-[var(--mkt-beltline)] transition-colors">
                              {venue.name}
                            </p>
                            {venue.neighborhood && (
                              <p className="text-[10px] font-label text-[var(--mkt-steel)] truncate">
                                {venue.neighborhood}
                              </p>
                            )}
                          </div>
                          {venue.vibes.some((v) =>
                            v.toLowerCase().includes("beltline")
                          ) && (
                            <span className="ml-auto flex-shrink-0 px-1.5 py-0.5 rounded text-[8px] font-label uppercase tracking-[0.08em] mkt-beltline-tag">
                              BeltLine
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </MarketplaceSection>

            <div className="mkt-divider" />
          </>
        )}

        {/* ================================================================
            THIS WEEK
            ================================================================ */}
        <MarketplaceSection
          id="this-week"
          kicker="Coming Up"
          title="This Week at the Market"
          subtitle={
            thisWeekEvents.length > 0
              ? `${thisWeekEvents.length} event${thisWeekEvents.length !== 1 ? "s" : ""} over the next 7 days`
              : undefined
          }
        >
          {thisWeekEvents.length > 0 ? (
            <div className="space-y-6">
              {Array.from(weekGrouped.entries()).map(([date, events]) => (
                <div key={date}>
                  <h3 className="font-label text-xs uppercase tracking-[0.1em] text-[var(--mkt-steel)] mb-2">
                    {formatShortDate(date)}
                  </h3>
                  <div className="space-y-2">
                    {events.map((event) => (
                      <MarketplaceEventCard
                        key={event.id}
                        id={event.id}
                        title={event.title}
                        startDate={event.start_date}
                        startTime={event.start_time}
                        imageUrl={event.image_url}
                        venueName={event.venue_name}
                        category={event.category}
                        tags={event.tags}
                        portalSlug={portal.slug}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--mkt-sand)] bg-white p-8 text-center">
              <p className="text-[var(--mkt-steel)] font-body text-sm">
                No upcoming events this week — check back soon or explore the
                Market&apos;s restaurants and shops.
              </p>
            </div>
          )}
        </MarketplaceSection>
      </div>

      {/* Bottom Spacing */}
      <div className="h-16" />
    </div>
  );
}
