"use client";

import { Component, useState, useEffect, startTransition } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useSearchParams } from "next/navigation";
import { Mountains, Compass, Calendar, CloudSun, BookOpen, ArrowClockwise } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { ExploreView } from "./ExploreView";
import { ADV, ADV_FONT } from "@/lib/adventure-tokens";

const QuestsView = dynamic(
  () => import("./QuestsView").then((m) => ({ default: m.QuestsView })),
  { ssr: false, loading: () => <TabSkeleton /> },
);
const WeekendView = dynamic(
  () => import("./WeekendView").then((m) => ({ default: m.WeekendView })),
  { ssr: false, loading: () => <TabSkeleton /> },
);
const ConditionsView = dynamic(
  () => import("./ConditionsView").then((m) => ({ default: m.ConditionsView })),
  { ssr: false, loading: () => <TabSkeleton /> },
);
const OutThereLog = dynamic(
  () => import("./OutThereLog").then((m) => ({ default: m.OutThereLog })),
  { ssr: false, loading: () => <TabSkeleton /> },
);

function TabSkeleton() {
  return (
    <div className="px-4 pb-10 pt-4 sm:px-0 space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-24"
          style={{
            border: `2px solid ${ADV.DARK}`,
            borderRadius: 0,
            backgroundColor: `${ADV.STONE}12`,
          }}
        />
      ))}
    </div>
  );
}

// ---- Error boundary per tab -----------------------------------------------

class TabErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AdventureTab]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="px-4 pb-10 pt-4 sm:px-0">
          <div
            className="p-6"
            style={{
              border: `2px solid ${ADV.DARK}`,
              borderLeft: `4px solid ${ADV.TERRACOTTA}`,
              borderRadius: 0,
              backgroundColor: ADV.CARD,
            }}
          >
            <p
              className="text-sm font-bold uppercase mb-2"
              style={{ letterSpacing: "0.1em", color: ADV.DARK }}
            >
              Something went wrong
            </p>
            <p className="text-sm mb-3" style={{ color: ADV.STONE }}>
              This tab hit an error. Try reloading.
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase transition-colors"
              style={{
                letterSpacing: "0.1em",
                border: `2px solid ${ADV.DARK}`,
                borderRadius: 0,
                color: ADV.TERRACOTTA,
              }}
            >
              <ArrowClockwise size={12} weight="bold" />
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---- Types ---------------------------------------------------------------

export interface AdventureFeedProps {
  portalId: string;
  portalSlug: string;
}

type TabId = "explore" | "quests" | "weekend" | "conditions" | "log";

interface NavItem {
  id: TabId;
  label: string;
  Icon: typeof Mountains;
}

const NAV_ITEMS: NavItem[] = [
  { id: "explore",    label: "Explore",    Icon: Mountains },
  { id: "quests",     label: "Quests",     Icon: Compass },
  { id: "weekend",    label: "Weekend",    Icon: Calendar },
  { id: "conditions", label: "Conditions", Icon: CloudSun },
  { id: "log",        label: "Log",        Icon: BookOpen },
];

const VALID_TABS = new Set<TabId>(["explore", "quests", "weekend", "conditions", "log"]);

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
  const { Icon } = item;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-left transition-colors"
      style={{
        borderRadius: 0,
        borderLeft: isActive ? `3px solid ${ADV.TERRACOTTA}` : `3px solid transparent`,
        backgroundColor: isActive ? `${ADV.TERRACOTTA}10` : "transparent",
        color: isActive ? ADV.TERRACOTTA : ADV.STONE,
        letterSpacing: "0.02em",
      }}
    >
      <Icon
        size={16}
        weight={isActive ? "bold" : "regular"}
        color={isActive ? ADV.TERRACOTTA : ADV.STONE}
      />
      {item.label}
    </button>
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
      className="fixed bottom-0 left-0 right-0 z-20 border-t-2"
      style={{
        backgroundColor: ADV.CARD,
        borderColor: ADV.DARK,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        height: "calc(52px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="flex justify-around items-center h-[52px] px-1">
        {NAV_ITEMS.map((tab) => {
          const isActive = activeTab === tab.id;
          const { Icon } = tab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className="flex items-center justify-center flex-1 h-full"
              aria-current={isActive ? "page" : undefined}
            >
              {isActive ? (
                <span
                  className="px-3 py-1.5 font-bold text-white flex items-center gap-1.5"
                  style={{
                    backgroundColor: ADV.TERRACOTTA,
                    borderRadius: 0,
                    fontSize: "10px",
                    letterSpacing: "0.08em",
                  }}
                >
                  <Icon size={11} weight="bold" />
                  {tab.label.toUpperCase()}
                </span>
              ) : (
                <span
                  className="font-bold flex items-center gap-1"
                  style={{
                    color: ADV.STONE,
                    fontSize: "10px",
                    letterSpacing: "0.08em",
                  }}
                >
                  <Icon size={12} weight="regular" />
                  {tab.label.toUpperCase()}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Tab content dispatcher ----------------------------------------------

function TabContent({
  activeTab,
  portalSlug,
}: {
  activeTab: TabId;
  portalSlug: string;
}) {
  let content: ReactNode;
  switch (activeTab) {
    case "explore":
      content = <ExploreView portalSlug={portalSlug} />;
      break;
    case "quests":
      content = <QuestsView portalSlug={portalSlug} />;
      break;
    case "weekend":
      content = <WeekendView portalSlug={portalSlug} />;
      break;
    case "conditions":
      content = <ConditionsView portalSlug={portalSlug} />;
      break;
    case "log":
      content = <OutThereLog portalSlug={portalSlug} />;
      break;
    default:
      return null;
  }
  return <TabErrorBoundary key={activeTab}>{content}</TabErrorBoundary>;
}

// ---- Main component ------------------------------------------------------

export function AdventureFeed({ portalSlug }: AdventureFeedProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>("explore");

  // Read initial tab from URL param — supports deep links and CTA navigation.
  // startTransition defers the state update to avoid blocking the initial render.
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && VALID_TABS.has(tabParam as TabId)) {
      startTransition(() => {
        setActiveTab(tabParam as TabId);
      });
    }
  }, [searchParams]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    // Shallow URL update for deep-link support (no navigation cycle)
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: ADV.CREAM, fontFamily: ADV_FONT }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* MOBILE layout (< sm): bottom tab bar + content                      */}
      {/* ------------------------------------------------------------------ */}

      <div className="sm:hidden pb-20">
        <TabContent activeTab={activeTab} portalSlug={portalSlug} />
      </div>

      <div className="sm:hidden">
        <MobileBottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* DESKTOP layout (>= sm): sidebar + main content                      */}
      {/* ------------------------------------------------------------------ */}

      <div className="hidden sm:flex gap-0 max-w-7xl mx-auto px-6 pt-6 pb-12 items-start">

        {/* Sidebar */}
        <aside
          className="w-52 flex-shrink-0 sticky top-6 self-start"
          style={{
            border: `2px solid ${ADV.DARK}`,
            borderRadius: 0,
            backgroundColor: ADV.CARD,
          }}
        >
          {/* Portal branding */}
          <div
            className="px-4 py-5 border-b-2"
            style={{ borderBottomColor: ADV.DARK }}
          >
            <p
              className="font-bold leading-tight"
              style={{
                fontSize: "1.125rem",
                color: ADV.DARK,
                letterSpacing: "-0.01em",
              }}
            >
              Lost Track
            </p>
            <p
              className="text-xs mt-0.5"
              style={{
                fontStyle: "italic",
                color: ADV.STONE,
              }}
            >
              wander over yonder
            </p>
          </div>

          {/* Nav links */}
          <nav className="py-2">
            {NAV_ITEMS.map((item) => (
              <SidebarNavItem
                key={item.id}
                item={item}
                isActive={activeTab === item.id}
                onClick={() => handleTabChange(item.id)}
              />
            ))}
          </nav>

          {/* Commitment tier legend */}
          <div
            className="px-4 py-4 border-t-2"
            style={{ borderTopColor: `${ADV.DARK}20` }}
          >
            <p
              className="text-xs font-bold uppercase mb-2"
              style={{
                letterSpacing: "0.1em",
                color: ADV.STONE,
              }}
            >
              Time Commitment
            </p>
            {[
              { label: "1 HR", desc: "Quick urban hit" },
              { label: "HALF DAY", desc: "3–5 hours out" },
              { label: "FULL DAY", desc: "All-in destination" },
              { label: "WEEKEND", desc: "Overnight escape" },
            ].map(({ label, desc }) => (
              <div key={label} className="flex items-baseline gap-2 mb-1">
                <span
                  className="text-xs font-bold flex-shrink-0"
                  style={{
                    letterSpacing: "0.08em",
                    color: ADV.TERRACOTTA,
                  }}
                >
                  {label}
                </span>
                <span className="text-xs" style={{ color: `${ADV.STONE}90` }}>
                  {desc}
                </span>
              </div>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 pl-8">
          <TabContent activeTab={activeTab} portalSlug={portalSlug} />
        </main>
      </div>
    </div>
  );
}
