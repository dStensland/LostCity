"use client";

import Link from "next/link";
import {
  Bank,
  UsersThree,
  CalendarCheck,
  ArrowRight,
  CalendarDots,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";

type QuickLink = {
  label: string;
  icon: string;
  href: string;
  accent_color: string;
};

interface CivicHeroProps {
  portalSlug: string;
  portalName: string;
  quickLinks: QuickLink[];
  dayOfWeek: string;
  /** Event counts from timeline tabs */
  tabCounts?: { today: number; this_week: number; coming_up: number } | null;
}

const ICON_MAP: Record<string, ComponentType<{ size: number; weight: "duotone" | "bold" }>> = {
  Bank,
  UsersThree,
  CalendarCheck,
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function CivicHero({
  portalSlug,
  portalName,
  quickLinks,
  dayOfWeek,
  tabCounts,
}: CivicHeroProps) {
  const greeting = getGreeting();
  const dateStr = getFormattedDate();
  const todayCount = tabCounts?.today ?? 0;
  const weekCount = tabCounts?.this_week ?? 0;

  return (
    <section className="civic-hero relative mt-1">
      {/* Green civic accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] rounded-full"
        style={{
          background: "linear-gradient(90deg, var(--action-primary) 0%, var(--action-primary) 40%, transparent 100%)",
        }}
      />

      <div className="pt-6 pb-2">
        {/* Dateline + greeting */}
        <div className="mb-5">
          <p className="font-mono text-2xs font-medium tracking-[0.14em] uppercase text-[var(--muted)]">
            {dateStr}
          </p>
          <h1 className="civic-hero-heading mt-1.5 text-2xl sm:text-3xl font-semibold text-[var(--cream)] leading-tight">
            {greeting}.
          </h1>
          {(todayCount > 0 || weekCount > 0) && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--soft)]">
              <CalendarDots weight="bold" className="w-3.5 h-3.5 text-[var(--action-primary)]" />
              <span>
                {todayCount > 0 && (
                  <span className="font-semibold text-[var(--cream)]">{todayCount}</span>
                )}
                {todayCount > 0 && " today"}
                {todayCount > 0 && weekCount > 0 && <span className="text-[var(--muted)]"> · </span>}
                {weekCount > 0 && (
                  <>
                    <span className="font-semibold text-[var(--cream)]">{weekCount}</span>
                    {" this week"}
                  </>
                )}
              </span>
            </p>
          )}
        </div>

        {/* Quick links — elevated action cards */}
        {quickLinks.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {quickLinks.map((link) => {
              const IconComponent = ICON_MAP[link.icon];
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="civic-quick-link group relative flex items-center gap-3 rounded-xl border border-[var(--twilight)] bg-[var(--night)] px-3.5 py-3 transition-all duration-200 hover:border-[var(--action-primary)]/40 hover:shadow-sm"
                >
                  {/* Icon */}
                  {IconComponent && (
                    <span
                      className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg transition-colors duration-200"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${link.accent_color} 12%, transparent)`,
                        color: link.accent_color,
                      }}
                    >
                      <IconComponent size={18} weight="duotone" />
                    </span>
                  )}

                  {/* Label + arrow */}
                  <span className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-[var(--cream)] group-hover:text-[var(--action-primary)] transition-colors">
                      {link.label}
                    </span>
                  </span>

                  <ArrowRight
                    weight="bold"
                    className="w-3.5 h-3.5 shrink-0 text-[var(--muted)] opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all duration-200"
                  />
                </Link>
              );
            })}
          </div>
        )}

        {/* Browse all link */}
        <div className="mt-3 flex items-center justify-end">
          <Link
            href={`/${portalSlug}/groups`}
            className="flex items-center gap-1 text-xs font-medium text-[var(--action-primary)] hover:opacity-80 transition-opacity"
          >
            All Groups
            <ArrowRight weight="bold" className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}
