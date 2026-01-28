import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { getPortalBySlug } from "@/lib/portal";
import UnifiedHeader from "@/components/UnifiedHeader";
import PageFooter from "@/components/PageFooter";
import { PortalTheme } from "@/components/PortalTheme";
import FollowButton from "@/components/FollowButton";
import RecommendButton from "@/components/RecommendButton";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import FlagButton from "@/components/FlagButton";
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

type Producer = {
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

// Cache producer data
const getProducer = unstable_cache(
  async (slug: string): Promise<Producer | null> => {
    const { data, error } = await supabase
      .from("event_producers")
      .select("*")
      .eq("slug", slug)
      .eq("hidden", false)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as Producer;
  },
  ["producer-by-slug"],
  { revalidate: 600, tags: ["producer"] }
);

// Cache producer events
const getProducerEvents = unstable_cache(
  async (producerId: string): Promise<Event[]> => {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("events")
      .select(`
        *,
        venue:venues(id, name, slug, address, neighborhood, city, state)
      `)
      .eq("producer_id", producerId)
      .gte("start_date", today)
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(50);

    if (error || !data) {
      return [];
    }

    return data as Event[];
  },
  ["producer-events"],
  { revalidate: 300, tags: ["producer-events"] }
);

// Cache similar organizations
const getSimilarOrganizations = unstable_cache(
  async (producerId: string, orgType: string, categories: string[] | null): Promise<Producer[]> => {
    const query = supabase
      .from("event_producers")
      .select("*")
      .eq("hidden", false)
      .neq("id", producerId)
      .limit(6);

    // Try to match by org type first
    if (orgType) {
      query.eq("org_type", orgType);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      // Fallback: try matching by shared categories
      if (categories && categories.length > 0) {
        const { data: fallbackData } = await supabase
          .from("event_producers")
          .select("*")
          .eq("hidden", false)
          .neq("id", producerId)
          .contains("categories", categories)
          .limit(6);

        return (fallbackData || []) as Producer[];
      }
      return [];
    }

    return data as Producer[];
  },
  ["similar-orgs"],
  { revalidate: 600, tags: ["producer"] }
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
  const producer = await getProducer(slug);
  const portal = await getPortalBySlug(portalSlug);

  if (!producer) {
    return { title: "Organization Not Found | Lost City" };
  }

  const portalName = portal?.name || "Lost City";
  const description = producer.description || `Discover events and experiences from ${producer.name} in Atlanta.`;

  return {
    title: `${producer.name} | ${portalName}`,
    description,
    openGraph: {
      title: producer.name,
      description,
      type: "website",
      images: producer.logo_url ? [{ url: producer.logo_url }] : [],
    },
  };
}

// Generate Organization schema for SEO
function generateOrganizationSchema(producer: Producer) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: producer.name,
  };

  if (producer.description) {
    schema.description = producer.description;
  }

  if (producer.logo_url) {
    schema.logo = producer.logo_url;
    schema.image = producer.logo_url;
  }

  if (producer.website) {
    schema.url = producer.website;
  }

  if (producer.email) {
    schema.email = producer.email;
  }

  const sameAs: string[] = [];
  if (producer.instagram) {
    sameAs.push(`https://instagram.com/${producer.instagram.replace("@", "")}`);
  }
  if (producer.facebook) {
    sameAs.push(producer.facebook);
  }
  if (producer.twitter) {
    sameAs.push(`https://twitter.com/${producer.twitter.replace("@", "")}`);
  }
  if (sameAs.length > 0) {
    schema.sameAs = sameAs;
  }

  if (producer.city || producer.neighborhood) {
    schema.address = {
      "@type": "PostalAddress",
      addressLocality: producer.city || "Atlanta",
      addressRegion: "GA",
      addressCountry: "US",
    };
  }

  return schema;
}

export default async function PortalOrganizerPage({ params }: Props) {
  const { portal: portalSlug, slug } = await params;
  const producer = await getProducer(slug);
  const portal = await getPortalBySlug(portalSlug);

  if (!producer) {
    notFound();
  }

  // Use the URL portal or fall back
  const activePortalSlug = portal?.slug || portalSlug;
  const activePortalName = portal?.name || portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);

  // Fetch data in parallel
  const [events, similarOrgs] = await Promise.all([
    getProducerEvents(producer.id),
    getSimilarOrganizations(producer.id, producer.org_type, producer.categories),
  ]);

  const orgColor = getOrgTypeColor(producer.org_type);
  const organizationSchema = generateOrganizationSchema(producer);

  // Format location display
  const locationDisplay = [producer.neighborhood, producer.city]
    .filter(Boolean)
    .join(", ") || "Atlanta";

  return (
    <>
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />

      {/* Portal-specific theming */}
      {portal && <PortalTheme portal={portal} />}

      <div className="min-h-screen">
        <UnifiedHeader
          portalSlug={activePortalSlug}
          portalName={activePortalName}
          backLink={{ href: `/${activePortalSlug}?view=community`, label: "Community" }}
        />

        <main className="max-w-3xl mx-auto px-4 py-6 pb-28 space-y-8">
          {/* Hero Section */}
          <DetailHero
            mode="poster"
            imageUrl={producer.logo_url}
            title={producer.name}
            subtitle={locationDisplay}
            categoryColor={orgColor}
            categoryIcon={
              producer.categories?.[0] ? (
                <CategoryIcon type={producer.categories[0]} size={48} />
              ) : (
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              )
            }
            badge={
              <span
                className="inline-flex items-center px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider"
                style={{
                  backgroundColor: `${orgColor}20`,
                  color: orgColor,
                  border: `1px solid ${orgColor}40`,
                }}
              >
                {formatOrgType(producer.org_type)}
              </span>
            }
          >
            {/* Follow/Recommend buttons in hero */}
            <div className="flex items-center gap-2 mt-4">
              <FollowButton targetProducerId={producer.id} size="sm" />
              <RecommendButton producerId={producer.id} size="sm" />
            </div>
          </DetailHero>

          {/* Main Content Card */}
          <InfoCard accentColor={orgColor}>
            {/* Metadata Grid */}
            <MetadataGrid
              items={[
                { label: "Type", value: formatOrgType(producer.org_type) },
                { label: "Location", value: locationDisplay },
                { label: "Events", value: `${events.length} upcoming` },
              ]}
              className="mb-8"
            />

            {/* Description */}
            {producer.description && (
              <>
                <SectionHeader title="About" />
                <p className="text-[var(--soft)] whitespace-pre-wrap leading-relaxed mb-6">
                  {producer.description}
                </p>
              </>
            )}

            {/* Social Links */}
            {(producer.website || producer.instagram || producer.facebook || producer.twitter || producer.email) && (
              <>
                <SectionHeader title="Connect" />
                <div className="flex flex-wrap gap-3 mb-6">
                  {producer.website && (
                    <a
                      href={producer.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] text-sm transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      {getDomainFromUrl(producer.website)}
                    </a>
                  )}
                  {producer.instagram && (
                    <a
                      href={`https://instagram.com/${producer.instagram.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] text-sm transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                      </svg>
                      @{producer.instagram.replace("@", "")}
                    </a>
                  )}
                  {producer.facebook && (
                    <a
                      href={producer.facebook}
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
                  {producer.twitter && (
                    <a
                      href={`https://twitter.com/${producer.twitter.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] text-sm transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                      </svg>
                      @{producer.twitter.replace("@", "")}
                    </a>
                  )}
                  {producer.email && (
                    <a
                      href={`mailto:${producer.email}`}
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

            {/* Categories */}
            {producer.categories && producer.categories.length > 0 && (
              <>
                <SectionHeader title="Categories" count={producer.categories.length} />
                <div className="flex flex-wrap gap-2 mb-6">
                  {producer.categories.map((cat) => {
                    const color = getCategoryColor(cat);
                    return (
                      <span
                        key={cat}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-mono"
                        style={{
                          backgroundColor: `${color}15`,
                          color: color,
                        }}
                      >
                        <CategoryIcon type={cat} size={16} glow="subtle" />
                        {cat.replace(/_/g, " ")}
                      </span>
                    );
                  })}
                </div>
              </>
            )}

            {/* Community Tags */}
            <SectionHeader title="Community Tags" />
            <div className="mb-6">
              <EntityTagList entityType="org" entityId={parseInt(producer.id, 10)} />
            </div>

            {/* Flag for QA */}
            <SectionHeader title="Report an Issue" />
            <FlagButton
              entityType="producer"
              entityId={parseInt(producer.id, 10)}
              entityName={producer.name}
            />
          </InfoCard>

          {/* Upcoming Events */}
          <RelatedSection
            title="Upcoming Events"
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

        <PageFooter />
      </div>

      {/* Sticky bottom bar with CTAs */}
      <DetailStickyBar
        shareLabel="Share"
        secondaryActions={
          <>
            <FollowButton targetProducerId={producer.id} size="sm" />
            <RecommendButton producerId={producer.id} size="sm" />
          </>
        }
        primaryAction={
          producer.website
            ? {
                label: "Website",
                href: producer.website,
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
