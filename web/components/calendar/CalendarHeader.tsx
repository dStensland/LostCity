"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "@/components/SmartImage";
import { format } from "date-fns";
import { useCalendar } from "@/lib/calendar/CalendarProvider";
import CalendarViewToggle from "@/components/calendar/CalendarViewToggle";
import { DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";
import { STATUS_FILTER_OPTIONS } from "@/lib/types/calendar";
import type { CalendarSummary, Friend } from "@/lib/types/calendar";
import { buildExploreUrl } from "@/lib/find-url";

interface CalendarHeaderProps {
  summary?: CalendarSummary;
  friends: Friend[];
  feedUrls: { feedUrl: string; googleCalendarUrl: string; outlookUrl: string } | null;
  isLoading?: boolean;
}

export function CalendarHeader({ summary, friends, feedUrls, isLoading }: CalendarHeaderProps) {
  const { state, dispatch, setView, setStatusFilter } = useCalendar();
  const {
    currentView,
    statusFilter,
    friendsPanelOpen,
    selectedFriendIds,
    selectedDate,
    syncMenuOpen,
  } = state;

  const [copied, setCopied] = useState(false);
  const portalSlug = DEFAULT_PORTAL_SLUG;

  const copyFeedUrl = async () => {
    if (feedUrls?.feedUrl) {
      await navigator.clipboard.writeText(feedUrls.feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <section className="rounded-2xl border border-[var(--twilight)]/85 bg-gradient-to-b from-[var(--night)]/94 to-[var(--void)]/86 shadow-[0_14px_30px_rgba(0,0,0,0.24)] backdrop-blur-md p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h1 className="font-mono text-3xl font-bold text-[var(--cream)]">My Calendar</h1>
            <p className="mt-1 font-mono text-sm text-[var(--muted)]">
              RSVPs, friend overlap, and quick planning in one place
            </p>
          </div>
          {summary && (
            <div className={`flex flex-wrap items-center gap-2 ${isLoading ? "opacity-50 transition-opacity" : ""}`}>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--twilight)]/70 bg-[var(--void)]/72 font-mono text-xs text-[var(--soft)]">
                <span className="text-[var(--cream)] font-semibold">{summary.total}</span>
                total
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--coral)]/35 bg-[var(--coral)]/15 font-mono text-xs text-[var(--coral)]">
                {summary.going} going
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--gold)]/35 bg-[var(--gold)]/15 font-mono text-xs text-[var(--gold)]">
                {summary.interested} interested
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--neon-cyan)]/35 bg-[var(--neon-cyan)]/12 font-mono text-xs text-[var(--neon-cyan)]">
                {summary.plans} {summary.plans === 1 ? "plan" : "plans"}
              </span>
            </div>
          )}
        </div>

        <div className="mt-3.5 pt-3.5 border-t border-[var(--twilight)]/65 space-y-3">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <CalendarViewToggle currentView={currentView} onViewChange={setView} />
              <div className="flex rounded-full bg-[var(--void)]/70 border border-[var(--twilight)]/80 p-0.5">
                {STATUS_FILTER_OPTIONS.map((option) => {
                  const isActive = statusFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setStatusFilter(option.value)}
                      className={`px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all ${
                        isActive
                          ? "bg-[var(--cream)] text-[var(--void)] shadow-[0_6px_16px_rgba(0,0,0,0.2)]"
                          : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/45"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => dispatch({ type: "TOGGLE_FRIENDS_PANEL" })}
                className={`inline-flex items-center gap-2 px-3 py-2 border rounded-lg font-mono text-xs transition-colors ${
                  selectedFriendIds.size > 0
                    ? "bg-[var(--vibe)]/15 border-[var(--vibe)]/50 text-[var(--vibe)]"
                    : "bg-[var(--void)]/65 border-[var(--twilight)]/75 text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/45"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Friends
                {selectedFriendIds.size > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[var(--vibe)] text-[var(--void)] text-2xs font-bold">
                    {selectedFriendIds.size}
                  </span>
                )}
              </button>

              <div className="relative">
                <button
                  onClick={() => dispatch({ type: "TOGGLE_SYNC_MENU" })}
                  disabled={!feedUrls}
                  className={`inline-flex items-center gap-2 px-3 py-2 bg-[var(--void)]/65 border border-[var(--twilight)]/75 rounded-lg font-mono text-xs text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/45 transition-colors ${!feedUrls ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync
                </button>

                {syncMenuOpen && feedUrls && (
                  <div className="absolute right-0 mt-2 w-64 bg-[var(--night)] border border-[var(--twilight)] rounded-lg shadow-2xl shadow-black/50 z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--twilight)]/70">
                      <p className="font-mono text-xs text-[var(--muted)]">Subscribe to your calendar</p>
                    </div>

                    <a
                      href={feedUrls.googleCalendarUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => dispatch({ type: "TOGGLE_SYNC_MENU" })}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--soft)] hover:bg-[var(--twilight)]/60 hover:text-[var(--cream)] transition-colors"
                    >
                      <svg className="w-5 h-5 text-[#4285F4]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-11v6h2v-6h-2zm0-4v2h2V7h-2z" />
                      </svg>
                      Google Calendar
                    </a>

                    <a
                      href={feedUrls.outlookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => dispatch({ type: "TOGGLE_SYNC_MENU" })}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--soft)] hover:bg-[var(--twilight)]/60 hover:text-[var(--cream)] transition-colors"
                    >
                      <svg className="w-5 h-5 text-[#0078D4]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.01V2.55q0-.44.3-.75.3-.3.75-.3h6.93q.44 0 .75.3.3.3.3.75V6h6.97q.3 0 .57.12.26.12.45.32.19.2.31.47.12.26.12.57z" />
                      </svg>
                      Outlook
                    </a>

                    <button
                      onClick={() => {
                        copyFeedUrl();
                        dispatch({ type: "TOGGLE_SYNC_MENU" });
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--soft)] hover:bg-[var(--twilight)]/60 hover:text-[var(--cream)] transition-colors text-left"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {copied ? "Copied!" : "Copy iCal URL"}
                    </button>
                  </div>
                )}
              </div>

              <Link
                href={buildExploreUrl({
                  portalSlug,
                  lane: "events",
                  extraParams: {
                    display: "calendar",
                    ...(selectedDate ? { date: format(selectedDate, "yyyy-MM-dd") } : {}),
                  },
                })}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--twilight)]/75 bg-[var(--void)]/65 text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/45 font-mono text-xs transition-colors"
              >
                Find Calendar
              </Link>
            </div>
          </div>
        </div>
      </section>

      {friendsPanelOpen && (
        <section className="p-4 rounded-2xl border border-[var(--twilight)]/80 bg-[var(--void)]/60">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-mono text-sm font-medium text-[var(--cream)]">Overlay friends&apos; plans</h3>
            {selectedFriendIds.size > 0 && (
              <button
                onClick={() => dispatch({ type: "CLEAR_FRIENDS" })}
                className="font-mono text-xs text-[var(--muted)] hover:text-[var(--coral)] transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          {friends.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {friends.map((friend) => {
                const isSelected = selectedFriendIds.has(friend.id);
                return (
                  <button
                    key={friend.id}
                    onClick={() => dispatch({ type: "TOGGLE_FRIEND", friendId: friend.id })}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-xs transition-colors border ${
                      isSelected
                        ? "bg-[var(--vibe)] text-[var(--void)] border-[var(--vibe)]"
                        : "bg-[var(--twilight)]/45 text-[var(--soft)] border-[var(--twilight)]/70 hover:bg-[var(--twilight)]/70"
                    }`}
                  >
                    {friend.avatar_url ? (
                      <Image
                        src={friend.avatar_url}
                        alt=""
                        width={18}
                        height={18}
                        className="w-[18px] h-[18px] rounded-full object-cover"
                      />
                    ) : (
                      <span className="w-[18px] h-[18px] rounded-full bg-[var(--dusk)] flex items-center justify-center text-2xs">
                        {(friend.display_name || friend.username)[0].toUpperCase()}
                      </span>
                    )}
                    {friend.display_name || friend.username}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-[var(--muted)] font-mono text-xs">
              No friends yet. Follow people who follow you back to see their plans.
            </p>
          )}
        </section>
      )}
    </>
  );
}

export type { CalendarHeaderProps };
