import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import GlassHeader from "@/components/GlassHeader";
import MainNav from "@/components/MainNav";
import PageFooter from "@/components/PageFooter";
import FollowButton from "@/components/FollowButton";
import EventCard from "@/components/EventCard";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import type { Event } from "@/lib/supabase";

export const revalidate = 300;

// Org type configuration
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
      .single();

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

// Helper to extract domain from URL
function getDomainFromUrl(url: string): string {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    return domain;
  } catch {
    return url;
  }
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const producer = await getProducer(slug);

  if (!producer) {
    return { title: "Organizer Not Found" };
  }

  return {
    title: `${producer.name} | Lost City`,
    description: producer.description || `Events by ${producer.name} in Atlanta`,
  };
}

export default async function OrganizerPage({ params }: Props) {
  const { slug } = await params;
  const producer = await getProducer(slug);

  if (!producer) {
    notFound();
  }

  const events = await getProducerEvents(producer.id);
  const orgConfig = ORG_TYPE_CONFIG[producer.org_type];

  return (
    <div className="min-h-screen">
      <GlassHeader />

      <Suspense fallback={<div className="h-10 bg-[var(--night)]" />}>
        <MainNav />
      </Suspense>

      {/* Hero Section */}
      <section className="py-8 border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-start gap-5">
            {/* Logo */}
            <div className="flex-shrink-0">
              {producer.logo_url ? (
                <div className="w-24 h-24 rounded-xl bg-white flex items-center justify-center overflow-hidden">
                  <Image
                    src={producer.logo_url}
                    alt={producer.name}
                    width={96}
                    height={96}
                    className="object-contain"
                    style={{ width: 96, height: 96 }}
                    unoptimized
                  />
                </div>
              ) : (
                <div
                  className="w-24 h-24 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: producer.categories?.[0]
                      ? `${getCategoryColor(producer.categories[0])}20`
                      : "var(--twilight)",
                  }}
                >
                  <CategoryIcon
                    type={producer.categories?.[0] || "community"}
                    size={48}
                    glow="subtle"
                  />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-[var(--cream)]">
                    {producer.name}
                  </h1>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-medium uppercase tracking-wider"
                      style={{
                        backgroundColor: orgConfig?.color ? `${orgConfig.color}20` : "var(--twilight)",
                        color: orgConfig?.color || "var(--muted)",
                      }}
                    >
                      {orgConfig?.label || producer.org_type.replace(/_/g, " ")}
                    </span>
                    {producer.neighborhood && (
                      <span className="text-sm text-[var(--muted)]">
                        {producer.neighborhood}{producer.city && producer.city !== "Atlanta" ? `, ${producer.city}` : ""}
                      </span>
                    )}
                  </div>
                </div>
                <FollowButton targetProducerId={producer.id} size="md" />
              </div>
            </div>
          </div>

          {/* Description */}
          {producer.description && (
            <p className="mt-5 text-[var(--soft)] leading-relaxed">
              {producer.description}
            </p>
          )}

          {/* Category tags */}
          {producer.categories && producer.categories.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {producer.categories.map((cat) => {
                const color = getCategoryColor(cat);
                return (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono uppercase tracking-wider"
                    style={{
                      backgroundColor: `${color}15`,
                      color: color,
                    }}
                  >
                    <CategoryIcon type={cat} size={12} />
                    {cat.replace(/_/g, " ")}
                  </span>
                );
              })}
            </div>
          )}

          {/* Links */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {producer.website && (
              <a
                href={producer.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--coral)]/90 transition-colors text-sm font-mono font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                {getDomainFromUrl(producer.website)}
              </a>
            )}
            {producer.instagram && (
              <a
                href={`https://instagram.com/${producer.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/80 transition-colors text-sm font-mono"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                @{producer.instagram}
              </a>
            )}
            {producer.facebook && (
              <a
                href={producer.facebook.startsWith("http") ? producer.facebook : `https://facebook.com/${producer.facebook}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/80 transition-colors text-sm font-mono"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </a>
            )}
            {producer.twitter && (
              <a
                href={`https://twitter.com/${producer.twitter}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/80 transition-colors text-sm font-mono"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                @{producer.twitter}
              </a>
            )}
            {producer.email && (
              <a
                href={`mailto:${producer.email}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/80 transition-colors text-sm font-mono"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Events Section */}
      <section className="py-6">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-mono text-sm font-medium text-[var(--cream)] uppercase tracking-wider">
              Upcoming Events
            </h2>
            <span className="font-mono text-xs text-[var(--muted)]">
              {events.length} event{events.length !== 1 ? "s" : ""}
            </span>
          </div>

          {events.length > 0 ? (
            <div>
              {events.map((event, index) => (
                <EventCard key={event.id} event={event} index={index} />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-[var(--muted)]">No upcoming events</p>
              <p className="text-sm text-[var(--muted)] mt-1">
                Follow {producer.name} to get notified when they announce new events
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Back link */}
      <div className="max-w-3xl mx-auto px-4 pb-8">
        <Link
          href="/community"
          className="inline-flex items-center gap-2 font-mono text-sm text-[var(--muted)] hover:text-[var(--coral)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Community
        </Link>
      </div>

      <PageFooter />
    </div>
  );
}
