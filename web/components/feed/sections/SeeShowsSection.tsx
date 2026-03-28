"use client";

import { useState } from "react";
import { Ticket } from "@phosphor-icons/react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import NowShowingSection from "./NowShowingSection";
import { VenueGroupedShowsList } from "@/components/feed/VenueGroupedShowsList";

// ── Types ─────────────────────────────────────────────────────────

type ShowTab = "film" | "music" | "theater" | "clowns";

interface SeeShowsSectionProps {
  portalSlug: string;
}

const TABS: { id: ShowTab; label: string; accent: string }[] = [
  { id: "film", label: "Film", accent: "var(--vibe)" },
  { id: "music", label: "Music", accent: "#E855A0" },
  { id: "theater", label: "Theater", accent: "var(--neon-cyan)" },
  { id: "clowns", label: "Clowns", accent: "var(--gold)" },
];

// ── Component ─────────────────────────────────────────────────────

export default function SeeShowsSection({ portalSlug }: SeeShowsSectionProps) {
  const [activeTab, setActiveTab] = useState<ShowTab>("film");
  const [visited, setVisited] = useState<Set<ShowTab>>(new Set(["film"]));

  function handleTabClick(tab: ShowTab) {
    setActiveTab(tab);
    setVisited((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }

  return (
    <section className="pb-2">
      {/* Section header */}
      <FeedSectionHeader
        title="See Shows"
        priority="secondary"
        accentColor="var(--coral)"
        icon={<Ticket weight="duotone" className="w-5 h-5" />}
        seeAllHref={`/${portalSlug}?view=happening&content=showtimes`}
      />

      {/* Tab bar — each tab gets its own accent color */}
      <div className="flex gap-1 mb-4">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              style={{ "--tab-accent": tab.accent } as React.CSSProperties}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[var(--tab-accent)]/15 text-[var(--tab-accent)] border border-[var(--tab-accent)]/30"
                  : "text-[var(--muted)] hover:text-[var(--soft)] hover:bg-[var(--twilight)]/40 border border-transparent"
              }`}
              aria-pressed={isActive}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab panels — kept in DOM once visited, hidden when not active */}
      <div className={activeTab === "film" ? "block" : "hidden"}>
        <NowShowingSection portalSlug={portalSlug} />
      </div>

      <div className={activeTab === "music" ? "block" : "hidden"}>
        {visited.has("music") && (
          <VenueGroupedShowsList
            portalSlug={portalSlug}
            categories="music"
            accentColor="#E855A0"
          />
        )}
      </div>

      <div className={activeTab === "theater" ? "block" : "hidden"}>
        {visited.has("theater") && (
          <VenueGroupedShowsList
            portalSlug={portalSlug}
            categories="theater,dance"
            accentColor="var(--neon-cyan)"
          />
        )}
      </div>

      <div className={activeTab === "clowns" ? "block" : "hidden"}>
        {visited.has("clowns") && (
          <VenueGroupedShowsList
            portalSlug={portalSlug}
            categories="comedy"
            accentColor="var(--gold)"
          />
        )}
      </div>
    </section>
  );
}
