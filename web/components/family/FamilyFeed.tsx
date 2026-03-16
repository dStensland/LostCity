"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Users } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";
import { TodayView } from "./TodayView";
import { WeekendPlanner } from "./WeekendPlanner";
import { ProgramsBrowser } from "./ProgramsBrowser";
import { CalendarView } from "./CalendarView";
import { CrewSetup } from "./CrewSetup";
import { SpringBreakBanner } from "./SpringBreakBanner";
import { KidFilterChips, type GenericFilter } from "./KidFilterChips";
import { useKidProfiles } from "@/lib/hooks/useKidProfiles";
import type { KidProfile } from "@/lib/types/kid-profiles";

// ---- Palette (Afternoon Field) -------------------------------------------
const CANVAS = "#F0EDE4";
const CARD_SURFACE = "#FAFAF6";
const SAGE = "#5E7A5E";
const AMBER = "#C48B1D";
const TEXT_PRIMARY = "#1E2820";
const TEXT_SECONDARY = "#756E63";
const BORDER = "#E0DDD4";

// ---- Types ---------------------------------------------------------------

type TabId = "today" | "weekend" | "programs" | "calendar" | "crew";

interface NavItem {
  id: TabId;
  label: string;
  href?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "today",    label: "Today" },
  { id: "weekend",  label: "Weekend" },
  { id: "programs", label: "Programs" },
  { id: "calendar", label: "Calendar" },
  { id: "crew",     label: "My Crew" },
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
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left relative"
      style={{
        fontFamily: "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)",
        color: isActive ? SAGE : TEXT_SECONDARY,
        backgroundColor: isActive ? `${SAGE}22` : "transparent",
        borderLeft: isActive ? `4px solid ${AMBER}` : "4px solid transparent",
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

function CrewPanel({ kids, isAuthenticated, portalSlug }: { kids: KidProfile[]; isAuthenticated: boolean; portalSlug: string }) {
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
          {isAuthenticated ? (
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
      <div className="flex justify-around items-center h-[52px] px-1">
        {NAV_ITEMS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex items-center justify-center flex-1 h-full"
              aria-current={isActive ? "page" : undefined}
            >
              {isActive ? (
                <span
                  className="px-3.5 py-1.5 rounded-[20px] text-white font-semibold"
                  style={{
                    backgroundColor: SAGE,
                    fontSize: "10px",
                    letterSpacing: "0.5px",
                    lineHeight: 1.2,
                  }}
                >
                  {tab.label}
                </span>
              ) : (
                <span
                  className="font-semibold"
                  style={{
                    color: TEXT_SECONDARY,
                    fontSize: "10px",
                    letterSpacing: "0.5px",
                    lineHeight: 1.2,
                  }}
                >
                  {tab.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Main component ------------------------------------------------------

const VALID_TABS = new Set<TabId>(["today", "weekend", "programs", "calendar", "crew"]);

export function FamilyFeed({ portalId, portalSlug }: FamilyFeedProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>("today");
  const [activeKidIds, setActiveKidIds] = useState<string[]>([]);
  const [activeGenericFilters, setActiveGenericFilters] = useState<GenericFilter[]>([]);

  // Read initial tab from URL param — used by SpringBreakBanner CTA and deep links.
  // Only applies on first mount; tab state is purely client-side after that.
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && VALID_TABS.has(tabParam as TabId)) {
      setActiveTab(tabParam as TabId);
    }
  }, [searchParams]);

  const { user } = useAuth();
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

  // ---- Render ----------------------------------------------------------------
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: CANVAS }}
    >
      {/* Spring Break banner — spans full width on both mobile and desktop */}
      <div className="px-4 pt-4 sm:px-6">
        <SpringBreakBanner portalSlug={portalSlug} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* MOBILE layout (< sm): bottom tab bar + content                      */}
      {/* ------------------------------------------------------------------ */}

      {/* Mobile content — pb-20 to clear fixed bottom tab bar */}
      <div className="sm:hidden pb-20">
        {/* Kid filter chips — shown in content area for mobile when kids exist */}
        {kids.length > 0 && (activeTab === "today" || activeTab === "weekend" || activeTab === "programs") && (
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
          <TodayView portalId={portalId} portalSlug={portalSlug} activeKidIds={activeKidIds} kids={kids} />
        )}
        {activeTab === "weekend" && (
          <WeekendPlanner portalId={portalId} portalSlug={portalSlug} activeKidIds={activeKidIds} kids={kids} />
        )}
        {activeTab === "programs" && (
          <ProgramsBrowser portalSlug={portalSlug} activeKidIds={activeKidIds} kids={kids} />
        )}
        {activeTab === "calendar" && (
          <CalendarView portalId={portalId} portalSlug={portalSlug} activeKidIds={activeKidIds} kids={kids} />
        )}
        {activeTab === "crew" && <CrewPanel kids={kids} isAuthenticated={!!user} portalSlug={portalSlug} />}
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
          {activeTab === "today" && (
            <TodayView
              portalId={portalId}
              portalSlug={portalSlug}
              activeKidIds={activeKidIds}
              kids={kids}
              desktopLayout
            />
          )}
          {activeTab === "weekend" && (
            <WeekendPlanner
              portalId={portalId}
              portalSlug={portalSlug}
              activeKidIds={activeKidIds}
              kids={kids}
            />
          )}
          {activeTab === "programs" && (
            <ProgramsBrowser
              portalSlug={portalSlug}
              activeKidIds={activeKidIds}
              kids={kids}
            />
          )}
          {activeTab === "calendar" && (
            <CalendarView portalId={portalId} portalSlug={portalSlug} activeKidIds={activeKidIds} kids={kids} />
          )}
          {activeTab === "crew" && <CrewPanel kids={kids} isAuthenticated={!!user} portalSlug={portalSlug} />}
        </main>
      </div>
    </div>
  );
}

export default FamilyFeed;
