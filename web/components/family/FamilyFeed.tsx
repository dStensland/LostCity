"use client";

import { useState } from "react";
import { TodayView } from "./TodayView";
import { WeekendPlanner } from "./WeekendPlanner";
import { ProgramsBrowser } from "./ProgramsBrowser";
import { CalendarView } from "./CalendarView";
import { PlansView } from "./PlansView";

// Tab definition
type TabId = "today" | "weekend" | "programs" | "calendar" | "plans";

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: "today", label: "Today" },
  { id: "weekend", label: "Weekend" },
  { id: "programs", label: "Programs" },
  { id: "calendar", label: "Calendar" },
  { id: "plans", label: "Plans" },
];

interface FamilyFeedProps {
  portalId: string;
  portalSlug: string;
  portalExclusive?: boolean;
}

export function FamilyFeed({ portalId, portalSlug }: FamilyFeedProps) {
  const [activeTab, setActiveTab] = useState<TabId>("today");

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--background, #F3EEE8)" }}
    >
      {/* Tab bar — sticky, horizontal scrollable on mobile */}
      <div
        className="sticky top-0 z-20 border-b"
        style={{
          backgroundColor: "var(--background, #F3EEE8)",
          borderColor: "var(--twilight, #E8E4DF)",
        }}
      >
        <div className="flex items-end overflow-x-auto scrollbar-hide px-4 gap-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors relative"
                style={{
                  color: isActive ? "var(--coral)" : "var(--soft, #57534E)",
                  fontFamily: "var(--font-outfit, system-ui, sans-serif)",
                }}
              >
                {tab.label}
                {/* Active indicator — honey underline */}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                    style={{ backgroundColor: "var(--coral)" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "today" && (
        <TodayView portalId={portalId} portalSlug={portalSlug} />
      )}
      {activeTab === "weekend" && (
        <WeekendPlanner portalId={portalId} portalSlug={portalSlug} />
      )}
      {activeTab === "programs" && (
        <ProgramsBrowser portalSlug={portalSlug} />
      )}
      {activeTab === "calendar" && (
        <CalendarView portalSlug={portalSlug} />
      )}
      {activeTab === "plans" && (
        <PlansView portalSlug={portalSlug} />
      )}
    </div>
  );
}

export default FamilyFeed;
