"use client";

import { memo } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TagConfig {
  emoji: string;
  color: string;
}

interface ExperienceTagStripProps {
  tags: string[];
}

// ── Config ────────────────────────────────────────────────────────────────────

const TAG_CONFIG: Record<string, TagConfig> = {
  "live music":       { emoji: "🎵", color: "#FFD93D" },
  "live_music":       { emoji: "🎵", color: "#FFD93D" },
  "outdoor":          { emoji: "🌿", color: "#00D9A0" },
  "craft beer":       { emoji: "🍺", color: "#FF6B7A" },
  "craft_beer":       { emoji: "🍺", color: "#FF6B7A" },
  "food":             { emoji: "🍕", color: "#FF6B7A" },
  "food_vendors":     { emoji: "🍕", color: "#FF6B7A" },
  "all ages":         { emoji: "👨‍👩‍👧", color: "#A78BFA" },
  "all_ages":         { emoji: "👨‍👩‍👧", color: "#A78BFA" },
  "family friendly":  { emoji: "👨‍👩‍👧‍👦", color: "#A78BFA" },
  "family_friendly":  { emoji: "👨‍👩‍👧‍👦", color: "#A78BFA" },
  "art":              { emoji: "🎨", color: "#C9874F" },
  "arts":             { emoji: "🎨", color: "#C9874F" },
  "camping":          { emoji: "⛺", color: "#00D9A0" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTagConfig(tag: string): TagConfig | null {
  const normalized = tag.toLowerCase().trim();
  return TAG_CONFIG[normalized] ?? null;
}

function getTagLabel(tag: string): string {
  return tag
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ExperienceTagStrip = memo(function ExperienceTagStrip({
  tags,
}: ExperienceTagStripProps) {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const config = getTagConfig(tag);
        const label = getTagLabel(tag);

        if (config) {
          return (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium"
              style={{
                color: config.color,
                background: `${config.color}1A`,
              }}
            >
              <span role="img" aria-hidden="true">{config.emoji}</span>
              {label}
            </span>
          );
        }

        // Unknown tag — gray treatment
        return (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[var(--soft)] bg-[var(--dusk)] border border-[var(--twilight)]"
          >
            {label}
          </span>
        );
      })}
    </div>
  );
});

export type { ExperienceTagStripProps };
