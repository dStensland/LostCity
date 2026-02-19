"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bookmark, ArrowRight } from "@phosphor-icons/react";
import { getProxiedImageSrc } from "@/lib/image-proxy";

type SavedFilmEvent = {
  id: number;
  event_id: number | null;
  event: {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    image_url: string | null;
    series: {
      id: string;
      slug: string;
      title: string;
      image_url: string | null;
      genres: string[] | null;
    } | null;
    venue: {
      name: string;
      slug: string;
      neighborhood: string | null;
    } | null;
  } | null;
};

type FilmWatchlistProps = {
  portalSlug: string;
};

function formatShortDate(isoDate: string): string {
  const utcMidday = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(utcMidday);
}

function formatTimeLabel(time: string | null): string {
  if (!time) return "";
  const hour = Number(time.slice(0, 2));
  const minute = time.slice(3, 5);
  if (Number.isNaN(hour)) return time;
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  const period = hour >= 12 ? "PM" : "AM";
  return `${normalizedHour}:${minute} ${period}`;
}

export default function FilmWatchlist({ portalSlug }: FilmWatchlistProps) {
  const [items, setItems] = useState<SavedFilmEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch("/api/saved/list?category=film", {
          signal: controller.signal,
        });
        if (!res.ok) {
          if (res.status === 401) {
            setIsAuthenticated(false);
            setLoading(false);
            return;
          }
          throw new Error("Failed to load");
        }
        const data = await res.json();
        setIsAuthenticated(true);
        setItems((data.items || []).filter((item: SavedFilmEvent) => item.event));
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setIsAuthenticated(false);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, []);

  // Don't render anything if not authenticated
  if (loading) return null;
  if (isAuthenticated === false) return null;
  if (items.length === 0) {
    return (
      <section className="space-y-4">
        <header>
          <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#95a8cb]">My Watchlist</p>
          <h2 className="mt-1 font-[var(--font-film-editorial)] text-3xl text-[#f7f8fd]">Saved films</h2>
        </header>
        <div className="flex items-center gap-4 rounded-2xl border border-[#2f3a56] bg-[#0c1322] p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#3a4969] bg-[#121e36]">
            <Bookmark size={20} className="text-[#b9c9e9]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#f5f8ff]">No saved films yet</p>
            <p className="mt-1 text-xs text-[#b9c8e5]">
              Save films from the showtimes board to build your watchlist.
            </p>
          </div>
          <Link
            href={`/${portalSlug}/showtimes`}
            className="ml-auto inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-[#c9d9ff] hover:text-[#e1eaff]"
          >
            Browse
            <ArrowRight size={12} />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header>
        <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#95a8cb]">My Watchlist</p>
        <h2 className="mt-1 font-[var(--font-film-editorial)] text-3xl text-[#f7f8fd]">Saved films</h2>
      </header>
      <div className="space-y-3">
        {items.slice(0, 6).map((item) => {
          const event = item.event!;
          const imageUrl = event.series?.image_url || event.image_url;
          return (
            <Link
              key={item.id}
              href={
                event.series?.slug
                  ? `/${portalSlug}/series/${event.series.slug}`
                  : `/${portalSlug}/events/${event.id}`
              }
              className="group flex gap-3 rounded-xl border border-[#30405f] bg-[#10182b] p-3 hover:border-[#445a85]"
            >
              <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-[3px] border border-[#3b4768] bg-[#0c1220]">
                {imageUrl ? (
                  <Image
                    src={getProxiedImageSrc(imageUrl)}
                    alt={event.series?.title || event.title}
                    fill
                    sizes="44px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-slate-300/85 to-slate-500/85" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="line-clamp-1 text-sm font-semibold text-[#f5f7fc]">
                  {event.series?.title || event.title}
                </h3>
                <p className="mt-1 text-[0.68rem] text-[#9fb0cf]">
                  {event.venue?.name && `Showing at ${event.venue.name}`}
                  {event.start_time && ` ${formatShortDate(event.start_date)} ${formatTimeLabel(event.start_time)}`}
                  {!event.start_time && ` ${formatShortDate(event.start_date)}`}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
