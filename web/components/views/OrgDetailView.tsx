"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import { formatTimeSplit } from "@/lib/formats";
import FollowButton from "@/components/FollowButton";
import RecommendButton from "@/components/RecommendButton";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";

type ProducerData = {
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
};

type EventData = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  is_free: boolean;
  price_min: number | null;
  category: string | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
  } | null;
};

interface OrgDetailViewProps {
  slug: string;
  portalSlug: string;
  onClose: () => void;
}

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

function getDomainFromUrl(url: string): string {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    return domain;
  } catch {
    return url;
  }
}

export default function OrgDetailView({ slug, portalSlug, onClose }: OrgDetailViewProps) {
  const router = useRouter();
  const [producer, setProducer] = useState<ProducerData | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    async function fetchProducer() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/producers/${slug}`);
        if (!res.ok) {
          throw new Error("Organizer not found");
        }
        const data = await res.json();
        setProducer(data.producer);
        setEvents(data.events || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load organizer");
      } finally {
        setLoading(false);
      }
    }

    fetchProducer();
  }, [slug]);

  const handleEventClick = (id: number) => {
    router.push(`/${portalSlug}?event=${id}`, { scroll: false });
  };

  if (loading) {
    return (
      <div className="animate-fadeIn">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-[var(--muted)] hover:text-[var(--cream)] transition-colors mb-4 font-mono text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="w-20 h-20 skeleton-shimmer rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="h-6 skeleton-shimmer rounded w-1/2" />
              <div className="h-4 skeleton-shimmer rounded w-1/3" />
            </div>
          </div>
          <div className="h-32 skeleton-shimmer rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !producer) {
    return (
      <div className="animate-fadeIn">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-[var(--muted)] hover:text-[var(--cream)] transition-colors mb-4 font-mono text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="text-center py-12">
          <p className="text-[var(--muted)]">{error || "Organizer not found"}</p>
        </div>
      </div>
    );
  }

  const orgConfig = ORG_TYPE_CONFIG[producer.org_type];
  const showLogo = producer.logo_url && !imageError;

  return (
    <div className="animate-fadeIn pb-8">
      {/* Back button */}
      <button
        onClick={onClose}
        className="flex items-center gap-2 text-[var(--muted)] hover:text-[var(--cream)] transition-colors mb-4 font-mono text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Main info card */}
      <div className="border border-[var(--twilight)] rounded-xl p-6 bg-[var(--dusk)]">
        <div className="flex items-start gap-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            {showLogo ? (
              <div className="w-20 h-20 rounded-xl bg-white flex items-center justify-center overflow-hidden relative">
                {!imageLoaded && (
                  <div className="absolute inset-0 skeleton-shimmer" />
                )}
                <Image
                  src={producer.logo_url!}
                  alt={producer.name}
                  width={80}
                  height={80}
                  className={`object-contain transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                  unoptimized
                />
              </div>
            ) : (
              <div
                className="w-20 h-20 rounded-xl flex items-center justify-center"
                style={{
                  backgroundColor: producer.categories?.[0]
                    ? `${getCategoryColor(producer.categories[0])}20`
                    : "var(--twilight)",
                }}
              >
                <CategoryIcon
                  type={producer.categories?.[0] || "community"}
                  size={40}
                  glow="subtle"
                />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-[var(--cream)]">
                  {producer.name}
                </h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium uppercase tracking-wider"
                    style={{
                      backgroundColor: orgConfig?.color ? `${orgConfig.color}20` : "var(--twilight)",
                      color: orgConfig?.color || "var(--muted)",
                    }}
                  >
                    {orgConfig?.label || producer.org_type.replace(/_/g, " ")}
                  </span>
                  {producer.neighborhood && (
                    <span className="text-sm text-[var(--muted)]">
                      {producer.neighborhood}
                      {producer.city && producer.city !== "Atlanta" ? `, ${producer.city}` : ""}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <FollowButton targetProducerId={producer.id} size="sm" />
                <RecommendButton producerId={producer.id} size="sm" />
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {producer.description && (
          <div className="mt-5 pt-5 border-t border-[var(--twilight)]">
            <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-2">
              About
            </h2>
            <p className="text-[var(--soft)] text-sm leading-relaxed">
              {producer.description}
            </p>
          </div>
        )}

        {/* Category tags */}
        {producer.categories && producer.categories.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {producer.categories.map((cat) => {
              const color = getCategoryColor(cat);
              return (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono uppercase tracking-wider"
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] transition-colors text-sm"
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              Instagram
            </a>
          )}
          {producer.email && (
            <a
              href={`mailto:${producer.email}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email
            </a>
          )}
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="mt-8">
        <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-4">
          Upcoming Events ({events.length})
        </h2>

        {events.length > 0 ? (
          <div className="space-y-2">
            {events.map((event) => {
              const dateObj = parseISO(event.start_date);
              const { time, period } = formatTimeSplit(event.start_time);

              return (
                <button
                  key={event.id}
                  onClick={() => handleEventClick(event.id)}
                  className="block w-full text-left p-4 border border-[var(--twilight)] rounded-xl bg-[var(--dusk)] hover:border-[var(--coral)]/50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[var(--cream)] font-medium truncate group-hover:text-[var(--coral)] transition-colors">
                        {event.title}
                      </h3>
                      <p className="text-sm text-[var(--muted)] mt-1">
                        {format(dateObj, "EEE, MMM d")}
                        {event.start_time && ` · ${time} ${period}`}
                      </p>
                      {event.venue && (
                        <p className="text-sm text-[var(--muted)] mt-0.5">
                          {event.venue.name}
                          {event.venue.neighborhood && ` · ${event.venue.neighborhood}`}
                        </p>
                      )}
                    </div>
                    <span className="text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center border border-[var(--twilight)] rounded-xl bg-[var(--dusk)]">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-[var(--muted)] text-sm">No upcoming events</p>
            <p className="text-[var(--muted)] text-xs mt-1">
              Follow {producer.name} to get notified about new events
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
