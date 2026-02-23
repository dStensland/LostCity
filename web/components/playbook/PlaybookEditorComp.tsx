"use client";

/**
 * PlaybookEditorComp v4 — Real Mapbox + Existing Card Components
 *
 * v4: Integrates real Mapbox GL map and uses existing EventCard/VenueCard
 * components for timeline stops, ensuring visual consistency with the
 * rest of the LostCity platform.
 *
 * Note: In the real implementation, stop cards would be wrapped in
 * PlaybookTimelineBlock (with edit affordances) instead of using the
 * raw EventCard/VenueCard Link navigation.
 */

import { useState, useEffect } from "react";
import Map, { Marker, Source, Layer, NavigationControl } from "react-map-gl";
import { MAPBOX_TOKEN, DARK_STYLE } from "@/lib/map-config";
import MapPin from "@/components/map/MapPin";
import { CompactEventCard } from "@/components/EventCard";
import type { FeedEventData } from "@/components/EventCard";
import VenueCard from "@/components/VenueCard";
import type { Spot } from "@/lib/spots-constants";
import { getCategoryColor } from "@/components/CategoryIcon";
import {
  Star,
  ForkKnife,
  Martini,
  Lightning,
  MoonStars,
} from "@phosphor-icons/react/dist/ssr";

/* ═══════════════════════════════════════════════════════════════
   Mock Data
   ═══════════════════════════════════════════════════════════════ */

const PORTAL_SLUG = "atlanta";

const MOCK_ANCHOR_EVENT: FeedEventData = {
  id: 12345,
  title: "Khruangbin",
  start_date: "2026-03-07",
  start_time: "20:00",
  is_all_day: false,
  is_free: false,
  price_min: 45,
  price_max: 65,
  category: "music",
  image_url: null,
  description: "An evening of psychedelic soul at The Tabernacle",
  going_count: 247,
  interested_count: 89,
  recommendation_count: 12,
  is_trending: true,
  venue: {
    id: 100,
    name: "The Tabernacle",
    neighborhood: "Downtown",
    slug: "the-tabernacle",
  },
};

const MOCK_DINNER_VENUE: Spot = {
  id: 200,
  name: "Osteria 832",
  slug: "osteria-832",
  address: "832 Peachtree St NE",
  neighborhood: "Midtown",
  city: "Atlanta",
  state: "GA",
  lat: 33.7808,
  lng: -84.383,
  venue_type: "restaurant",
  venue_types: ["restaurant"],
  description: "Fresh pasta and wood-fired pizzas in a cozy Midtown setting",
  short_description: "Italian · Fresh pasta & wood-fired pizza",
  price_level: 2,
  website: null,
  instagram: null,
  hours_display: null,
  vibes: null,
  genres: null,
  image_url: null,
  featured: false,
  active: true,
  claimed_by: null,
  is_verified: true,
  event_count: 3,
  is_open: true,
  closes_at: "22:00",
};

const MOCK_DRINKS_VENUE: Spot = {
  id: 300,
  name: "Sister Louisa's",
  slug: "sister-louisas",
  address: "466 Edgewood Ave SE",
  neighborhood: "Edgewood",
  city: "Atlanta",
  state: "GA",
  lat: 33.7554,
  lng: -84.3722,
  venue_type: "bar",
  venue_types: ["bar"],
  description: "Church-themed dive bar with ping pong and art",
  short_description: "Dive Bar · Open until 2am",
  price_level: 1,
  website: null,
  instagram: null,
  hours_display: null,
  vibes: null,
  genres: null,
  image_url: null,
  featured: false,
  active: true,
  claimed_by: null,
  is_verified: true,
  event_count: 5,
  is_open: true,
  closes_at: "02:00",
};

type StopMeta = {
  id: string;
  time: string;
  duration: number;
  isAnchor: boolean;
  category: string;
} & (
  | { kind: "venue"; venue: Spot }
  | { kind: "event"; event: FeedEventData }
);

const STOPS: StopMeta[] = [
  { id: "1", time: "6:30 PM", duration: 75, isAnchor: false, category: "restaurant", kind: "venue", venue: MOCK_DINNER_VENUE },
  { id: "2", time: "8:00 PM", duration: 150, isAnchor: true, category: "music", kind: "event", event: MOCK_ANCHOR_EVENT },
  { id: "3", time: "10:35 PM", duration: 60, isAnchor: false, category: "bar", kind: "venue", venue: MOCK_DRINKS_VENUE },
];

const MAP_COORDS = [
  { lng: -84.383, lat: 33.7808 },
  { lng: -84.3907, lat: 33.7592 },
  { lng: -84.3722, lat: 33.7554 },
];

const ROUTE_GEOJSON = {
  type: "Feature" as const,
  properties: {},
  geometry: {
    type: "LineString" as const,
    coordinates: MAP_COORDS.map((c) => [c.lng, c.lat]),
  },
};

type DangerLevel = "safe" | "warning" | "danger";

const CONNECTORS: { walkMinutes: number; walkDistance: string; bufferMinutes: number; level: DangerLevel; label: string }[] = [
  { walkMinutes: 8, walkDistance: "0.4 mi", bufferMinutes: 15, level: "safe", label: "15 min buffer" },
  { walkMinutes: 5, walkDistance: "0.2 mi", bufferMinutes: 7, level: "warning", label: "Cutting it close" },
];

const SUGGESTIONS = [
  { id: "s1", name: "Joystick Gamebar", category: "Bar", walkMinutes: 6, time: "10:40 PM", icon: <Lightning size={16} weight="light" className="text-emerald-400" /> },
  { id: "s2", name: "The Vortex", category: "Late Night Eats", walkMinutes: 9, time: "10:45 PM", icon: <ForkKnife size={16} weight="light" className="text-amber-400" /> },
  { id: "s3", name: "MJQ Concourse", category: "Club", walkMinutes: 12, time: "11:00 PM", icon: <MoonStars size={16} weight="light" className="text-violet-400" /> },
  { id: "s4", name: "Edgewood Speakeasy", category: "Cocktail Bar", walkMinutes: 4, time: "10:35 PM", icon: <Martini size={16} weight="light" className="text-sky-400" /> },
];

/* ─── Constants ────────────────────────────────────────────── */

const ZONE_COLORS = {
  safe: { dot: "#00D9A0", bg: "rgba(0, 217, 160, 0.08)", border: "rgba(0, 217, 160, 0.2)", text: "#00D9A0" },
  warning: { dot: "#FFB800", bg: "rgba(255, 184, 0, 0.08)", border: "rgba(255, 184, 0, 0.25)", text: "#FFB800" },
  danger: { dot: "#FF3366", bg: "rgba(255, 51, 102, 0.08)", border: "rgba(255, 51, 102, 0.25)", text: "#FF3366" },
};

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E")`;

const ROUTE_GLOW_LAYER = {
  id: "route-glow",
  type: "line" as const,
  paint: {
    "line-color": "#00D4E8",
    "line-width": 8,
    "line-opacity": 0.06,
    "line-blur": 4,
  },
};

const ROUTE_LINE_LAYER = {
  id: "route-line",
  type: "line" as const,
  paint: {
    "line-color": "#00D4E8",
    "line-width": 2,
    "line-dasharray": [3, 2] as [number, number],
    "line-opacity": 0.4,
  },
};

/* ═══════════════════════════════════════════════════════════════
   Playbook Map (Real Mapbox GL)
   ═══════════════════════════════════════════════════════════════ */

function PlaybookMap({ className = "" }: { className?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // @ts-expect-error - Dynamic CSS import for Mapbox GL
    import("mapbox-gl/dist/mapbox-gl.css");
  }, []);

  if (!mounted) {
    return (
      <div className={`${className} relative overflow-hidden`} style={{ background: "#07070C" }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "rgba(0, 212, 232, 0.2)", borderTopColor: "transparent" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} relative overflow-hidden`}>
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={DARK_STYLE}
        initialViewState={{ longitude: -84.382, latitude: 33.766, zoom: 12.6 }}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {/* Route line with glow */}
        <Source id="route" type="geojson" data={ROUTE_GEOJSON}>
          <Layer {...ROUTE_GLOW_LAYER} />
          <Layer {...ROUTE_LINE_LAYER} />
        </Source>

        {/* Stop 1: Osteria 832 */}
        <Marker longitude={MAP_COORDS[0].lng} latitude={MAP_COORDS[0].lat} anchor="bottom">
          <MapPin category="restaurant" />
        </Marker>

        {/* Stop 2: The Tabernacle (Anchor — gold star) */}
        <Marker longitude={MAP_COORDS[1].lng} latitude={MAP_COORDS[1].lat} anchor="center">
          <div
            className="anchor-map-marker flex items-center justify-center rounded-full text-[14px] cursor-pointer"
            style={{
              width: 34,
              height: 34,
              background: "rgba(255, 217, 61, 0.12)",
              border: "2.5px solid rgba(255, 217, 61, 0.6)",
              color: "#FFD93D",
              boxShadow: "0 0 24px rgba(255, 217, 61, 0.3), 0 0 8px rgba(255, 217, 61, 0.15)",
            }}
          >
            <Star size={14} weight="fill" />
          </div>
        </Marker>

        {/* Stop 3: Sister Louisa's */}
        <Marker longitude={MAP_COORDS[2].lng} latitude={MAP_COORDS[2].lat} anchor="bottom">
          <MapPin category="bar" />
        </Marker>
      </Map>

      {/* Noise texture overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: NOISE_SVG, opacity: 0.5 }} />

      {/* Map legend */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2">
        <span
          className="text-[9px] px-1.5 py-0.5 rounded"
          style={{
            fontFamily: "var(--font-mono)",
            background: "rgba(0, 212, 232, 0.08)",
            color: "rgba(0, 212, 232, 0.5)",
            border: "1px solid rgba(0, 212, 232, 0.1)",
            backdropFilter: "blur(8px)",
          }}
        >
          0.6 mi total
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Inline Add Button
   ═══════════════════════════════════════════════════════════════ */

function InlineAddButton() {
  return (
    <div className="relative flex gap-3 py-0.5">
      <div className="shrink-0 w-[54px]" />
      <div className="shrink-0 w-6 flex justify-center">
        <button className="inline-add-btn w-[18px] h-[18px] rounded-full flex items-center justify-center transition-all">
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <path d="M5 2V8M2 5H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="flex-1" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Add Stop Panel
   ═══════════════════════════════════════════════════════════════ */

function AddStopPanel({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const filters = [
    { key: "food", label: "Food", icon: <ForkKnife size={12} weight="light" /> },
    { key: "drinks", label: "Drinks", icon: <Martini size={12} weight="light" /> },
    { key: "activity", label: "Activity", icon: <Lightning size={12} weight="light" /> },
    { key: "nightlife", label: "Nightlife", icon: <MoonStars size={12} weight="light" /> },
  ];

  if (!expanded) {
    return (
      <div className="relative flex gap-3 pt-3 animate-fade-in">
        <div className="shrink-0 w-[54px]" />
        <div className="shrink-0 w-6 flex justify-center">
          <div className="w-px h-full" style={{ background: "rgba(0, 212, 232, 0.06)" }} />
        </div>
        <button
          onClick={onToggle}
          className="add-stop-btn flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl border border-dashed transition-all"
          style={{ borderColor: "var(--twilight)", color: "var(--muted)", background: "transparent" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2.625V11.375M2.625 7H11.375" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-[12px] font-medium" style={{ fontFamily: "var(--font-outfit)" }}>Add a stop</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex gap-3 pt-3 animate-content-reveal">
      <div className="shrink-0 w-[54px]" />
      <div className="shrink-0 w-6 flex justify-center">
        <div className="w-px h-full" style={{ background: "rgba(0, 212, 232, 0.15)" }} />
      </div>
      <div
        className="flex-1 rounded-xl overflow-hidden"
        style={{
          background: "rgba(15, 15, 20, 0.8)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(0, 212, 232, 0.12)",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.03)",
        }}
      >
        {/* Search bar */}
        <div className="px-3 pt-3 pb-2">
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
            style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: "var(--muted)", opacity: 0.4 }}>
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span className="text-[12px]" style={{ color: "var(--muted)", opacity: 0.35, fontFamily: "var(--font-outfit)" }}>
              Search for a place...
            </span>
          </div>
        </div>

        {/* Category chips */}
        <div className="flex gap-1.5 px-3 pb-2.5 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(activeFilter === f.key ? null : f.key)}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
              style={{
                fontFamily: "var(--font-outfit)",
                background: activeFilter === f.key ? "rgba(0, 212, 232, 0.12)" : "rgba(255, 255, 255, 0.03)",
                border: `1px solid ${activeFilter === f.key ? "rgba(0, 212, 232, 0.3)" : "rgba(255, 255, 255, 0.05)"}`,
                color: activeFilter === f.key ? "var(--neon-cyan)" : "var(--muted)",
              }}
            >
              <span className="flex items-center">{f.icon}</span>
              {f.label}
            </button>
          ))}
        </div>

        {/* Label */}
        <div className="px-3 pt-0.5 pb-1.5">
          <p
            className="text-[10px] uppercase"
            style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", opacity: 0.4, letterSpacing: "0.08em" }}
          >
            Suggested nearby
          </p>
        </div>

        {/* Suggestion cards */}
        <div className="px-1.5 pb-1.5">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={s.id}
              className={`suggestion-card w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-all text-left animate-fade-in stagger-${i + 1}`}
            >
              <div
                className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-[16px]"
                style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.06)" }}
              >
                {s.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate" style={{ color: "var(--cream)", fontFamily: "var(--font-outfit)" }}>
                  {s.name}
                </p>
                <p className="text-[10px] truncate" style={{ color: "var(--muted)", opacity: 0.5, fontFamily: "var(--font-mono)" }}>
                  {s.category} · {s.walkMinutes} min walk
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="text-[10px]" style={{ color: "var(--muted)", opacity: 0.4, fontFamily: "var(--font-mono)" }}>
                  {s.time}
                </span>
                <div className="suggestion-add-btn w-6 h-6 rounded-full flex items-center justify-center transition-all">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 2.5V9.5M2.5 6H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Cancel */}
        <div className="px-3 pb-3">
          <button
            onClick={onToggle}
            className="w-full py-2 text-[12px] font-medium rounded-lg transition-all"
            style={{ color: "var(--muted)", background: "rgba(255, 255, 255, 0.02)", fontFamily: "var(--font-outfit)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */

export default function PlaybookEditorComp() {
  const [mapExpanded, setMapExpanded] = useState(true);
  const [addStopExpanded, setAddStopExpanded] = useState(true);

  return (
    <div className="playbook-editor min-h-screen relative" style={{ background: "var(--void)" }}>
      {/* Atmospheric background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `
            radial-gradient(ellipse at 20% 0%, rgba(0, 212, 232, 0.025), transparent 50%),
            radial-gradient(ellipse at 80% 100%, rgba(255, 217, 61, 0.015), transparent 40%)
          `,
        }}
      />
      <div className="fixed inset-0 pointer-events-none z-0" style={{ backgroundImage: NOISE_SVG, opacity: 0.6 }} />

      {/* ─── Sticky Header ─────────────────────────── */}
      <header
        className="sticky top-0 z-30 border-b animate-fade-in"
        style={{
          background: "rgba(9, 9, 11, 0.82)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderColor: "rgba(37, 37, 48, 0.6)",
        }}
      >
        <div className="max-w-5xl mx-auto flex items-center gap-3 px-4 py-3">
          <button
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/[0.04]"
            style={{ color: "var(--muted)" }}
            aria-label="Back"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="flex-1 min-w-0">
            <h1
              className="text-[15px] font-semibold truncate"
              style={{ color: "var(--cream)", fontFamily: "var(--font-outfit)", letterSpacing: "-0.02em" }}
            >
              Saturday Night Out
            </h1>
            <p className="text-[10px]" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.03em" }}>
              SAT MAR 7 · 3 STOPS · 0.6 MI
            </p>
          </div>

          <span
            className="shrink-0 px-2 py-0.5 rounded-full text-[9px] uppercase"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--muted)",
              opacity: 0.7,
              background: "rgba(139, 139, 148, 0.08)",
              border: "1px solid rgba(139, 139, 148, 0.12)",
              letterSpacing: "0.08em",
            }}
          >
            Draft
          </span>

          <button
            className="share-btn shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
            style={{
              fontFamily: "var(--font-outfit)",
              color: "var(--neon-cyan)",
              border: "1px solid rgba(0, 212, 232, 0.25)",
              background: "rgba(0, 212, 232, 0.04)",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M10.5 5.25a1.75 1.75 0 100-3.5 1.75 1.75 0 000 3.5zM3.5 8.75a1.75 1.75 0 100-3.5 1.75 1.75 0 000 3.5zM10.5 12.25a1.75 1.75 0 100-3.5 1.75 1.75 0 000 3.5z" stroke="currentColor" strokeWidth="1.2" />
              <path d="M5.02 8.02L8.98 9.98M8.98 4.02L5.02 5.98" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            Share
          </button>
        </div>
      </header>

      {/* ─── Two-column layout ──────────────────────── */}
      <div className="relative z-10 max-w-5xl mx-auto lg:flex lg:gap-0">
        {/* ─── LEFT: Timeline ────────────────────────── */}
        <main className="flex-1 lg:max-w-xl px-4 pt-4 pb-32">
          {/* Mobile map (collapsible) */}
          <div className="lg:hidden mb-5 animate-content-reveal stagger-1">
            <button
              onClick={() => setMapExpanded(!mapExpanded)}
              className="flex items-center gap-1.5 mb-2 transition-colors hover:opacity-80"
              style={{ color: "var(--muted)" }}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.4 }}>
                <path d="M1 3.5L5 1.5V10.5L1 12.5V3.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                <path d="M5 1.5L9 3.5V12.5L5 10.5V1.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                <path d="M9 3.5L13 1.5V10.5L9 12.5V3.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
              </svg>
              <span className="text-[11px] font-medium" style={{ fontFamily: "var(--font-outfit)" }}>
                {mapExpanded ? "Hide route" : "Show route"}
              </span>
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                style={{
                  transform: mapExpanded ? "rotate(0)" : "rotate(-90deg)",
                  transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              >
                <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
            {mapExpanded && <PlaybookMap className="rounded-xl h-[180px] border border-white/[0.04]" />}
          </div>

          {/* ─── Timeline ───────────────────────────── */}
          <div className="relative">
            {/* Spine line */}
            <div
              className="absolute left-[27px] top-4 bottom-4 w-px"
              style={{
                background: `linear-gradient(to bottom,
                  transparent 0%,
                  rgba(0, 212, 232, 0.12) 6%,
                  rgba(0, 212, 232, 0.18) 30%,
                  rgba(255, 217, 61, 0.14) 50%,
                  rgba(0, 212, 232, 0.18) 70%,
                  rgba(0, 212, 232, 0.12) 94%,
                  transparent 100%
                )`,
              }}
            />

            {STOPS.map((stop, idx) => {
              const accentColor = stop.isAnchor ? "#FFD93D" : getCategoryColor(stop.category);

              return (
                <div key={stop.id}>
                  {/* ─── Stop Block ──────── */}
                  <div className={`timeline-stop relative flex gap-3 animate-content-reveal stagger-${idx + 2}`}>
                    {/* Time column */}
                    <div className="shrink-0 w-[54px] flex flex-col items-end pt-3">
                      <span
                        className="text-[11px] leading-none"
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontFeatureSettings: "'tnum'",
                          color: stop.isAnchor ? "var(--gold)" : "var(--muted)",
                          opacity: stop.isAnchor ? 1 : 0.7,
                        }}
                      >
                        {stop.time}
                      </span>
                    </div>

                    {/* Spine dot */}
                    <div className="shrink-0 relative z-10 flex items-start pt-3">
                      {stop.isAnchor ? (
                        <div
                          className="anchor-dot w-7 h-7 rounded-full flex items-center justify-center text-[12px]"
                          style={{
                            background: "rgba(255, 217, 61, 0.15)",
                            border: "2px solid rgba(255, 217, 61, 0.55)",
                            color: "var(--gold)",
                            boxShadow: "0 0 16px rgba(255, 217, 61, 0.3), 0 0 4px rgba(255, 217, 61, 0.15)",
                          }}
                        >
                          <Star size={12} weight="fill" />
                        </div>
                      ) : (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold"
                          style={{
                            fontFamily: "var(--font-mono)",
                            background: "var(--night)",
                            border: `2px solid ${accentColor}40`,
                            color: accentColor,
                          }}
                        >
                          {idx + 1}
                        </div>
                      )}
                    </div>

                    {/* Card area */}
                    <div className="flex-1 min-w-0">
                      {stop.kind === "event" ? (
                        /* Anchor Event: Gold-wrapped CompactEventCard */
                        <div className="relative">
                          {stop.isAnchor && (
                            <>
                              {/* Gold glow ring overlay */}
                              <div
                                className="absolute -inset-[1px] rounded-xl pointer-events-none z-10"
                                style={{
                                  border: "2px solid rgba(255, 217, 61, 0.25)",
                                  boxShadow: "0 0 24px rgba(255, 217, 61, 0.08), 0 0 48px rgba(255, 217, 61, 0.03)",
                                }}
                              />
                              {/* Anchor badge */}
                              <div
                                className="absolute -top-2.5 -right-2 z-20 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  background: "rgba(255, 217, 61, 0.12)",
                                  backdropFilter: "blur(8px)",
                                  border: "1px solid rgba(255, 217, 61, 0.35)",
                                  color: "#FFD93D",
                                }}
                              >
                                <Star size={10} weight="fill" /> Anchor
                              </div>
                            </>
                          )}
                          <CompactEventCard event={stop.event} portalSlug={PORTAL_SLUG} showDate={false} />
                        </div>
                      ) : (
                        /* Venue Stop: VenueCard */
                        <VenueCard venue={stop.venue} portalSlug={PORTAL_SLUG} variant="discovery" />
                      )}

                      {/* Duration chip below card */}
                      <div className="flex items-center gap-2 mt-1.5 pl-1">
                        <span
                          className="px-2 py-0.5 rounded text-[10px]"
                          style={{
                            fontFamily: "var(--font-mono)",
                            background: `${accentColor}0D`,
                            color: `${accentColor}BB`,
                            letterSpacing: "0.02em",
                          }}
                        >
                          {stop.duration} min
                        </span>
                        {stop.isAnchor && (
                          <span
                            className="flex items-center gap-1 text-[9px]"
                            style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", opacity: 0.4 }}
                          >
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                              <path
                                d="M9 4V3C9 1.89543 8.10457 1 7 1H5C3.89543 1 3 1.89543 3 3V4M2 4H10C10.5523 4 11 4.44772 11 5V10C11 10.5523 10.5523 11 10 11H2C1.44772 11 1 10.5523 1 10V5C1 4.44772 1.44772 4 2 4Z"
                                stroke="currentColor"
                                strokeWidth="1.1"
                                strokeLinecap="round"
                              />
                            </svg>
                            Fixed time
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ─── Connector ──────── */}
                  {idx < CONNECTORS.length && (
                    <>
                      <InlineAddButton />
                      <div className={`relative flex gap-3 py-1 animate-fade-in stagger-${idx + 3}`}>
                        <div className="shrink-0 w-[54px]" />
                        <div className="shrink-0 w-6 flex justify-center">
                          <div className="w-px h-full" style={{ background: "rgba(0, 212, 232, 0.1)" }} />
                        </div>
                        <div className="flex-1 flex flex-col gap-1 py-0.5">
                          {/* Walk info */}
                          <div className="flex items-center gap-1.5">
                            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ color: "var(--muted)", opacity: 0.35 }}>
                              <path
                                d="M7.875 1.75C8.35825 1.75 8.75 1.35825 8.75 0.875C8.75 0.39175 8.35825 0 7.875 0C7.39175 0 7 0.39175 7 0.875C7 1.35825 7.39175 1.75 7.875 1.75Z"
                                fill="currentColor"
                              />
                              <path
                                d="M9.625 4.375L7.875 2.625L5.25 5.25M7 7L5.25 10.5L6.5625 10.5M7 7L8.75 10.5L7.4375 10.5M7 7L7.875 5.25"
                                stroke="currentColor"
                                strokeWidth="1.1"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <span
                              className="text-[10px]"
                              style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", opacity: 0.45 }}
                            >
                              {CONNECTORS[idx].walkMinutes} min walk · {CONNECTORS[idx].walkDistance}
                            </span>
                          </div>

                          {/* Buffer pill */}
                          <div
                            className={`danger-pill inline-flex items-center gap-1.5 self-start px-2 py-0.5 rounded-md text-[10px] ${CONNECTORS[idx].level !== "safe" ? "danger-pulse" : ""}`}
                            style={{
                              fontFamily: "var(--font-mono)",
                              background: ZONE_COLORS[CONNECTORS[idx].level].bg,
                              border: `1px solid ${ZONE_COLORS[CONNECTORS[idx].level].border}`,
                              color: ZONE_COLORS[CONNECTORS[idx].level].text,
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{
                                background: ZONE_COLORS[CONNECTORS[idx].level].dot,
                                boxShadow:
                                  CONNECTORS[idx].level !== "safe" ? `0 0 6px ${ZONE_COLORS[CONNECTORS[idx].level].dot}50` : "none",
                              }}
                            />
                            {CONNECTORS[idx].level === "safe" && <span>{CONNECTORS[idx].bufferMinutes} min buffer</span>}
                            {CONNECTORS[idx].level === "warning" && (
                              <span>
                                {CONNECTORS[idx].bufferMinutes} min buffer — {CONNECTORS[idx].label}
                              </span>
                            )}
                            {CONNECTORS[idx].level === "danger" && <span>You might be late</span>}
                          </div>

                          {CONNECTORS[idx].level !== "safe" && (
                            <span
                              className="text-[9px]"
                              style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", opacity: 0.3 }}
                            >
                              {CONNECTORS[idx].walkMinutes} min walk + {CONNECTORS[idx].bufferMinutes} min buffer
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {/* ─── Add Stop Panel ──────── */}
            <AddStopPanel expanded={addStopExpanded} onToggle={() => setAddStopExpanded(!addStopExpanded)} />
          </div>
        </main>

        {/* ─── RIGHT: Map sidebar (desktop) ──────────── */}
        <aside className="hidden lg:block lg:w-[400px] lg:shrink-0">
          <div className="sticky top-[57px] h-[calc(100vh-57px)] border-l" style={{ borderColor: "rgba(37, 37, 48, 0.4)" }}>
            <PlaybookMap className="h-full" />
          </div>
        </aside>
      </div>

      {/* ─── Scoped Styles ──────────────────────────── */}
      <style>{`
        .anchor-dot { animation: anchorGlow 3s ease-in-out infinite; }
        @keyframes anchorGlow {
          0%, 100% { box-shadow: 0 0 16px rgba(255, 217, 61, 0.3), 0 0 4px rgba(255, 217, 61, 0.15); }
          50% { box-shadow: 0 0 22px rgba(255, 217, 61, 0.45), 0 0 6px rgba(255, 217, 61, 0.25); }
        }

        .anchor-map-marker { animation: anchorMapPulse 2.5s ease-in-out infinite; }
        @keyframes anchorMapPulse {
          0%, 100% { box-shadow: 0 0 24px rgba(255, 217, 61, 0.3), 0 0 8px rgba(255, 217, 61, 0.15); }
          50% { box-shadow: 0 0 32px rgba(255, 217, 61, 0.45), 0 0 12px rgba(255, 217, 61, 0.25); }
        }

        .inline-add-btn {
          background: var(--night); border: 1px solid var(--twilight);
          color: var(--muted); opacity: 0.4;
        }
        .inline-add-btn:hover {
          opacity: 1; border-color: rgba(0, 212, 232, 0.3);
          color: var(--neon-cyan); background: rgba(0, 212, 232, 0.06);
          box-shadow: 0 0 10px rgba(0, 212, 232, 0.15);
        }

        .add-stop-btn:hover {
          border-color: rgba(0, 212, 232, 0.25) !important;
          color: var(--neon-cyan) !important;
          background: rgba(0, 212, 232, 0.03) !important;
        }

        .suggestion-card:hover { background: rgba(255, 255, 255, 0.03); }
        .suggestion-add-btn {
          background: rgba(0, 212, 232, 0.06); color: var(--neon-cyan);
          opacity: 0.35; transition: all 0.2s ease;
        }
        .suggestion-card:hover .suggestion-add-btn {
          opacity: 1; background: rgba(0, 212, 232, 0.12);
          box-shadow: 0 0 8px rgba(0, 212, 232, 0.2);
        }

        .share-btn:hover {
          background: rgba(0, 212, 232, 0.08) !important;
          border-color: rgba(0, 212, 232, 0.4) !important;
          box-shadow: 0 0 12px rgba(0, 212, 232, 0.1);
        }

        .danger-pulse { animation: dangerPulse 2.5s ease-in-out infinite; }
        @keyframes dangerPulse {
          0%, 100% { box-shadow: none; }
          50% { box-shadow: 0 0 8px rgba(255, 184, 0, 0.15); }
        }
      `}</style>
    </div>
  );
}
