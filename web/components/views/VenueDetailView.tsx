"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import { formatTimeSplit } from "@/lib/formats";
import { SPOT_TYPES, formatPriceLevel, getSpotTypeLabels, type SpotType } from "@/lib/spots";
import FollowButton from "@/components/FollowButton";
import RecommendButton from "@/components/RecommendButton";
import VenueTagList from "@/components/VenueTagList";
import FlagButton from "@/components/FlagButton";
import LinkifyText from "@/components/LinkifyText";

type SpotData = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  city: string;
  state: string;
  neighborhood: string | null;
  description: string | null;
  short_description: string | null;
  image_url: string | null;
  website: string | null;
  instagram: string | null;
  phone: string | null;
  hours_display: string | null;
  price_level: number | null;
  spot_type: string | null;
  spot_types: string[] | null;
  vibes: string[] | null;
};

type UpcomingEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_free: boolean;
  price_min: number | null;
  category: string | null;
};

interface VenueDetailViewProps {
  slug: string;
  portalSlug: string;
  onClose: () => void;
}

export default function VenueDetailView({ slug, portalSlug, onClose }: VenueDetailViewProps) {
  const router = useRouter();
  const [spot, setSpot] = useState<SpotData | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    async function fetchSpot() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/spots/${slug}`);
        if (!res.ok) {
          throw new Error("Spot not found");
        }
        const data = await res.json();
        setSpot(data.spot);
        setUpcomingEvents(data.upcomingEvents || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load spot");
      } finally {
        setLoading(false);
      }
    }

    fetchSpot();
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
          <div className="aspect-video skeleton-shimmer rounded-xl" />
          <div className="h-48 skeleton-shimmer rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !spot) {
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
          <p className="text-[var(--muted)]">{error || "Spot not found"}</p>
        </div>
      </div>
    );
  }

  const primaryType = spot.spot_type as SpotType | null;
  const typeInfo = primaryType ? SPOT_TYPES[primaryType] : null;
  const priceDisplay = formatPriceLevel(spot.price_level);
  const showImage = spot.image_url && !imageError;

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

      {/* Spot image */}
      {showImage && (
        <div className="aspect-video bg-[var(--night)] rounded-lg overflow-hidden mb-6 border border-[var(--twilight)] relative">
          {!imageLoaded && (
            <div className="absolute inset-0 skeleton-shimmer" />
          )}
          <Image
            src={spot.image_url!}
            alt={spot.name}
            fill
            className={`object-cover transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        </div>
      )}

      {/* Main spot info card */}
      <div className="border border-[var(--twilight)] rounded-xl p-6 bg-[var(--dusk)]">
        {/* Type badge */}
        {typeInfo && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[var(--night)] border border-[var(--twilight)] rounded text-sm mb-4">
            <span>{typeInfo.icon}</span>
            <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
              {spot.spot_types && spot.spot_types.length > 1
                ? getSpotTypeLabels(spot.spot_types)
                : typeInfo.label}
            </span>
          </span>
        )}

        {/* Name + Follow/Recommend */}
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-[var(--cream)] leading-tight">
            {spot.name}
          </h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <FollowButton targetVenueId={spot.id} size="sm" />
            <RecommendButton venueId={spot.id} size="sm" />
          </div>
        </div>

        {/* Neighborhood + Price */}
        <p className="mt-2 text-[var(--soft)] text-lg">
          {spot.neighborhood || spot.city}
          {priceDisplay && (
            <span className="text-[var(--muted)]"> · {priceDisplay}</span>
          )}
        </p>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 mt-4">
          {spot.website && (
            <a
              href={spot.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] rounded-lg text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              Website
            </a>
          )}
          {spot.instagram && (
            <a
              href={`https://instagram.com/${spot.instagram.replace("@", "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] rounded-lg text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              Instagram
            </a>
          )}
          {spot.address && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                `${spot.address}, ${spot.city}, ${spot.state}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] rounded-lg text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Directions
            </a>
          )}
        </div>

        {/* Hours */}
        {spot.hours_display && (
          <p className="mt-4 font-mono text-sm text-[var(--muted)]">
            {spot.hours_display}
          </p>
        )}

        {/* Description */}
        {spot.description && (
          <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
            <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
              About
            </h2>
            <p className="text-[var(--soft)] whitespace-pre-wrap leading-relaxed">
              <LinkifyText text={spot.description} />
            </p>
          </div>
        )}

        {/* Vibes */}
        {spot.vibes && spot.vibes.length > 0 && (
          <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
            <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
              Vibes
            </h2>
            <div className="flex flex-wrap gap-2">
              {spot.vibes.map((vibe) => (
                <span
                  key={vibe}
                  className="px-3 py-1.5 bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] rounded-full border border-[var(--neon-cyan)]/20 text-sm font-mono"
                >
                  {vibe.replace(/-/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Community Tags */}
        <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
          <VenueTagList venueId={spot.id} />
        </div>

        {/* Location */}
        {spot.address && (
          <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
            <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
              Location
            </h2>
            <p className="text-[var(--soft)]">
              {spot.address}
              <br />
              {spot.city}, {spot.state}
            </p>
          </div>
        )}

        {/* Flag */}
        <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
          <FlagButton
            entityType="venue"
            entityId={spot.id}
            entityName={spot.name}
          />
        </div>
      </div>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div className="mt-8">
          <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-4">
            Upcoming Events
          </h2>
          <div className="space-y-2">
            {upcomingEvents.map((event) => {
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
        </div>
      )}
    </div>
  );
}
