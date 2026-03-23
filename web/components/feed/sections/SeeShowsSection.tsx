"use client";

import { useState } from "react";
import { Popcorn } from "@phosphor-icons/react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import NowShowingSection from "./NowShowingSection";
import { VenueGroupedShowsList } from "@/components/feed/VenueGroupedShowsList";

// ── Types ─────────────────────────────────────────────────────────

type ShowTab = "film" | "music" | "stage";

interface SeeShowsSectionProps {
  portalSlug: string;
}

// Tab labels and their first-viewed state (for lazy loading)
const TABS: { id: ShowTab; label: string }[] = [
  { id: "film", label: "Film" },
  { id: "music", label: "Music" },
  { id: "stage", label: "Stage" },
];

// ── Component ─────────────────────────────────────────────────────

export default function SeeShowsSection({ portalSlug }: SeeShowsSectionProps) {
  const [activeTab, setActiveTab] = useState<ShowTab>("film");
  // Track which tabs have been visited so we only mount them once
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
        accentColor="var(--neon-magenta)"
        icon={<Popcorn weight="duotone" className="w-5 h-5" />}
        seeAllHref={`/${portalSlug}?view=happening&content=showtimes`}
      />

      {/* Tab bar */}
      <div className="flex gap-1 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-[var(--neon-magenta)]/15 text-[var(--neon-magenta)] border border-[var(--neon-magenta)]/30"
                : "text-[var(--muted)] hover:text-[var(--soft)] hover:bg-[var(--twilight)]/40 border border-transparent"
            }`}
            aria-pressed={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels — kept in DOM once visited, hidden when not active */}
      <div className={activeTab === "film" ? "block" : "hidden"}>
        {/* Film: NowShowingSection is always mounted (it's the default tab) */}
        <NowShowingSection portalSlug={portalSlug} />
      </div>

      <div className={activeTab === "music" ? "block" : "hidden"}>
        {visited.has("music") && (
          <VenueGroupedShowsList
            portalSlug={portalSlug}
            categories="music"
          />
        )}
      </div>

      <div className={activeTab === "stage" ? "block" : "hidden"}>
        {visited.has("stage") && (
          <VenueGroupedShowsList
            portalSlug={portalSlug}
            categories="theater,comedy,dance"
          />
        )}
      </div>
    </section>
  );
}
