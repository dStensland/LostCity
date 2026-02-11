"use client";

import { useState, useEffect } from "react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import type { MomentsResponse } from "@/lib/moments-utils";

interface TimeContextSectionProps {
  portalSlug: string;
}

/** Icons for contextual sections */
function BrunchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M3 12h18M5 8c0-2.2 1.8-4 4-4h6c2.2 0 4 1.8 4 4v0H5v0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 12v4c0 2.2 1.8 4 4 4h2c2.2 0 4-1.8 4-4v-4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function getSectionIcon(label: string) {
  if (label.includes("Brunch")) return <BrunchIcon className="w-5 h-5" />;
  if (label.includes("Patio")) return <SunIcon className="w-5 h-5" />;
  if (label.includes("After")) return <MoonIcon className="w-5 h-5" />;
  return null;
}

function getSectionAccent(label: string): string {
  if (label.includes("Brunch")) return "var(--neon-amber)";
  if (label.includes("Patio")) return "var(--gold)";
  if (label.includes("After")) return "var(--neon-magenta)";
  return "var(--neon-cyan)";
}

export default function TimeContextSection({ portalSlug }: TimeContextSectionProps) {
  const [data, setData] = useState<MomentsResponse | null>(null);

  useEffect(() => {
    async function fetchMoments() {
      try {
        const res = await fetch(`/api/moments?portal=${portalSlug}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch (error) {
        console.error("Failed to fetch moments:", error);
      }
    }
    fetchMoments();
  }, [portalSlug]);

  const context = data?.timeContext;
  if (!context?.sectionLabel || context.sectionCategories.length === 0) {
    return null;
  }

  const accent = getSectionAccent(context.sectionLabel);
  const seeAllHref = `/${portalSlug}?view=find&type=events&categories=${encodeURIComponent(context.sectionCategories.join(","))}`;

  return (
    <section className="space-y-3">
      <FeedSectionHeader
        title={context.sectionLabel}
        subtitle={`${context.season} • ${context.isWeekend ? "weekend" : "weekday"} • ${context.timeOfDay}`}
        priority="secondary"
        accentColor={accent}
        icon={getSectionIcon(context.sectionLabel)}
        seeAllHref={seeAllHref}
      />
      <div className="flex flex-wrap gap-2">
        {context.sectionCategories.map((category) => (
          <span
            key={category}
            className="inline-flex items-center rounded-full border border-[var(--twilight)] bg-[var(--dusk)]/70 px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-wide text-[var(--text-secondary)]"
          >
            {category.replace(/_/g, " ")}
          </span>
        ))}
      </div>
    </section>
  );
}
