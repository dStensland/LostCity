"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

type DashboardTab = "feed" | "activity" | "planning";

interface DashboardShellProps {
  currentTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  children: React.ReactNode;
}

const TABS: { key: DashboardTab; label: string; mobileLabel: string }[] = [
  { key: "feed", label: "Your Scene", mobileLabel: "Feed" },
  { key: "activity", label: "The Scene", mobileLabel: "Activity" },
  { key: "planning", label: "Your Moves", mobileLabel: "Planning" },
];

export default function DashboardShell({
  currentTab,
  onTabChange,
  children,
}: DashboardShellProps) {
  const { user } = useAuth();
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Minimum swipe distance for tab change
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    const currentIndex = TABS.findIndex((t) => t.key === currentTab);

    if (isLeftSwipe && currentIndex < TABS.length - 1) {
      onTabChange(TABS[currentIndex + 1].key);
    } else if (isRightSwipe && currentIndex > 0) {
      onTabChange(TABS[currentIndex - 1].key);
    }
  }, [touchStart, touchEnd, currentTab, onTabChange]);

  useEffect(() => {
    if (touchStart !== null && touchEnd !== null) {
      onTouchEnd();
    }
  }, [touchEnd, touchStart, onTouchEnd]);

  // Pull-to-refresh handler (optional enhancement)
  const [isPulling, setIsPulling] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-[var(--cream)] italic">
            {currentTab === "feed"
              ? "Your scene"
              : currentTab === "activity"
              ? "The scene"
              : "Your moves"}
          </h1>
          {user && (
            <p className="text-[var(--muted)] font-mono text-xs mt-1">
              @{user.user_metadata?.username || "you"}
            </p>
          )}
        </div>

        {/* Notification bell */}
        <Link
          href="/notifications"
          className="relative p-2 text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          {/* Badge - can be made dynamic */}
          <NotificationBadge />
        </Link>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 p-1 bg-[var(--night)] rounded-lg mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex-1 px-4 py-2.5 rounded-md font-mono text-xs font-medium transition-all min-h-[44px] ${
              currentTab === tab.key
                ? "bg-[var(--dusk)] text-[var(--cream)] shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--dusk)]/50"
            }`}
          >
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.mobileLabel}</span>
          </button>
        ))}
      </div>

      {/* Swipe indicator for mobile */}
      <div className="sm:hidden flex justify-center gap-1 mb-4">
        {TABS.map((tab) => (
          <div
            key={tab.key}
            className={`w-2 h-2 rounded-full transition-colors ${
              currentTab === tab.key
                ? "bg-[var(--coral)]"
                : "bg-[var(--twilight)]"
            }`}
          />
        ))}
      </div>

      {/* Content with swipe handling */}
      <div
        ref={contentRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={() => {
          setTouchStart(null);
          setTouchEnd(null);
        }}
        className={`transition-opacity duration-200 ${isPulling ? "opacity-50" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}

function NotificationBadge() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Fetch unread notification count
    async function fetchUnreadCount() {
      try {
        const res = await fetch("/api/notifications?unread=true");
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (error) {
        console.error("Failed to fetch notification count:", error);
      }
    }

    fetchUnreadCount();

    // Refresh every minute
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  if (unreadCount === 0) return null;

  return (
    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--coral)] text-[var(--void)] text-[10px] font-bold">
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  );
}
