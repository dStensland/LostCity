"use client";

import Link from "next/link";
import { DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";
import { useCalendar } from "@/lib/calendar/CalendarProvider";
import { buildExploreUrl } from "@/lib/find-url";

export function EmptyState() {
  const { openSheet } = useCalendar();

  return (
    <div className="text-center py-12 px-6">
      {/* Calendar icon illustration */}
      <div className="flex justify-center mb-6">
        <svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Outer calendar body */}
          <rect
            x="10"
            y="18"
            width="60"
            height="52"
            rx="8"
            stroke="var(--twilight)"
            strokeWidth="2"
            fill="var(--night)"
          />
          {/* Header band */}
          <rect
            x="10"
            y="18"
            width="60"
            height="16"
            rx="8"
            fill="var(--dusk)"
          />
          <rect x="10" y="26" width="60" height="8" fill="var(--dusk)" />
          {/* Date binding pegs */}
          <rect x="25" y="12" width="4" height="12" rx="2" fill="var(--twilight)" />
          <rect x="51" y="12" width="4" height="12" rx="2" fill="var(--twilight)" />
          {/* Grid dots — three rows */}
          <circle cx="27" cy="46" r="3" fill="var(--coral)" />
          <circle cx="40" cy="46" r="3" fill="var(--twilight)" />
          <circle cx="53" cy="46" r="3" fill="var(--twilight)" />
          <circle cx="27" cy="58" r="3" fill="var(--twilight)" />
          <circle cx="40" cy="58" r="3" fill="var(--gold)" />
          <circle cx="53" cy="58" r="3" fill="var(--twilight)" />
          <circle cx="27" cy="70" r="3" fill="var(--twilight)" />
          <circle cx="40" cy="70" r="3" fill="var(--twilight)" />
          <circle cx="53" cy="70" r="3" fill="var(--neon-cyan)" />
          {/* Horizontal grid lines */}
          <line x1="18" y1="52" x2="62" y2="52" stroke="var(--twilight)" strokeWidth="1" strokeOpacity="0.5" />
          <line x1="18" y1="64" x2="62" y2="64" stroke="var(--twilight)" strokeWidth="1" strokeOpacity="0.5" />
        </svg>
      </div>

      <h2 className="text-xl font-semibold text-[var(--cream)] mb-2">
        Your calendar is empty
      </h2>
      <p className="text-sm text-[var(--soft)] max-w-sm mx-auto mb-8">
        RSVP to events you want to attend, and they&apos;ll show up here. Create
        plans with friends to coordinate your outings.
      </p>

      <div className="flex flex-col items-center gap-4 mb-10">
        <button
          onClick={() => openSheet({ sheet: "create-plan" })}
          className="bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm rounded-lg px-5 py-2.5 hover:bg-[var(--twilight)] transition-colors"
        >
          Create a Plan
        </button>
      </div>

      {/* How it works */}
      <div className="max-w-xs mx-auto text-left">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-3">
          HOW IT WORKS
        </p>
        <ul className="space-y-3">
          <li className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[var(--coral)] flex-shrink-0" />
            <span className="text-sm text-[var(--soft)]">
              RSVP to events you find interesting
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[var(--neon-cyan)] flex-shrink-0" />
            <span className="text-sm text-[var(--soft)]">
              Create plans and invite friends
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[var(--gold)] flex-shrink-0" />
            <span className="text-sm text-[var(--soft)]">
              See friend overlap and open time
            </span>
          </li>
        </ul>
      </div>

      <div className="mt-8">
        <Link
          href={buildExploreUrl({ portalSlug: DEFAULT_PORTAL_SLUG, lane: "events" })}
          className="inline-block bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium rounded-lg px-6 py-2.5 hover:opacity-90 transition-opacity"
        >
          Browse Events
        </Link>
      </div>
    </div>
  );
}
