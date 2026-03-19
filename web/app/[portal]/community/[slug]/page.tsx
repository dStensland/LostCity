import { notFound } from "next/navigation";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { getCachedPortalBySlug } from "@/lib/portal";
import { PortalHeader } from "@/components/headers";
import ScopedStylesServer from "@/components/ScopedStylesServer";
import { createCssVarClass } from "@/lib/css-utils";
import FollowButton from "@/components/FollowButton";
import RecommendButton from "@/components/RecommendButton";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import { EntityTagList } from "@/components/tags/EntityTagList";
import type { Event } from "@/lib/supabase";
import type { Metadata } from "next";
import {
  DetailHero,
  InfoCard,
  MetadataGrid,
  SectionHeader,
  RelatedSection,
  RelatedCard,
  DetailStickyBar,
} from "@/components/detail";
import { getLocalDateString, safeJsonLd } from "@/lib/formats";
import {
  formatCommitmentLevel,
  formatOnboardingLevel,
  getVolunteerOpportunitiesForOrganization,
  type VolunteerOpportunity,
} from "@/lib/volunteer-opportunities";

export const revalidate = 300;

// Org type configuration
const ORG_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  arts_nonprofit: { label: "Arts & Culture", color: "var(--neon-violet)" },
  film_society: { label: "Film", color: "var(--neon-indigo)" },
  community_group: { label: "Community", color: "var(--neon-emerald)" },
  running_club: { label: "Fitness", color: "var(--neon-teal)" },
  cultural_org: { label: "Cultural", color: "var(--neon-amber)" },
  food_festival: { label: "Food & Drink", color: "var(--neon-orange)" },
  venue: { label: "Venue", color: "var(--neon-purple)" },
  festival: { label: "Festival", color: "var(--neon-pink)" },
  other: { label: "Organization", color: "var(--neon-magenta)" },
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  org_type: string;
  website: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  twitter: string | null;
  logo_url: string | null;
  description: string | null;
  categories: string[] | null;
  neighborhood: string | null;
  city: string | null;
  featured: boolean;
};

function formatTimeHorizon(value: VolunteerOpportunity["time_horizon"]): string | null {
  if (value === "multi_month") return "Multi-month";
  if (value === "multi_week") return "Multi-week";
  if (value === "one_day") return "One day";
  if (value === "ongoing") return "Open-ended";
  return null;
}

// Cache organization data
const getOrganization = unstable_cache(
  async (slug: string): Promise<Organization | null> => {
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("slug", slug)
      .eq("hidden", false)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as Organization;
  },
  ["organization-by-slug"],
  { revalidate: 600, tags: ["organization"] }
);

// Cache organization events
const getOrganizationEvents = unstable_cache(
  async (organizationId: string): Promise<Event[]> => {
    const today = getLocalDateString();

    const { data, error } = await supabase
      .from("events")
      .select(`
        *,
        venue:venues(id, name, slug, address, neighborhood, city, state)
      `)
      .eq("organization_id", organizationId)
      .gte("start_date", today)
      .or("is_sensitive.eq.false,is_sensitive.is.null")
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(50);

    if (error || !data) {
      return [];
    }

    return data as Event[];
  },
  ["organization-events"],
  { revalidate: 300, tags: ["organization-events"] }
);

// Cache similar organizations
const getSimilarOrganizations = unstable_cache(
  async (organizationId: string, orgType: string, categories: string[] | null): Promise<Organization[]> => {
    let query = supabase
      .from("organizations")
      .select("*")
      .eq("hidden", false)
      .neq("id", organizationId)
      .limit(6);

    // Try to match by org type first
    if (orgType) {
      query = query.eq("org_type", orgType);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      // Fallback: try matching by shared categories
      if (categories && categories.length > 0) {
        const { data: fallbackData } = await supabase
          .from("organizations")
          .select("*")
          .eq("hidden", false)
          .neq("id", organizationId)
          .contains("categories", categories)
          .limit(6);

        return (fallbackData || []) as Organization[];
      }
      return [];
    }

    return data as Organization[];
  },
  ["similar-orgs"],
  { revalidate: 600, tags: ["organization"] }
);

// Helper to extract domain from URL
function getDomainFromUrl(url: string): string {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    return domain;
  } catch {
    return url;
  }
}

// Helper to format org type
function formatOrgType(orgType: string): string {
  const config = ORG_TYPE_CONFIG[orgType];
  if (config) return config.label;
  return orgType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Helper to get org type color
function getOrgTypeColor(orgType: string): string {
  return ORG_TYPE_CONFIG[orgType]?.color || ORG_TYPE_CONFIG.other.color;
}

// Helper to format event time for display
function formatEventTime(event: Event): string {
  const dateStr = new Date(event.start_date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  if (event.start_time) {
    const [hours, minutes] = event.start_time.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${dateStr} · ${displayHour}:${minutes} ${ampm}`;
  }

  return dateStr;
}

type Props = {
  params: Promise<{ portal: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, portal: portalSlug } = await params;
  const organization = await getOrganization(slug);
  const portal = await getCachedPortalBySlug(portalSlug);

  if (!organization) {
    return {
      title: "Organization Not Found | Lost City",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const portalName = portal?.name || "Lost City";
  const description = organization.description || `Discover events and experiences from ${organization.name} in Atlanta.`;

  return {
    title: `${organization.name} | ${portalName}`,
    description,
    alternates: {
      canonical: `/${portal?.slug || portalSlug}/community/${slug}`,
    },
    openGraph: {
      title: organization.name,
      description,
      type: "website",
      images: organization.logo_url ? [{ url: organization.logo_url }] : [],
    },
  };
}

// Generate Organization schema for SEO
function generateOrganizationSchema(organization: Organization) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: organization.name,
  };

  if (organization.description) {
    schema.description = organization.description;
  }

  if (organization.logo_url) {
    schema.logo = organization.logo_url;
    schema.image = organization.logo_url;
  }

  if (organization.website) {
    schema.url = organization.website;
  }

  if (organization.email) {
    schema.email = organization.email;
  }

  const sameAs: string[] = [];
  if (organization.instagram) {
    sameAs.push(`https://instagram.com/${organization.instagram.replace("@", "")}`);
  }
  if (organization.facebook) {
    sameAs.push(organization.facebook);
  }
  if (organization.twitter) {
    sameAs.push(`https://twitter.com/${organization.twitter.replace("@", "")}`);
  }
  if (sameAs.length > 0) {
    schema.sameAs = sameAs;
  }

  if (organization.city || organization.neighborhood) {
    schema.address = {
      "@type": "PostalAddress",
      addressLocality: organization.city || "Atlanta",
      addressRegion: "GA",
      addressCountry: "US",
    };
  }

  return schema;
}

export default async function PortalOrganizerPage({ params }: Props) {
  const { portal: portalSlug, slug } = await params;
  const organization = await getOrganization(slug);
  const portal = await getCachedPortalBySlug(portalSlug);

  if (!organization) {
    notFound();
  }

  // Use the URL portal or fall back
  const activePortalSlug = portal?.slug || portalSlug;
  const activePortalName = portal?.name || portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);
  const claimHref = `/claim?${new URLSearchParams({
    type: "organization",
    id: organization.id,
    name: organization.name,
    return: `/${activePortalSlug}/community/${organization.slug}`,
  }).toString()}`;

  // Fetch data in parallel
  const [events, similarOrgs, volunteerOpportunities] = await Promise.all([
    getOrganizationEvents(organization.id),
    getSimilarOrganizations(organization.id, organization.org_type, organization.categories),
    getVolunteerOpportunitiesForOrganization({ organizationSlug: organization.slug, limit: 8 }),
  ]);

  const orgColor = getOrgTypeColor(organization.org_type);
  const orgAccentClass = createCssVarClass("--accent-color", orgColor, "org-accent");
  const categoryAccentClasses = Object.fromEntries(
    (organization.categories || []).map((cat) => [
      cat,
      createCssVarClass("--accent-color", getCategoryColor(cat), "org-category"),
    ])
  ) as Record<string, ReturnType<typeof createCssVarClass> | null>;
  const scopedCss = [
    orgAccentClass?.css,
    ...Object.values(categoryAccentClasses).map((entry) => entry?.css),
  ]
    .filter(Boolean)
    .join("\n");
  const organizationSchema = generateOrganizationSchema(organization);

  // Format location display
  const locationDisplay = [organization.neighborhood, organization.city]
    .filter(Boolean)
    .join(", ") || "Atlanta";
  const previewEvents = events.slice(0, 8);
  const remainingPreviewCount = Math.max(0, events.length - previewEvents.length);

  return (
    <>
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(organizationSchema) }}
      />



      <ScopedStylesServer css={scopedCss} />

      <div className="min-h-screen">
        <PortalHeader
          portalSlug={activePortalSlug}
          portalName={activePortalName}
          hideNav
        />

        <main data-clean-detail="true" className="max-w-5xl mx-auto px-4 py-4 sm:py-6 pb-36 md:pb-16 space-y-6 sm:space-y-9">
          {/* Hero Section */}
          <DetailHero
            mode="poster"
            imageUrl={organization.logo_url}
            title={organization.name}
            subtitle={locationDisplay}
            categoryColor={orgColor}
            backFallbackHref={`/${activePortalSlug}`}
            categoryIcon={
              organization.categories?.[0] ? (
                <CategoryIcon type={organization.categories[0]} size={48} />
              ) : (
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              )
            }
            badge={
              <span
                className={`inline-flex items-center px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider bg-accent-20 text-accent border border-accent-40 ${
                  orgAccentClass?.className ?? ""
                }`}
              >
                {formatOrgType(organization.org_type)}
              </span>
            }
          >
            {/* Follow/Recommend buttons in hero */}
            <div className="flex items-center gap-2 mt-4">
              <FollowButton targetOrganizationId={organization.id} size="sm" />
              <RecommendButton organizationId={organization.id} size="sm" />
              <Link
                href={claimHref}
                className="text-[var(--muted)] hover:text-[var(--cream)] font-mono text-xs"
              >
                Claim this organization
              </Link>
            </div>
          </DetailHero>

          {/* Overview Card */}
          <InfoCard accentColor={orgColor} className="!bg-[var(--night)] !border-[var(--twilight)]/90">
            <SectionHeader title="At a Glance" className="border-t-0 pt-0 pb-2" />
            <p className="text-sm text-[var(--muted)] mb-4">
              Start with the essentials, then browse next events and full organization details.
            </p>
            {/* Metadata Grid */}
            <MetadataGrid
              items={[
                { label: "Type", value: formatOrgType(organization.org_type) },
                { label: "Location", value: locationDisplay },
                { label: "Events", value: `${events.length} upcoming` },
                { label: "Volunteer roles", value: `${volunteerOpportunities.length} active` },
              ]}
              className="mb-6"
            />

            {/* Description */}
            {organization.description && (
              <>
                <SectionHeader title="About" />
                <p className="text-[var(--soft)] whitespace-pre-wrap leading-relaxed mb-6">
                  {organization.description}
                </p>
              </>
            )}

            {/* Categories */}
            {organization.categories && organization.categories.length > 0 && (
              <>
                <SectionHeader title="Categories" count={organization.categories.length} />
                <div className="flex flex-wrap gap-2 mb-6">
                  {organization.categories.map((cat) => {
                    const accentClass = categoryAccentClasses[cat];
                    return (
                      <span
                        key={cat}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-mono bg-accent-15 text-accent ${
                          accentClass?.className ?? ""
                        }`}
                      >
                        <CategoryIcon type={cat} size={16} glow="subtle" />
                        {cat.replace(/_/g, " ")}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </InfoCard>

          {volunteerOpportunities.length > 0 && (
            <section className="rounded-xl border border-[var(--twilight)]/85 bg-[var(--night)] px-4 py-4 sm:px-5 sm:py-5">
              <div className="mb-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-[var(--muted)] mb-1">
                  Ongoing Opportunities
                </p>
                <h2 className="text-lg font-semibold text-[var(--cream)]">
                  Commitment roles from {organization.name}
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  These are structured volunteer roles, not dated event listings.
                </p>
              </div>

              <div className="space-y-3">
                {volunteerOpportunities.map((opportunity) => {
                  const onboardingLabel = formatOnboardingLevel(opportunity.onboarding_level);
                  const timeHorizonLabel = formatTimeHorizon(opportunity.time_horizon);
                  const sourceName = opportunity.source?.name || organization.name;

                  return (
                    <div
                      key={opportunity.id}
                      className="rounded-lg border border-[var(--twilight)]/70 bg-[var(--night)]/95 px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full border border-accent-40 bg-accent-15 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.14em] text-accent">
                              {formatCommitmentLevel(opportunity.commitment_level)}
                            </span>
                            {timeHorizonLabel && (
                              <span className="inline-flex items-center rounded-full border border-[var(--twilight)]/70 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--muted)]">
                                {timeHorizonLabel}
                              </span>
                            )}
                            {opportunity.remote_allowed && (
                              <span className="inline-flex items-center rounded-full border border-[var(--twilight)]/70 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--muted)]">
                                Remote-friendly
                              </span>
                            )}
                          </div>

                          <div>
                            <h3 className="text-base font-semibold text-[var(--cream)]">
                              {opportunity.title}
                            </h3>
                            <p className="mt-1 text-sm text-[var(--soft)]">
                              {opportunity.summary || opportunity.description}
                            </p>
                          </div>
                        </div>

                        <a
                          href={opportunity.application_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg border border-accent-40 bg-accent-15 px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent-20"
                        >
                          Learn more
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5h5m0 0v5m0-5L10 14" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10v9h9" />
                          </svg>
                        </a>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                        {opportunity.schedule_summary && (
                          <span>{opportunity.schedule_summary}</span>
                        )}
                        {opportunity.location_summary && (
                          <span>{opportunity.location_summary}</span>
                        )}
                        {onboardingLabel && (
                          <span>{onboardingLabel}</span>
                        )}
                        {opportunity.background_check_required && (
                          <span>Background check</span>
                        )}
                        {opportunity.training_required && (
                          <span>Training</span>
                        )}
                      </div>

                      <div className="mt-3 text-xs text-[var(--muted)]">
                        Source: {sourceName}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Next Events */}
          <section id="upcoming-events" className="rounded-xl border border-[var(--twilight)]/85 bg-[var(--night)] px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-[var(--muted)] mb-1">
                  Next Events
                </p>
                <h2 className="text-lg font-semibold text-[var(--cream)]">
                  {events.length} upcoming event{events.length !== 1 ? "s" : ""}
                </h2>
              </div>
              {events.length > 8 && (
                <a
                  href="#all-events"
                  className="inline-flex items-center gap-1 text-sm text-accent hover:text-[var(--cream)] transition-colors"
                >
                  Open Full List
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </a>
              )}
            </div>

            {previewEvents.length > 0 ? (
              <>
                <div className="rounded-lg border border-[var(--twilight)]/80 bg-[var(--night)]/95">
                  <div className="divide-y divide-[var(--twilight)]/35">
                    {previewEvents.map((event) => {
                      const eventColor = event.category ? getCategoryColor(event.category) : "var(--coral)";
                      return (
                        <div key={event.id} className="px-3.5 py-3.5 sm:px-4 sm:py-4">
                          <RelatedCard
                            variant="compact"
                            href={`/${activePortalSlug}/events/${event.id}`}
                            title={event.title}
                            subtitle={formatEventTime(event)}
                            icon={<CategoryIcon type={event.category || "other"} size={20} />}
                            accentColor={eventColor}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-3 text-xs text-[var(--muted)]">
                  Showing {previewEvents.length} of {events.length} upcoming events.
                  {remainingPreviewCount > 0 ? ` +${remainingPreviewCount} more in full list.` : ""}
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--muted)]">No upcoming events scheduled.</p>
            )}
          </section>

          {/* Full Upcoming Events */}
          {events.length > 8 && (
            <section id="all-events" className="rounded-xl border border-[var(--twilight)]/85 bg-[var(--night)] px-4 py-4 sm:px-5 sm:py-5">
              <details className="group">
                <summary className="list-none cursor-pointer">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-[var(--muted)] mb-1">
                        Detailed View
                      </p>
                      <h2 className="text-lg font-semibold text-[var(--cream)]">
                        Full upcoming events list
                      </h2>
                    </div>
                    <svg className="w-4 h-4 text-[var(--muted)] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </summary>
                <div className="mt-4">
                  <RelatedSection
                    title="All Upcoming Events"
                    count={events.length}
                    emptyMessage="No upcoming events scheduled"
                  >
                    {events.map((event) => {
                      const eventColor = event.category ? getCategoryColor(event.category) : "var(--coral)";
                      return (
                        <RelatedCard
                          key={event.id}
                          variant="compact"
                          href={`/${activePortalSlug}/events/${event.id}`}
                          title={event.title}
                          subtitle={formatEventTime(event)}
                          icon={<CategoryIcon type={event.category || "other"} size={20} />}
                          accentColor={eventColor}
                        />
                      );
                    })}
                  </RelatedSection>
                </div>
              </details>
            </section>
          )}

          {/* Organization Details */}
          <InfoCard accentColor={orgColor} className="!bg-[var(--night)] !border-[var(--twilight)]/90">
            <SectionHeader title="Organization Details" className="border-t-0 pt-0 pb-2" />
            <p className="text-sm text-[var(--muted)] mb-4">
              Links, community input, and data quality controls for this organization.
            </p>

            {/* Social Links */}
            {(organization.website || organization.instagram || organization.facebook || organization.twitter || organization.email) && (
              <>
                <SectionHeader title="Connect" />
                <div className="flex flex-wrap gap-3 mb-6">
                  {organization.website && (
                    <a
                      href={organization.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] text-sm transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      {getDomainFromUrl(organization.website)}
                    </a>
                  )}
                  {organization.instagram && (
                    <a
                      href={`https://instagram.com/${organization.instagram.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] text-sm transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                      </svg>
                      @{organization.instagram.replace("@", "")}
                    </a>
                  )}
                  {organization.facebook && (
                    <a
                      href={organization.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] text-sm transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                      Facebook
                    </a>
                  )}
                  {organization.twitter && (
                    <a
                      href={`https://twitter.com/${organization.twitter.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] text-sm transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                      </svg>
                      @{organization.twitter.replace("@", "")}
                    </a>
                  )}
                  {organization.email && (
                    <a
                      href={`mailto:${organization.email}`}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] text-sm transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Email
                    </a>
                  )}
                </div>
              </>
            )}

            <SectionHeader title="Community Tags" />
            <div className="mb-6">
              <EntityTagList entityType="org" entityId={parseInt(organization.id, 10)} />
            </div>

          </InfoCard>

          {/* Similar Organizations */}
          {similarOrgs.length > 0 && (
            <RelatedSection title="Similar Organizations" count={similarOrgs.length}>
              {similarOrgs.map((org) => (
                <RelatedCard
                  key={org.id}
                  variant="image"
                  href={`/${activePortalSlug}/community/${org.slug}`}
                  title={org.name}
                  subtitle={formatOrgType(org.org_type)}
                  imageUrl={org.logo_url || undefined}
                  icon={
                    org.categories?.[0] ? (
                      <CategoryIcon type={org.categories[0]} size={20} />
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    )
                  }
                />
              ))}
            </RelatedSection>
          )}
        </main>
      </div>

      {/* Sticky bottom bar with CTAs */}
      <DetailStickyBar
        shareLabel="Share"
        className="md:hidden"
        containerClassName="max-w-5xl"
        secondaryActions={
          <>
            <FollowButton targetOrganizationId={organization.id} size="sm" />
            <RecommendButton organizationId={organization.id} size="sm" />
          </>
        }
        primaryAction={
          organization.website
            ? {
                label: "Website",
                href: organization.website,
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                ),
              }
            : undefined
        }
      />
    </>
  );
}
