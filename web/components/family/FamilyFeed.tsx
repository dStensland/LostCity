"use client";

import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { EventWithLocation } from "@/lib/search";
import {
  MuseumScene,
  OutdoorScene,
  TheaterScene,
  SportsScene,
  FestivalScene,
  CampScene,
  type IllustrationProps,
} from "./CategoryIllustrations";
import {
  // Doodle-style icons (sketchy, hand-drawn)
  DoodleSearch,
  DoodleBolt,
  DoodleParty,
  DoodleTag,
  DoodlePin,
  DoodleRocket,
  DoodleTicket,
  DoodleStar,
  // Splat & melty decorative elements
  SplatBlob,
  MeltyDrip,
  GooeyS,
  Squiggle,
  ConfettiBurst,
  ScribbleCloud,
  WobblyCircle,
} from "./illustrations";

/*
 * ATLittle Family Feed
 * Design Language: "The Family Adventure Guide"
 *
 * Visual DNA:
 * - Bold, confident colors (not tints)
 * - Illustration-forward with Where's Waldo-style scenes
 * - Playful typography with real hierarchy
 * - Cards that feel like collectible adventure tickets
 * - Hover states that bring illustrations to life
 */

// Bold, confident palette - no wimpy tints
const C = {
  // Primary
  orange: "#FF5722",
  green: "#4CAF50",
  purple: "#9C27B0",
  blue: "#2196F3",
  pink: "#E91E63",
  yellow: "#FFC107",
  teal: "#009688",

  // Neutrals
  cream: "#FFF8E7",
  paper: "#FFFDF5",
  ink: "#1A1A1A",
  pencil: "#5D4E37",
  faded: "#9E9E9E",
};

interface FamilyFeedProps {
  portalId: string;
  portalSlug: string;
  portalExclusive: boolean; // Kept for interface compatibility but not used - FamilyFeed shows public events
}

// Map adventure IDs to their illustration components
const ILLUSTRATIONS: Record<string, ComponentType<IllustrationProps>> = {
  museums: MuseumScene,
  outdoor: OutdoorScene,
  theater: TheaterScene,
  sports: SportsScene,
  festivals: FestivalScene,
  camps: CampScene,
};

// Illustrated category data with Where's Waldo-style scenes
const ADVENTURES = [
  { id: "museums", label: "Museums", color: C.orange, size: "large" },
  { id: "outdoor", label: "Outdoors", color: C.green, size: "small" },
  { id: "theater", label: "Shows", color: C.purple, size: "small" },
  { id: "sports", label: "Sports", color: C.blue, size: "medium" },
  { id: "festivals", label: "Festivals", color: C.pink, size: "medium" },
  { id: "camps", label: "Camps", color: C.teal, size: "small" },
] as const;

const FILTERS: Record<string, string> = {
  museums: "subcategories=learning.museum",
  outdoor: "categories=outdoors",
  theater: "categories=theater",
  sports: "categories=sports",
  festivals: "tags=festival",
  camps: "tags=camp",
};

function getTimeGreeting(): { greeting: string; subtext: string } {
  const hour = new Date().getHours();
  const day = new Date().getDay();

  if (day === 0 || day === 6) {
    return { greeting: "Weekend Mode!", subtext: "Time for adventures" };
  }
  if (hour < 12) {
    return { greeting: "Good Morning!", subtext: "What's the plan today?" };
  }
  if (hour < 17) {
    return { greeting: "Hey There!", subtext: "Looking for something fun?" };
  }
  return { greeting: "Good Evening!", subtext: "Any plans tonight?" };
}

async function fetchEvents(
  filters: string,
  limit = 8,
  portalId?: string,
  portalExclusive?: boolean
): Promise<EventWithLocation[]> {
  const params = new URLSearchParams(filters);
  params.set("limit", limit.toString());
  params.set("useCursor", "true");
  const existingTags = params.get("tags");
  params.set("tags", existingTags ? `family-friendly,${existingTags}` : "family-friendly");

  // Add portal context for proper filtering
  if (portalId) {
    params.set("portal_id", portalId);
  }
  if (portalExclusive) {
    params.set("portal_exclusive", "true");
  }

  const res = await fetch(`/api/events?${params.toString()}`);
  if (!res.ok) return [];
  return (await res.json()).events || [];
}

// Adventure Ticket Card - the core UI element
function AdventureTicket({
  event,
  portalSlug,
  accent = C.orange,
  variant = "default"
}: {
  event: EventWithLocation;
  portalSlug: string;
  accent?: string;
  variant?: "default" | "featured";
}) {
  const isToday = new Date(event.start_date).toDateString() === new Date().toDateString();
  const isFree = event.is_free;
  const isFeatured = variant === "featured";

  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      className={`group block bg-white rounded-2xl overflow-hidden transition-all duration-300
        hover:-translate-y-2 hover:rotate-1 hover:shadow-xl atlittle-btn ${
        isFeatured ? "col-span-2 row-span-2" : ""
      }`}
      style={{
        border: `3px solid ${C.ink}`,
        boxShadow: `4px 4px 0 ${C.ink}`,
      }}
    >
      {/* Ticket stub top */}
      <div
        className="relative overflow-hidden"
        style={{
          height: isFeatured ? "200px" : "140px",
          backgroundColor: event.image_url ? undefined : accent,
        }}
      >
        {event.image_url ? (
          <img
            src={event.image_url}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          // Illustrated placeholder - doodle ticket
          <div className="w-full h-full flex items-center justify-center">
            <DoodleTicket size={72} color={accent} className="opacity-50" />
          </div>
        )}

        {/* Badges - bold, visible, and PULSING */}
        <div className="absolute top-3 left-3 flex gap-2">
          {isToday && (
            <span
              className="px-3 py-1 rounded-full text-xs font-black text-white uppercase tracking-wide atlittle-badge-pulse"
              style={{
                backgroundColor: C.pink,
                border: `2px solid ${C.ink}`,
                color: C.pink,
              }}
            >
              <span className="text-white">Today!</span>
            </span>
          )}
          {isFree && (
            <span
              className="px-3 py-1 rounded-full text-xs font-black text-white uppercase tracking-wide atlittle-badge-pulse atlittle-stagger-2"
              style={{
                backgroundColor: C.green,
                border: `2px solid ${C.ink}`,
                color: C.green,
              }}
            >
              <span className="text-white">Free</span>
            </span>
          )}
        </div>

        {/* Torn ticket edge */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="w-full h-2">
            <path
              d="M0 8 L0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4 Q45 0 50 4 Q55 8 60 4 Q65 0 70 4 Q75 8 80 4 Q85 0 90 4 Q95 8 100 4 L100 8 Z"
              fill="white"
            />
          </svg>
        </div>
      </div>

      {/* Ticket info */}
      <div className="p-4">
        <h3
          className={`font-black leading-tight text-gray-900 group-hover:text-gray-600 transition-colors line-clamp-2 ${
            isFeatured ? "text-xl" : "text-base"
          }`}
          style={{ fontFamily: "var(--font-baloo), var(--font-nunito), system-ui" }}
        >
          {event.title}
        </h3>

        <div className="mt-2 flex items-center gap-2 text-sm" style={{ color: C.pencil }}>
          <span className="font-bold">
            {new Date(event.start_date).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
          {event.start_time && (
            <>
              <span>•</span>
              <span>{event.start_time}</span>
            </>
          )}
        </div>

        {event.venue?.name && (
          <p
            className="mt-1 text-sm font-bold truncate flex items-center gap-1"
            style={{ color: accent }}
          >
            <DoodlePin size={16} color={accent} /> {event.venue.name}
          </p>
        )}
      </div>
    </Link>
  );
}

// Section with personality
function AdventureSection({
  title,
  icon,
  color,
  events,
  viewMoreHref,
  portalSlug,
  isLoading,
}: {
  title: string;
  icon: ReactNode;
  color: string;
  events: EventWithLocation[];
  viewMoreHref: string;
  portalSlug: string;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <section className="mb-10 px-4">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl skeleton-shimmer-light" />
          <div className="h-8 w-40 rounded-lg skeleton-shimmer-light" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 rounded-2xl skeleton-shimmer-light" />
          ))}
        </div>
      </section>
    );
  }

  if (events.length === 0) return null;

  return (
    <section className="mb-10 px-4">
      {/* Section header - BIG and bold */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: color, border: `3px solid ${C.ink}` }}
          >
            {icon}
          </div>
          <h2
            className="text-2xl font-black"
            style={{
              color: C.ink,
              fontFamily: "var(--font-baloo), var(--font-nunito), system-ui",
            }}
          >
            {title}
          </h2>
        </div>

        <Link
          href={viewMoreHref}
          className="flex items-center gap-1 px-4 py-2 rounded-full font-bold text-sm transition-all hover:scale-105"
          style={{
            backgroundColor: color,
            color: "white",
            border: `2px solid ${C.ink}`,
          }}
        >
          See All →
        </Link>
      </div>

      {/* Masonry-ish grid */}
      <div className="grid grid-cols-2 gap-4">
        {events.slice(0, 4).map((event, i) => (
          <AdventureTicket
            key={event.id}
            event={event}
            portalSlug={portalSlug}
            accent={color}
            variant={i === 0 ? "featured" : "default"}
          />
        ))}
      </div>
    </section>
  );
}

export function FamilyFeed({ portalId, portalSlug }: FamilyFeedProps) {
  const { greeting, subtext } = useMemo(() => getTimeGreeting(), []);
  const [hoveredAdventure, setHoveredAdventure] = useState<string | null>(null);

  // Note: FamilyFeed shows public events filtered by family-friendly tags,
  // not portal-exclusive events. We pass portalId for federation but NOT
  // portalExclusive since we want to show public family content.
  const { data: weekendEvents, isLoading: loadingWeekend } = useQuery({
    queryKey: ["family-weekend", portalId],
    queryFn: () => fetchEvents("date=weekend", 8, portalId, false),
    staleTime: 60 * 1000,
  });

  const { data: freeEvents, isLoading: loadingFree } = useQuery({
    queryKey: ["family-free", portalId],
    queryFn: () => fetchEvents("free=1", 8, portalId, false),
    staleTime: 60 * 1000,
  });

  const { data: todayEvents, isLoading: loadingToday } = useQuery({
    queryKey: ["family-today", portalId],
    queryFn: () => fetchEvents("date=today", 8, portalId, false),
    staleTime: 60 * 1000,
  });

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: C.cream }}>

      {/* HERO - The Welcome Mat - Animated & Vibrant */}
      <div
        className="relative px-5 pt-8 pb-12 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${C.orange} 0%, #FF7043 50%, ${C.orange} 100%)`,
          backgroundSize: "200% 200%",
          animation: "gradient-flow 8s ease-in-out infinite",
        }}
      >
        {/* Decorative splat/melty elements - BIGGER & ANIMATED */}
        <div
          className="absolute -top-2 right-6 opacity-60 pointer-events-none atlittle-float"
          style={{ ["--rotate" as string]: "12deg" }}
        >
          <MeltyDrip className="w-20 h-32" color="#FFC107" />
        </div>
        <div
          className="absolute bottom-2 right-2 opacity-70 pointer-events-none atlittle-wobble"
          style={{ ["--rotate" as string]: "-6deg" }}
        >
          <SplatBlob className="w-28 h-28" color="#E91E63" />
        </div>
        <div
          className="absolute top-1/4 left-0 opacity-50 pointer-events-none atlittle-float atlittle-stagger-2"
          style={{ ["--rotate" as string]: "6deg" }}
        >
          <GooeyS className="w-20 h-20" color="#FFC107" />
        </div>
        <div className="absolute bottom-16 left-6 opacity-40 pointer-events-none atlittle-wobble atlittle-stagger-3">
          <ScribbleCloud className="w-28 h-20" color="white" />
        </div>
        {/* Extra splat for more energy */}
        <div
          className="absolute top-8 left-1/3 opacity-30 pointer-events-none atlittle-spin-slow"
        >
          <WobblyCircle className="w-12 h-12" color="white" />
        </div>

        {/* Main content with bounce animations */}
        <div className="relative">
          <p
            className="text-white/90 text-base font-bold uppercase tracking-wider animate-fade-in stagger-1 italic"
            style={{ fontFamily: "var(--font-nunito), system-ui" }}
          >
            {subtext}
          </p>
          <h1
            className="text-5xl md:text-6xl font-black text-white leading-tight mt-2 atlittle-bounce-in"
            style={{
              fontFamily: "var(--font-baloo), var(--font-nunito), system-ui",
              textShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
              letterSpacing: "-0.02em",
            }}
          >
            {greeting}
          </h1>

          {/* Search prompt - wiggly and playful */}
          <div
            className="mt-7 bg-white rounded-2xl p-4 flex items-center gap-3 cursor-pointer atlittle-wiggle-in atlittle-btn hover:scale-[1.03] hover:rotate-1 transition-transform"
            style={{
              border: `3px solid ${C.ink}`,
              boxShadow: `6px 6px 0 ${C.ink}`,
              willChange: "transform",
            }}
          >
            <DoodleSearch size={28} color="#FF5722" />
            <span className="text-gray-400 font-semibold">What are you looking for?</span>
          </div>
        </div>
      </div>

      {/* ADVENTURE PICKER - Where's Waldo-style illustrated grid */}
      <div className="px-4 py-8 relative" style={{ backgroundColor: C.paper }}>
        {/* Background decoration */}
        <div className="absolute top-4 right-4 opacity-15 pointer-events-none atlittle-float">
          <ConfettiBurst className="w-24 h-24" />
        </div>

        <h2
          className="text-2xl md:text-3xl font-black mb-5"
          style={{
            color: C.ink,
            fontFamily: "var(--font-baloo), system-ui",
            letterSpacing: "-0.01em",
          }}
        >
          Pick Your Adventure
        </h2>

        <div className="grid grid-cols-3 gap-3">
          {ADVENTURES.map((adv) => {
            const Illustration = ILLUSTRATIONS[adv.id];
            const isHovered = hoveredAdventure === adv.id;

            return (
              <Link
                key={adv.id}
                href={`/${portalSlug}?view=find&type=events&${FILTERS[adv.id]}`}
                className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
                  adv.size === "large" ? "col-span-2 row-span-2" :
                  adv.size === "medium" ? "col-span-2" : ""
                }`}
                style={{
                  backgroundColor: adv.color,
                  border: `3px solid ${C.ink}`,
                  boxShadow: isHovered ? `6px 6px 0 ${C.ink}` : `3px 3px 0 ${C.ink}`,
                  transform: isHovered ? "translate(-2px, -2px)" : "none",
                  minHeight: adv.size === "large" ? "180px" : adv.size === "medium" ? "100px" : "120px",
                }}
                onMouseEnter={() => setHoveredAdventure(adv.id)}
                onMouseLeave={() => setHoveredAdventure(null)}
              >
                {/* Illustration fills the card */}
                <div className="absolute inset-0">
                  <Illustration
                    isHovered={isHovered}
                    className="w-full h-full"
                    style={{ opacity: 0.9 }}
                  />
                </div>

                {/* Label overlay at bottom */}
                <div
                  className="absolute bottom-0 left-0 right-0 px-3 py-2"
                  style={{
                    background: `linear-gradient(transparent, ${adv.color}ee, ${adv.color})`,
                  }}
                >
                  <span
                    className={`font-black text-white drop-shadow-md ${
                      adv.size === "large" ? "text-xl" : "text-sm"
                    }`}
                    style={{
                      fontFamily: "var(--font-baloo), system-ui",
                      textShadow: "1px 1px 0 rgba(0,0,0,0.3)",
                    }}
                  >
                    {adv.label}
                  </span>
                </div>

                {/* Hover hint */}
                {isHovered && (
                  <div
                    className="absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: C.ink }}
                  >
                    Explore →
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Decorative divider - animated squiggly line */}
      <div className="flex justify-center items-center gap-4 py-6" style={{ backgroundColor: C.cream }}>
        <DoodleStar size={24} color={C.yellow} className="atlittle-twinkle" />
        <Squiggle className="opacity-70 atlittle-squiggle-draw" color={C.orange} />
        <DoodleStar size={24} color={C.yellow} className="atlittle-twinkle atlittle-stagger-3" />
      </div>

      {/* TODAY'S ADVENTURES */}
      {(todayEvents?.length ?? 0) > 0 && (
        <AdventureSection
          title="Happening Today"
          icon={<DoodleBolt size={26} color="#FFC107" />}
          color={C.pink}
          events={todayEvents || []}
          viewMoreHref={`/${portalSlug}?view=find&type=events&date=today`}
          portalSlug={portalSlug}
          isLoading={loadingToday}
        />
      )}

      {/* WEEKEND ADVENTURES */}
      <AdventureSection
        title="This Weekend"
        icon={<DoodleParty size={26} />}
        color={C.purple}
        events={weekendEvents || []}
        viewMoreHref={`/${portalSlug}?view=find&type=events&date=weekend`}
        portalSlug={portalSlug}
        isLoading={loadingWeekend}
      />

      {/* FREE ADVENTURES */}
      <AdventureSection
        title="Free for Families"
        icon={<DoodleTag size={26} color="#4CAF50" />}
        color={C.green}
        events={freeEvents || []}
        viewMoreHref={`/${portalSlug}?view=find&type=events&free=1`}
        portalSlug={portalSlug}
        isLoading={loadingFree}
      />

      {/* BOTTOM CTA - Big, bold, bouncy */}
      <div className="px-4 mt-8 mb-4">
        <Link
          href={`/${portalSlug}?view=find&type=events`}
          className="block w-full py-5 rounded-2xl text-center font-black text-xl text-white transition-all hover:scale-[1.03] hover:-rotate-1 atlittle-btn"
          style={{
            backgroundColor: C.ink,
            fontFamily: "var(--font-baloo), system-ui",
            boxShadow: `6px 6px 0 ${C.orange}`,
            border: `3px solid ${C.ink}`,
          }}
        >
          Explore All Adventures
          <DoodleRocket size={32} className="inline-block ml-3 -mt-1 group-hover:animate-bounce" />
        </Link>
      </div>
    </div>
  );
}

export default FamilyFeed;
