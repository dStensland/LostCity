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
          className="h-24 animate-pulse"
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

// ---- Top-level cold-load skeleton ----------------------------------------
// Shown on initial mount before the hydrated tab content is ready.

function ColdLoadSkeleton() {
  return (
    <div className="px-4 sm:px-6 pt-4 pb-12 space-y-4 max-w-5xl mx-auto">
      {/* Simulated tab bar */}
      <div
        className="animate-pulse"
        style={{
          height: 62,
          border: `2px solid ${ADV.DARK}`,
          borderRadius: 0,
          backgroundColor: `${ADV.STONE}12`,
        }}
      />
      {/* Simulated content blocks */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            height: i === 0 ? 120 : 80,
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

// ---- Desktop tab bar (full-width) ----------------------------------------
// The wrapper spans full viewport width with a dark bottom border and CARD
// background. The tab buttons themselves are constrained to max-w-5xl so they
// align with the content below.

function DesktopTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  return (
    <div
      className="w-full"
      style={{
        backgroundColor: ADV.CARD,
        borderBottom: `2px solid ${ADV.DARK}`,
      }}
    >
      <div
        className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center"
        style={{ height: 62 }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          const { Icon } = item;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`flex-1 h-full flex items-center justify-center gap-2 font-bold transition-colors${!isActive ? " hover:bg-black/5" : ""}`}
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                borderRadius: 0,
                backgroundColor: isActive ? ADV.DARK : "transparent",
                color: isActive ? ADV.CREAM : ADV.STONE,
              }}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={14} weight={isActive ? "bold" : "regular"} />
              {item.label}
            </button>
          );
        })}
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
                  className="px-3 py-1.5 font-bold flex items-center gap-1.5"
                  style={{
                    backgroundColor: ADV.DARK,
                    color: ADV.CREAM,
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
  // Track whether the component has mounted so we can show a cold-load skeleton
  // during the brief window before hydration completes (avoids blank cream flash).
  const [mounted, setMounted] = useState(false);

   
  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted) {
    return (
      <div
        className="min-h-screen"
        style={{ backgroundColor: ADV.CREAM, fontFamily: ADV_FONT }}
      >
        <ColdLoadSkeleton />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: ADV.CREAM, fontFamily: ADV_FONT }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Desktop tab bar — full-width, above content (hidden on mobile)      */}
      {/* ------------------------------------------------------------------ */}
      <div className="hidden sm:block">
        <DesktopTabBar activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tab content — single render, responsive padding                     */}
      {/* Mobile: full-width with bottom padding for fixed tab bar            */}
      {/* Desktop: constrained to max-w-5xl                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="pb-20 sm:pb-12">
        <div className="sm:max-w-5xl sm:mx-auto sm:px-6 sm:pt-6">
          <TabContent activeTab={activeTab} portalSlug={portalSlug} />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Mobile bottom tab bar (hidden on desktop)                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="sm:hidden">
        <MobileBottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />
      </div>
    </div>
  );
}
