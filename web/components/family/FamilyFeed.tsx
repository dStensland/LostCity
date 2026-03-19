"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Users, CalendarBlank } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";
import dynamic from "next/dynamic";
import { TodayView } from "./TodayView";
// SpringBreakBanner renders above the fold — static import prevents the dead
// click zone that dynamic() causes during hydration.
import { SpringBreakBanner } from "./SpringBreakBanner";

// Inline skeleton used as fallback while lazy tabs load
function TabSkeleton() {
  return (
    <div className="px-4 pt-4 pb-8 space-y-3">
      {[80, 120, 80].map((h, i) => (
        <div
          key={i}
          className="rounded-2xl animate-pulse"
          style={{ height: h, backgroundColor: "#E0DDD4" }}
        />
      ))}
    </div>
  );
}

const ProgramsBrowser = dynamic(
  () => import("./ProgramsBrowser").then((m) => ({ default: m.ProgramsBrowser })),
  { loading: () => <TabSkeleton /> }
);
const CalendarView = dynamic(
  () => import("./CalendarView").then((m) => ({ default: m.CalendarView })),
  { loading: () => <TabSkeleton /> }
);
const CrewSetup = dynamic(
  () => import("./CrewSetup").then((m) => ({ default: m.CrewSetup })),
  { loading: () => <TabSkeleton /> }
);
const BreakPlanner = dynamic(
  () => import("./BreakPlanner").then((m) => ({ default: m.BreakPlanner })),
  { loading: () => <TabSkeleton /> }
);
import { KidFilterChips, type GenericFilter } from "./KidFilterChips";
import { useKidProfiles } from "@/lib/hooks/useKidProfiles";
import type { KidProfile } from "@/lib/types/kid-profiles";
import type { SchoolCalendarEvent } from "@/lib/types/programs";
import { FAMILY_TOKENS } from "@/lib/family-design-tokens";

// ---- Palette (Afternoon Field) -------------------------------------------
const CANVAS = FAMILY_TOKENS.canvas;
const CARD_SURFACE = FAMILY_TOKENS.card;
const SAGE = FAMILY_TOKENS.sage;
const AMBER = FAMILY_TOKENS.amber;
const TEXT_PRIMARY = FAMILY_TOKENS.text;
const TEXT_SECONDARY = FAMILY_TOKENS.textSecondary;
const BORDER = FAMILY_TOKENS.border;

// ---- Types ---------------------------------------------------------------

type TabId = "today" | "programs" | "crew";

interface NavItem {
  id: TabId;
  label: string;
  icon?: string;
  href?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "today",    label: "Today",    icon: "☀️" },
  { id: "programs", label: "Programs", icon: "📋" },
  { id: "crew",     label: "My Crew",  icon: "👨‍👩‍👧" },
];

interface FamilyFeedProps {
  portalId: string;
  portalSlug: string;
  portalExclusive?: boolean;
}

// ---- Desktop sidebar nav item --------------------------------------------

function SidebarNavItem({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left relative"
      style={{
        fontFamily: "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)",
        color: isActive ? SAGE : TEXT_SECONDARY,
        backgroundColor: isActive ? `${SAGE}22` : isHovered ? `${SAGE}0A` : "transparent",
        borderLeft: isActive ? `4px solid ${AMBER}` : "4px solid transparent",
        transition: "background-color 0.15s",
      }}
    >
      {item.label}
    </button>
  );
}

// ---- Desktop sidebar kid profiles ----------------------------------------

function SidebarKidProfiles({
  kids,
  activeKidIds,
  onToggleKid,
  onOpenCrew,
  isAuthenticated,
  redirectPath,
}: {
  kids: KidProfile[];
  activeKidIds: string[];
  onToggleKid: (id: string) => void;
  onOpenCrew: () => void;
  isAuthenticated: boolean;
  redirectPath: string;
}) {
  return (
    <div className="mt-6">
      <p
        className="text-xs font-bold uppercase tracking-wider mb-2 px-3"
        style={{ fontFamily: "DM Sans, system-ui, sans-serif", color: TEXT_SECONDARY, letterSpacing: "0.1em" }}
      >
        My Crew
      </p>
      {kids.length > 0 ? (
        <div className="space-y-1">
          {kids.map((kid) => {
            const isActive = activeKidIds.includes(kid.id);
            return (
              <button
                key={kid.id}
                onClick={() => onToggleKid(kid.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  color: isActive ? kid.color : TEXT_SECONDARY,
                  backgroundColor: isActive ? `${kid.color}12` : "transparent",
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: kid.color }}
                  aria-hidden="true"
                />
                <span className="font-medium" style={{ fontFamily: "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)" }}>
                  {kid.nickname}
                </span>
                <span className="ml-auto text-xs" style={{ color: TEXT_SECONDARY, opacity: 0.7 }}>
                  {kid.age}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (isAuthenticated) {
              onOpenCrew();
            } else {
              window.location.href = "/auth/login?redirect=" + encodeURIComponent(redirectPath);
            }
          }}
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors hover:opacity-80"
          style={{
            borderColor: `${SAGE}40`,
            color: SAGE,
            backgroundColor: `${SAGE}08`,
            fontFamily: "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)",
          }}
        >
          <span className="text-base leading-none" aria-hidden="true">+</span>
          Set Up My Crew
        </button>
      )}
    </div>
  );
}

// ---- Ghost kid card (unauthenticated preview) ----------------------------

function GhostKidCard({ emoji, nickname, age, color }: { emoji: string; nickname: string; age: number; color: string }) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl border"
      style={{
        backgroundColor: CARD_SURFACE,
        borderColor: `${color}30`,
        borderLeftColor: color,
        borderLeftWidth: 3,
        opacity: 0.4,
        pointerEvents: "none",
        userSelect: "none",
      }}
      aria-hidden="true"
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
        style={{ backgroundColor: `${color}20`, border: `2px solid ${color}50` }}
      >
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug" style={{ color: TEXT_PRIMARY, fontFamily: "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)" }}>
          {nickname}{" "}
          <span className="font-normal text-xs" style={{ color: TEXT_SECONDARY }}>
            age {age}
          </span>
        </p>
        <div className="flex flex-wrap gap-1 mt-1">
          {["Activities", "Programs"].map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded text-2xs"
              style={{ backgroundColor: `${color}15`, color }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Unauthenticated crew empty state ------------------------------------

function CrewSignInPrompt({ portalSlug }: { portalSlug: string }) {
  const redirectPath = typeof window !== "undefined" ? window.location.pathname : `/${portalSlug}`;

  return (
    <div className="space-y-4">
      {/* Value pitch */}
      <p
        className="text-sm leading-6"
        style={{ fontFamily: "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)", color: TEXT_SECONDARY }}
      >
        Add your kids to get age-matched programs, school calendar sync, and a personalized family calendar.
      </p>

      {/* Ghost cards — preview of what a filled crew looks like */}
      <div className="space-y-2">
        <GhostKidCard emoji="🐛" nickname="Bug" age={7} color="#5E7A5E" />
        <GhostKidCard emoji="🚀" nickname="Rocket" age={4} color="#C48B1D" />
      </div>

      {/* Sign-in CTA */}
      <Link
        href={`/auth/login?redirect=${encodeURIComponent(redirectPath)}`}
        className="flex w-full items-center justify-center py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85 active:opacity-75"
        style={{
          backgroundColor: SAGE,
          color: "#fff",
          fontFamily: "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)",
        }}
      >
        Sign in to set up your crew
      </Link>
    </div>
  );
}

// ---- Crew tab content ----------------------------------------------------

function CrewPanel({
  kids,
  isAuthenticated,
  authLoading,
  portalSlug,
}: {
  kids: KidProfile[];
  isAuthenticated: boolean;
  authLoading: boolean;
  portalSlug: string;
}) {
  return (
    <div className="px-4 pb-10 pt-4 sm:px-0">
      <div
        className="rounded-[28px] border px-5 py-5 sm:px-6"
        style={{ backgroundColor: CARD_SURFACE, borderColor: BORDER }}
      >
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${SAGE}16` }}
          >
            <Users size={24} style={{ color: SAGE }} />
          </div>
          <div className="min-w-0">
            <h2
              className="text-2xl font-semibold"
              style={{ fontFamily: "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)", color: TEXT_PRIMARY }}
            >
              My Crew
            </h2>
            <p
              className="mt-2 max-w-2xl text-sm leading-6"
              style={{ fontFamily: "DM Sans, system-ui, sans-serif", color: TEXT_SECONDARY }}
            >
              Add your kids once, then let Family content tune itself around ages, school systems,
              and the programs that actually fit your household.
            </p>
          </div>
        </div>

        <div className="mt-6">
          {/* Show the sign-in prompt immediately — even while auth is loading.
              Only mount CrewSetup once user is confirmed non-null. This prevents
              perpetual skeletons from the dynamic import for unauthenticated users. */}
          {!authLoading && isAuthenticated ? (
            <CrewSetup
              key={kids.map((kid) => kid.id).join(":") || "empty-crew"}
              initialKids={kids}
            />
          ) : (
            <CrewSignInPrompt portalSlug={portalSlug} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Mobile bottom tab bar -----------------------------------------------

function MobileBottomTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-20 border-t"
      style={{
        backgroundColor: CARD_SURFACE,
        borderColor: BORDER,
        // Safe area padding for home indicator
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        height: "calc(52px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="flex justify-around items-center h-[52px] px-2">
        {NAV_ITEMS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center justify-center flex-1 h-full gap-0.5"
              aria-current={isActive ? "page" : undefined}
            >
              {tab.icon && (
                <span
                  style={{ fontSize: 18, lineHeight: 1, opacity: isActive ? 1 : 0.55 }}
                  aria-hidden="true"
                >
                  {tab.icon}
                </span>
              )}
              <span
                className="font-semibold"
                style={{
                  color: isActive ? SAGE : TEXT_SECONDARY,
                  fontSize: "10px",
                  letterSpacing: "0.4px",
                  lineHeight: 1.2,
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Programs view with Browse/Calendar toggle ---------------------------

type ProgramsSubView = "browse" | "calendar";

interface ProgramsWithCalendarProps {
  portalId: string;
  portalSlug: string;
  activeKidIds: string[];
  kids: import("@/lib/types/kid-profiles").KidProfile[];
  activeGenericFilters: import("./KidFilterChips").GenericFilter[];
}

function ProgramsWithCalendar({
  portalId,
  portalSlug,
  activeKidIds,
  kids,
  activeGenericFilters,
}: ProgramsWithCalendarProps) {
  const [subView, setSubView] = useState<ProgramsSubView>("browse");

  return (
    <div>
      {/* Browse / Calendar segmented toggle */}
      <div className="px-4 pt-3 pb-1 sm:px-0">
        <div
          className="inline-flex rounded-full border p-0.5"
          style={{ backgroundColor: CARD_SURFACE, borderColor: BORDER }}
        >
          {(["browse", "calendar"] as ProgramsSubView[]).map((id) => (
            <button
              key={id}
              onClick={() => setSubView(id)}
              className="rounded-full px-4 py-1.5 transition-colors"
              style={{
                fontFamily: "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)",
                fontSize: 13,
                fontWeight: 600,
                color: subView === id ? "#fff" : TEXT_SECONDARY,
                backgroundColor: subView === id ? SAGE : "transparent",
              }}
            >
              {id === "browse" ? "Browse" : "Calendar"}
            </button>
          ))}
        </div>
      </div>

      {subView === "browse" && (
        <ProgramsBrowser
          portalSlug={portalSlug}
          activeKidIds={activeKidIds}
          kids={kids}
          activeGenericFilters={activeGenericFilters}
        />
      )}
      {subView === "calendar" && (
        <CalendarView
          portalSlug={portalSlug}
          portalId={portalId}
          activeKidIds={activeKidIds}
          kids={kids}
        />
      )}
    </div>
  );
}

// "weekend" and "calendar" were removed as standalone tabs — redirect to their merged homes.
const TAB_REDIRECTS: Record<string, TabId> = {
  weekend: "today",
  calendar: "programs",
};

const VALID_TABS = new Set<TabId>(["today", "programs", "crew"]);

// ---- Break countdown helpers -----------------------------------------------

/** Fetches the school calendar (shared query key with TodayView — hits cache). */
async function fetchSchoolCalendar(): Promise<SchoolCalendarEvent[]> {
  const res = await fetch("/api/school-calendar?upcoming=true&limit=5");
  if (!res.ok) return [];
  const json = await res.json();
  return (json.events ?? []) as SchoolCalendarEvent[];
}

/** Returns days until the given YYYY-MM-DD date string, or -1 if it has passed. */
function getDaysUntil(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Returns the next upcoming break event within 21 days, or null. */
function findNextBreak(events: SchoolCalendarEvent[]): SchoolCalendarEvent | null {
  const breaks = events.filter((e) => e.event_type === "break");
  for (const b of breaks) {
    const days = getDaysUntil(b.start_date);
    // Include if: not yet ended (end_date >= today) AND starts within 21 days
    const endDays = getDaysUntil(b.end_date);
    if (endDays >= 0 && days <= 21) return b;
  }
  return null;
}

// ---- Break countdown CTA ---------------------------------------------------

function BreakCountdownCTA({
  breakEvent,
  onOpenPlanner,
}: {
  breakEvent: SchoolCalendarEvent;
  onOpenPlanner: () => void;
}) {
  const daysUntil = getDaysUntil(breakEvent.start_date);
  // Only show if upcoming (not yet started) and within 3 weeks
  if (daysUntil <= 0 || daysUntil > 21) return null;

  const breakName = breakEvent.name ?? "Upcoming Break";
  const label =
    daysUntil === 1
      ? `${breakName} starts tomorrow`
      : `${breakName} is in ${daysUntil} days`;

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
      style={{
        backgroundColor: `${AMBER}08`,
        borderColor: `${AMBER}30`,
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <CalendarBlank
          size={16}
          weight="duotone"
          style={{ color: AMBER, flexShrink: 0 }}
        />
        <p
          className="text-sm font-medium truncate"
          style={{
            fontFamily: "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)",
            color: TEXT_PRIMARY,
          }}
        >
          {label}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpenPlanner}
        className="flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-85 active:scale-95"
        style={{
          backgroundColor: AMBER,
          color: "#fff",
          fontFamily: "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)",
        }}
      >
        Plan it
      </button>
    </div>
  );
}

// ---- Main component ------------------------------------------------------

export function FamilyFeed({ portalId, portalSlug }: FamilyFeedProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>("today");
  const [activeKidIds, setActiveKidIds] = useState<string[]>([]);
  const [activeGenericFilters, setActiveGenericFilters] = useState<GenericFilter[]>([]);
  const [activePlannerBreak, setActivePlannerBreak] = useState<SchoolCalendarEvent | null>(null);

  // Read initial tab from URL param — used by deep links.
  // Only applies on first mount; tab state is purely client-side after that.
  // Old "weekend" and "calendar" deep links are redirected to their merged homes.
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (!tabParam) return;
    const redirectTarget = TAB_REDIRECTS[tabParam];
    if (redirectTarget) {
      setActiveTab(redirectTarget);
    } else if (VALID_TABS.has(tabParam as TabId)) {
      setActiveTab(tabParam as TabId);
    }
  }, [searchParams]);

  const { user, loading: authLoading } = useAuth();
  const { data: kids = [] } = useKidProfiles();

  const handleToggleKid = useCallback((id: string) => {
    setActiveKidIds((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );
  }, []);

  const handleToggleGeneric = useCallback((filter: GenericFilter) => {
    setActiveGenericFilters((prev) =>
      prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]
    );
  }, []);

  const handleOpenPlanner = useCallback((breakEvent: SchoolCalendarEvent) => {
    setActivePlannerBreak(breakEvent);
  }, []);

  const handleClosePlanner = useCallback(() => {
    setActivePlannerBreak(null);
  }, []);

  // Fetch school calendar — shared queryKey with TodayView so it hits the cache.
  const { data: calendarEvents = [] } = useQuery({
    queryKey: ["family-school-calendar"],
    queryFn: fetchSchoolCalendar,
    staleTime: 5 * 60 * 1000,
  });

  // Next upcoming break within 21 days (dynamic, not hardcoded).
  const nextBreak = useMemo(() => findNextBreak(calendarEvents), [calendarEvents]);

  // Show the full SpringBreakBanner when the break is within 21 days OR ongoing.
  // SpringBreakBanner handles the ongoing check internally via its props.
  const showBreakBanner = nextBreak !== null;

  // ---- Planner view — replaces main content when a break is selected -------
  if (activePlannerBreak !== null) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: CANVAS }}>
        {/* Mobile: planner takes full screen */}
        <div className="sm:hidden pb-20">
          <BreakPlanner
            portalId={portalId}
            portalSlug={portalSlug}
            breakEvent={activePlannerBreak}
            onClose={handleClosePlanner}
          />
        </div>
        <div className="sm:hidden">
          <MobileBottomTabBar activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); setActivePlannerBreak(null); }} />
        </div>

        {/* Desktop: sidebar stays, planner in main */}
        <div className="hidden sm:flex gap-0 max-w-7xl mx-auto px-6 pt-6 pb-12 items-start">
          <aside
            className="w-56 flex-shrink-0 sticky top-6 self-start rounded-2xl border p-5"
            style={{ backgroundColor: CARD_SURFACE, borderColor: BORDER }}
          >
            <div className="mb-6 px-1">
              <p className="text-lg font-bold leading-tight" style={{ fontFamily: "var(--font-plus-jakarta-sans, system-ui, sans-serif)", fontWeight: 700, color: TEXT_PRIMARY }}>
                Lost Youth
              </p>
              <p className="text-xs mt-0.5" style={{ fontFamily: "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)", fontStyle: "italic", color: TEXT_SECONDARY }}>
                play hooky
              </p>
            </div>
            <nav className="space-y-0.5">
              {NAV_ITEMS.map((item) => (
                <SidebarNavItem
                  key={item.id}
                  item={item}
                  isActive={false}
                  onClick={() => { setActiveTab(item.id); setActivePlannerBreak(null); }}
                />
              ))}
            </nav>
          </aside>
          <main className="flex-1 min-w-0 pl-8 rounded-2xl border overflow-hidden" style={{ borderColor: BORDER }}>
            <BreakPlanner
              portalId={portalId}
              portalSlug={portalSlug}
              breakEvent={activePlannerBreak}
              onClose={handleClosePlanner}
            />
          </main>
        </div>
      </div>
    );
  }

  // ---- Render ----------------------------------------------------------------
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: CANVAS }}
    >
      {/* Spring Break banner — spans full width on both mobile and desktop */}
      {showBreakBanner && (
        <div className="px-4 pt-4 sm:px-6">
          <SpringBreakBanner
            portalSlug={portalSlug}
            onOpenPlanner={handleOpenPlanner}
          />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MOBILE layout (< sm): bottom tab bar + content                      */}
      {/* ------------------------------------------------------------------ */}

      {/* Mobile content — pb-20 to clear fixed bottom tab bar */}
      <div className="sm:hidden pb-20">
        {/* Break countdown CTA (shown in Today view when banner is not shown but break is close) */}
        {!showBreakBanner && nextBreak !== null && activeTab === "today" && (
          <div className="px-4 pt-3">
            <BreakCountdownCTA
              breakEvent={nextBreak}
              onOpenPlanner={() => handleOpenPlanner(nextBreak)}
            />
          </div>
        )}

        {/* Kid filter chips — shown in content area for mobile when kids exist */}
        {(activeTab === "today" || activeTab === "programs") && (
          <div className="px-4 pt-3 pb-1">
            <KidFilterChips
              kids={kids}
              activeKidIds={activeKidIds}
              onToggleKid={handleToggleKid}
              activeGenericFilters={activeGenericFilters}
              onToggleGeneric={handleToggleGeneric}
              showGenericFilters={activeTab !== "programs"}
            />
          </div>
        )}

        {activeTab === "today" && (
          <TodayView portalId={portalId} portalSlug={portalSlug} activeKidIds={activeKidIds} kids={kids} activeGenericFilters={activeGenericFilters} />
        )}
        {activeTab === "programs" && (
          <ProgramsWithCalendar portalId={portalId} portalSlug={portalSlug} activeKidIds={activeKidIds} kids={kids} activeGenericFilters={activeGenericFilters} />
        )}
        {activeTab === "crew" && <CrewPanel kids={kids} isAuthenticated={!!user} authLoading={authLoading} portalSlug={portalSlug} />}
      </div>

      {/* Mobile bottom tab bar */}
      <div className="sm:hidden">
        <MobileBottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* DESKTOP layout (>= sm): sidebar + main content                      */}
      {/* ------------------------------------------------------------------ */}

      <div className="hidden sm:flex gap-0 max-w-7xl mx-auto px-6 pt-6 pb-12 items-start">

        {/* Sidebar */}
        <aside
          className="w-56 flex-shrink-0 sticky top-6 self-start rounded-2xl border p-5"
          style={{
            backgroundColor: CARD_SURFACE,
            borderColor: BORDER,
          }}
        >
          {/* Portal branding */}
          <div className="mb-6 px-1">
            <p
              className="text-lg font-bold leading-tight"
              style={{ fontFamily: "var(--font-plus-jakarta-sans, system-ui, sans-serif)", fontWeight: 700, color: TEXT_PRIMARY }}
            >
              Lost Youth
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ fontFamily: "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)", fontStyle: "italic", color: TEXT_SECONDARY }}
            >
              play hooky
            </p>
          </div>

          {/* Nav links */}
          <nav className="space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <SidebarNavItem
                key={item.id}
                item={item}
                isActive={activeTab === item.id}
                onClick={() => setActiveTab(item.id)}
              />
            ))}
          </nav>

          {/* Kid profiles / crew section */}
          <SidebarKidProfiles
            kids={kids}
            activeKidIds={activeKidIds}
            onToggleKid={handleToggleKid}
            onOpenCrew={() => setActiveTab("crew")}
            isAuthenticated={!!user}
            redirectPath={typeof window !== "undefined" ? window.location.pathname : `/${portalSlug}`}
          />
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 pl-8">
          {/* Break countdown CTA in desktop main area (Today tab) */}
          {!showBreakBanner && nextBreak !== null && activeTab === "today" && (
            <div className="mb-4">
              <BreakCountdownCTA
                breakEvent={nextBreak}
                onOpenPlanner={() => handleOpenPlanner(nextBreak)}
              />
            </div>
          )}

          {activeTab === "today" && (
            <TodayView
              portalId={portalId}
              portalSlug={portalSlug}
              activeKidIds={activeKidIds}
              kids={kids}
              activeGenericFilters={activeGenericFilters}
              desktopLayout
            />
          )}
          {activeTab === "programs" && (
            <ProgramsWithCalendar
              portalId={portalId}
              portalSlug={portalSlug}
              activeKidIds={activeKidIds}
              kids={kids}
              activeGenericFilters={activeGenericFilters}
            />
          )}
          {activeTab === "crew" && <CrewPanel kids={kids} isAuthenticated={!!user} authLoading={authLoading} portalSlug={portalSlug} />}
        </main>
      </div>
    </div>
  );
}

export default FamilyFeed;
