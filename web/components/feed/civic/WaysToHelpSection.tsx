"use client";

import Link from "next/link";

interface WaysToHelpProps {
  portalSlug: string;
  volunteerCount: number;
}

export function WaysToHelpSection({ portalSlug, volunteerCount }: WaysToHelpProps) {
  const volunteerBody =
    volunteerCount > 0
      ? `${volunteerCount} drop-in opportunities`
      : "Drop-in opportunities available";

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider opacity-50">
        Ways to Help
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1 — Volunteer */}
        <Link
          href={`/${portalSlug}/happening`}
          className="group block rounded-xl border border-[var(--twilight)]/20 p-5 transition-colors hover:border-[var(--twilight)]/40 overflow-hidden relative"
          style={{ backgroundColor: "var(--card-bg, var(--night))" }}
        >
          {/* Left accent bar — emerald */}
          <span
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
            style={{ backgroundColor: "#10b981" }}
            aria-hidden="true"
          />
          <div className="pl-3">
            <p className="text-base font-semibold text-[var(--cream)] leading-snug">
              Volunteer this week
            </p>
            <p className="mt-1 text-sm text-[var(--soft)]">{volunteerBody}</p>
            <span
              className="mt-4 inline-block text-sm font-medium"
              style={{ color: "#10b981" }}
            >
              See opportunities →
            </span>
          </div>
        </Link>

        {/* Card 2 — Support resources */}
        <Link
          href={`/${portalSlug}/support`}
          className="group block rounded-xl border border-[var(--twilight)]/20 p-5 transition-colors hover:border-[var(--twilight)]/40 overflow-hidden relative"
          style={{ backgroundColor: "var(--card-bg, var(--night))" }}
        >
          {/* Left accent bar — sky */}
          <span
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
            style={{ backgroundColor: "#38bdf8" }}
            aria-hidden="true"
          />
          <div className="pl-3">
            <p className="text-base font-semibold text-[var(--cream)] leading-snug">
              Find support resources
            </p>
            <p className="mt-1 text-sm text-[var(--soft)]">
              Food, housing, legal aid, health, and family support
            </p>
            <span
              className="mt-4 inline-block text-sm font-medium"
              style={{ color: "#38bdf8" }}
            >
              Browse directory →
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}

export type { WaysToHelpProps };
