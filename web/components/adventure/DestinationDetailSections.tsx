"use client";

import { useMemo } from "react";
import { Mountains, Timer, Car, Lightning, Leaf, Tent, Compass } from "@phosphor-icons/react";
import { SectionHeader } from "@/components/detail/SectionHeader";
import {
  YONDER_WAVE1_DESTINATION_INTELLIGENCE,
  type YonderDestinationIntelligence,
} from "@/config/yonder-destination-intelligence";
import {
  YONDER_LAUNCH_DESTINATION_NODES,
  YONDER_LAUNCH_DESTINATION_NODE_QUESTS,
} from "@/config/yonder-launch-destination-nodes";
import { ADV } from "@/lib/adventure-tokens";

interface DestinationDetailSectionsProps {
  venueSlug: string;
  portalSlug: string;
}

const COMMITMENT_LABELS: Record<string, string> = {
  hour: "1 Hour",
  halfday: "Half Day",
  fullday: "Full Day",
  weekend: "Weekend",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
};

const SEASON_LABELS: Record<string, string> = {
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
  winter: "Winter",
};

const WEATHER_TAG_LABELS: Record<string, string> = {
  "after-rain": "After Rain",
  "cool-weather": "Cool Weather",
  "leaf-season": "Leaf Season",
  "clear-day": "Clear Day",
  "summer-friendly": "Summer Friendly",
  "sunrise-friendly": "Sunrise",
  "heat-exposed": "Heat Caution",
  "dry-weather": "Dry Weather",
  "all-season": "All Season",
};

const ACCOMMODATION_LABELS: Record<string, string> = {
  campground: "Campground",
  cabin: "Cabin",
  lodge: "Lodge",
  operator_trip: "Guided Trip",
  day_use_only: "Day Use Only",
};

function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!minutes) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours}h ${minutes}m`;
}

// ---- Metadata pill -------------------------------------------------------

function MetaPill({ icon: Icon, label, value, accentColor }: {
  icon: typeof Mountains;
  label: string;
  value: string;
  accentColor?: string;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2"
      style={{
        border: `2px solid ${ADV.DARK}`,
        borderRadius: 0,
        backgroundColor: "#FFFFFF",
      }}
    >
      <Icon size={14} weight="bold" color={accentColor ?? ADV.STONE} />
      <div>
        <p
          className="text-xs font-bold uppercase"
          style={{
            letterSpacing: "0.08em",
            color: ADV.STONE,
            fontSize: "9px",
          }}
        >
          {label}
        </p>
        <p
          className="text-sm font-bold"
          style={{
            color: accentColor ?? ADV.DARK,
          }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

// ---- Main component ------------------------------------------------------

export function DestinationDetailSections({ venueSlug, portalSlug }: DestinationDetailSectionsProps) {
  // Look up destination intelligence by slug
  const intelligence = useMemo((): YonderDestinationIntelligence | null => {
    return YONDER_WAVE1_DESTINATION_INTELLIGENCE.find((d) => d.slug === venueSlug) ?? null;
  }, [venueSlug]);

  // Look up quest membership
  const questMembership = useMemo(() => {
    const nodes = YONDER_LAUNCH_DESTINATION_NODES.filter(
      (n) => n.spotSlug === venueSlug || n.parentSpotSlug === venueSlug
    );
    const questIds = new Set(nodes.flatMap((n) => n.questIds));
    return YONDER_LAUNCH_DESTINATION_NODE_QUESTS.filter((q) => questIds.has(q.id));
  }, [venueSlug]);

  // Don't render anything if no intelligence data for this venue
  if (!intelligence && questMembership.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* ── COMMITMENT & LOGISTICS ─────────────────────────── */}
      {intelligence && (
        <div>
          <SectionHeader title="Trip Details" variant="divider" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            <MetaPill
              icon={Car}
              label="Drive"
              value={`${intelligence.driveTimeMinutes} min`}
              accentColor={ADV.TERRACOTTA}
            />
            <MetaPill
              icon={Timer}
              label="Duration"
              value={formatDuration(intelligence.typicalDurationMinutes)}
              accentColor={ADV.TERRACOTTA}
            />
            <MetaPill
              icon={Lightning}
              label="Difficulty"
              value={DIFFICULTY_LABELS[intelligence.difficultyLevel] ?? intelligence.difficultyLevel}
              accentColor={
                intelligence.difficultyLevel === "hard" ? ADV.TERRACOTTA :
                intelligence.difficultyLevel === "moderate" ? ADV.STONE : ADV.OLIVE
              }
            />
            <MetaPill
              icon={Mountains}
              label="Commitment"
              value={COMMITMENT_LABELS[intelligence.commitmentTier] ?? intelligence.commitmentTier}
            />
          </div>

          {/* Why it matters */}
          {intelligence.whyItMatters && (
            <div
              className="mt-4 p-4"
              style={{
                borderLeft: `3px solid ${ADV.TERRACOTTA}`,
                backgroundColor: `${ADV.TERRACOTTA}08`,
              }}
            >
              <p
                className="text-sm leading-relaxed"
                style={{ color: ADV.DARK }}
              >
                {intelligence.whyItMatters}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── CONDITIONS INTELLIGENCE ───────────────────────── */}
      {intelligence && (
        <div>
          <SectionHeader title="Best Conditions" variant="divider" />
          <div className="mt-3 space-y-3">
            {/* Best seasons */}
            {intelligence.bestSeasons.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Leaf size={14} weight="bold" color={ADV.OLIVE} />
                <span
                  className="text-xs font-bold uppercase"
                  style={{
                    letterSpacing: "0.08em",
                    color: ADV.STONE,
                  }}
                >
                  Best Seasons:
                </span>
                {intelligence.bestSeasons.map((season) => (
                  <span
                    key={season}
                    className="px-2 py-0.5 text-xs font-bold"
                    style={{
                      backgroundColor: `${ADV.OLIVE}18`,
                      color: ADV.OLIVE,
                      border: `2px solid ${ADV.OLIVE}40`,
                      borderRadius: 0,
                    }}
                  >
                    {SEASON_LABELS[season] ?? season}
                  </span>
                ))}
              </div>
            )}

            {/* Weather fit tags */}
            {intelligence.weatherFitTags.length > 0 && (
              <div className="flex items-start gap-2 flex-wrap">
                {intelligence.weatherFitTags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-xs font-bold uppercase"
                    style={{
                      letterSpacing: "0.06em",
                      backgroundColor: `${ADV.STONE}12`,
                      color: ADV.STONE,
                      border: `2px solid ${ADV.STONE}30`,
                      borderRadius: 0,
                    }}
                  >
                    {WEATHER_TAG_LABELS[tag] ?? tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Practical notes */}
          {intelligence.practicalNotes.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {intelligence.practicalNotes.map((note, idx) => (
                <li key={idx} className="flex gap-2 text-sm" style={{ color: ADV.STONE }}>
                  <span style={{ color: ADV.TERRACOTTA, flexShrink: 0 }}>-</span>
                  {note}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── OVERNIGHT OPTIONS ────────────────────────────── */}
      {intelligence?.overnightSupport && (
        <div>
          <SectionHeader title="Overnight Options" variant="divider" />
          <div className="mt-3 space-y-3">
            {/* Accommodation types */}
            <div className="flex items-center gap-2 flex-wrap">
              <Tent size={14} weight="bold" color={ADV.TERRACOTTA} />
              {intelligence.overnightSupport.accommodationTypes.map((type) => (
                <span
                  key={type}
                  className="px-2 py-0.5 text-xs font-bold"
                  style={{
                    backgroundColor: `${ADV.TERRACOTTA}12`,
                    color: ADV.TERRACOTTA,
                    border: `2px solid ${ADV.TERRACOTTA}30`,
                    borderRadius: 0,
                  }}
                >
                  {ACCOMMODATION_LABELS[type] ?? type}
                </span>
              ))}
            </div>

            {/* Inventory note */}
            {intelligence.overnightSupport.inventoryNote && (
              <p className="text-sm" style={{ color: ADV.STONE }}>
                {intelligence.overnightSupport.inventoryNote}
              </p>
            )}

            {/* Stay options */}
            {intelligence.overnightSupport.stayOptions.length > 0 && (
              <div className="space-y-2">
                {intelligence.overnightSupport.stayOptions.map((option) => (
                  <div
                    key={option.unitType}
                    className="p-3"
                    style={{
                      border: `2px solid ${ADV.DARK}20`,
                      borderRadius: 0,
                    }}
                  >
                    <p
                      className="text-sm font-bold"
                      style={{
                        color: ADV.DARK,
                      }}
                    >
                      {option.label}
                    </p>
                    <p className="text-sm mt-0.5" style={{ color: ADV.STONE }}>
                      {option.summary}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── QUEST MEMBERSHIP ────────────────────────────── */}
      {questMembership.length > 0 && (
        <div>
          <SectionHeader title="Part of These Quests" variant="divider" />
          <div className="mt-3 space-y-2">
            {questMembership.map((quest) => (
              <div
                key={quest.id}
                className="flex items-center gap-3 p-3"
                style={{
                  border: `2px solid ${ADV.DARK}`,
                  borderRadius: 0,
                  backgroundColor: "#FFFFFF",
                }}
              >
                <Compass size={18} weight="bold" color={ADV.TERRACOTTA} />
                <div>
                  <p
                    className="text-sm font-bold"
                    style={{
                      color: ADV.DARK,
                    }}
                  >
                    {quest.title}
                  </p>
                  <p className="text-xs" style={{ color: ADV.STONE }}>
                    {quest.subtitle}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
