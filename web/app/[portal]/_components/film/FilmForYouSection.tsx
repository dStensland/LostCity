"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, SignIn, Heart } from "@phosphor-icons/react";
import { getProxiedImageSrc } from "@/lib/image-proxy";

type RecommendationReason = {
  type: string;
  label: string;
  detail?: string;
};

type FeedEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  image_url: string | null;
  category: string | null;
  venue?: { name: string; slug: string; neighborhood: string | null } | null;
  reasons?: RecommendationReason[];
};

type FilmForYouSectionProps = {
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
  if (!time) return "Time TBA";
  const hour = Number(time.slice(0, 2));
  const minute = time.slice(3, 5);
  if (Number.isNaN(hour)) return time;
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  const period = hour >= 12 ? "PM" : "AM";
  return `${normalizedHour}:${minute} ${period}`;
}

export default function FilmForYouSection({ portalSlug }: FilmForYouSectionProps) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch(
          `/api/feed?categories=film&personalized=1&limit=12&portal=${portalSlug}`,
          { signal: controller.signal }
        );
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
        // The feed API returns sections; extract events from all sections
        const allEvents: FeedEvent[] = [];
        if (data.sections) {
          for (const section of data.sections) {
            if (section.events) {
              allEvents.push(...section.events);
            }
          }
        } else if (data.events) {
          allEvents.push(...data.events);
        }
        setEvents(allEvents.slice(0, 12));
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setIsAuthenticated(false);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [portalSlug]);

  if (loading) {
    return (
      <section className="space-y-4">
        <header>
          <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#95a8cb]">For You</p>
          <h2 className="mt-1 font-[var(--font-film-editorial)] text-3xl text-[#f7f8fd]">Your film picks</h2>
        </header>
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-56 w-44 shrink-0 rounded-2xl skeleton-shimmer" />
          ))}
        </div>
      </section>
    );
  }

  if (isAuthenticated === false || events.length === 0) {
    return (
      <section className="space-y-4">
        <header>
          <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#95a8cb]">For You</p>
          <h2 className="mt-1 font-[var(--font-film-editorial)] text-3xl text-[#f7f8fd]">Personalized film picks</h2>
        </header>
        <Link
          href="/auth/login"
          className="group flex items-center gap-4 rounded-2xl border border-[#2f3a56] bg-[#0c1322] p-5 hover:border-[#445a85]"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#3a4969] bg-[#121e36]">
            <SignIn size={20} className="text-[#b9c9e9]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#f5f8ff]">Sign in for personalized picks</p>
            <p className="mt-1 text-xs text-[#b9c8e5]">
              Get recommendations based on your favorite genres, venues, and what friends are watching.
            </p>
          </div>
          <ArrowRight size={16} className="ml-auto shrink-0 text-[#c9d9ff] group-hover:text-[#e1eaff]" />
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header>
        <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#95a8cb]">For You</p>
        <h2 className="mt-1 font-[var(--font-film-editorial)] text-3xl text-[#f7f8fd]">Your film picks</h2>
      </header>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/${portalSlug}/events/${event.id}`}
            className="group relative h-64 w-44 shrink-0 snap-start overflow-hidden rounded-2xl border border-[#2f3a56] bg-[#0c1322]"
          >
            {event.image_url ? (
              <Image
                src={getProxiedImageSrc(event.image_url)}
                alt={event.title}
                fill
                unoptimized
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                sizes="176px"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-indigo-300/85 to-violet-500/85" />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,16,0.05)_0%,rgba(4,8,16,0.48)_46%,rgba(4,8,16,0.92)_100%)]" />
            <div className="relative flex h-full flex-col justify-end p-3">
              {event.reasons && event.reasons.length > 0 && (
                <span className="mb-1 inline-flex w-fit items-center gap-1 rounded-full border border-[#8ea9ec66] bg-[#8ea9ec1f] px-2 py-0.5 text-[0.52rem] uppercase tracking-[0.12em] text-[#d9e5ff]">
                  <Heart size={9} weight="fill" />
                  {event.reasons[0].label}
                </span>
              )}
              <h3 className="line-clamp-2 text-sm font-semibold text-[#f6f8ff]">{event.title}</h3>
              <p className="mt-0.5 text-[0.62rem] text-[#c0d0ea]">
                {formatShortDate(event.start_date)} {event.start_time ? `• ${formatTimeLabel(event.start_time)}` : ""}
              </p>
              {event.venue?.name && (
                <p className="text-[0.58rem] text-[#9fb0cf]">{event.venue.name}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
