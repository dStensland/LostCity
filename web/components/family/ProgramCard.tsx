"use client";

import { memo } from "react";
import {
  formatScheduleDays,
  formatCost,
  formatAgeRange,
  PROGRAM_TYPE_LABELS,
  type ProgramWithVenue,
} from "@/lib/types/programs";
import { formatTime } from "@/lib/formats";
import { RegistrationBadge } from "./RegistrationBadge";
import { ACTIVITY_TAGS, type ActivityTagKey } from "@/lib/family-constants";

interface ProgramCardProps {
  program: ProgramWithVenue;
  /** Optional accent color for the left border (e.g. a matched kid's color). */
  accentColor?: string;
  /** Called when the card is clicked. If provided, the card is rendered as a button. */
  onClick?: () => void;
}

function formatSessionDates(start: string | null, end: string | null): string {
  if (!start) return "";
  const fmt = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  if (!end || end === start) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Returns at most 2 activity tags found in the program's tags array. */
function getActivityTags(tags: string[] | null): ActivityTagKey[] {
  if (!tags || tags.length === 0) return [];
  const knownKeys = Object.keys(ACTIVITY_TAGS) as ActivityTagKey[];
  return tags.filter((t): t is ActivityTagKey => knownKeys.includes(t as ActivityTagKey)).slice(0, 2);
}

// Afternoon Field palette constants (for border accent)
const SAGE_COLOR = "#5E7A5E";

export const ProgramCard = memo(function ProgramCard({ program, accentColor, onClick }: ProgramCardProps) {
  const typeLabel = PROGRAM_TYPE_LABELS[program.program_type];
  const ageLabel = formatAgeRange(program.age_min, program.age_max);
  const scheduleDays = formatScheduleDays(program.schedule_days);
  const cost = formatCost(program.cost_amount, program.cost_period);
  const sessionDates = formatSessionDates(program.session_start, program.session_end);
  const isFree = program.cost_amount === null || program.cost_amount === 0;
  const activityTags = getActivityTags(program.tags);

  const startFormatted = formatTime(program.schedule_start_time);
  const endFormatted = program.schedule_end_time ? formatTime(program.schedule_end_time) : null;
  const timeDisplay =
    startFormatted !== "TBA" && endFormatted && endFormatted !== "TBA"
      ? `${startFormatted} – ${endFormatted}`
      : startFormatted !== "TBA"
      ? startFormatted
      : "";

  const scheduleDisplay = [scheduleDays, timeDisplay].filter(Boolean).join(" • ");

  const displayName = program.name.replace(/\s*\([A-Z]{2,4}\d{4,6}\)\s*$/, "");

  const borderLeftColor = accentColor ?? SAGE_COLOR;

  return (
    <div
      className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow"
      style={{
        borderColor: "var(--twilight, #E8E4DF)",
        borderLeftWidth: 4,
        borderLeftColor,
        cursor: onClick ? "pointer" : undefined,
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <h3
            className="text-base font-semibold leading-snug"
            style={{ fontFamily: "var(--font-plus-jakarta-sans, system-ui, sans-serif)", color: "var(--cream, #1C1917)" }}
          >
            {displayName}
          </h3>
          {program.provider_name && (
            <p className="text-sm mt-0.5 truncate" style={{ color: "var(--muted, #78716C)" }}>
              {program.provider_name}
            </p>
          )}
        </div>
        <RegistrationBadge status={program.registration_status} className="flex-shrink-0 mt-0.5" />
      </div>

      {/* Metadata pills row */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {/* Type */}
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-black/5 border border-black/10" style={{ color: "var(--soft, #57534E)" }}>
          {typeLabel}
        </span>

        {/* Age range */}
        {ageLabel !== "All ages" && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ color: "#C48B1D", backgroundColor: "color-mix(in srgb, #C48B1D 8%, white)", borderWidth: 1, borderStyle: "solid", borderColor: "color-mix(in srgb, #C48B1D 20%, white)" }}>
            {ageLabel}
          </span>
        )}

        {/* Cost — "Free" in sage green, paid in neutral */}
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border"
          style={
            isFree
              ? { color: "#3D6B3D", backgroundColor: "#5E7A5E14", borderColor: "#5E7A5E30" }
              : { color: "#57534E", backgroundColor: "rgba(0,0,0,0.04)", borderColor: "rgba(0,0,0,0.1)" }
          }
        >
          {cost}
        </span>

        {/* Activity type tags (max 2) */}
        {activityTags.map((tagKey) => {
          const tag = ACTIVITY_TAGS[tagKey];
          return (
            <span
              key={tagKey}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
              style={{
                color: tag.color,
                backgroundColor: `${tag.color}12`,
                borderColor: `${tag.color}28`,
              }}
            >
              <span aria-hidden="true">{tag.icon}</span>
              {tag.label}
            </span>
          );
        })}
      </div>

      {/* Schedule + dates */}
      {(scheduleDisplay || sessionDates) && (
        <div className="space-y-0.5 mb-3">
          {scheduleDisplay && (
            <p className="text-sm" style={{ color: "var(--soft, #57534E)" }}>{scheduleDisplay}</p>
          )}
          {sessionDates && (
            <p className="text-sm" style={{ color: "var(--muted, #78716C)" }}>{sessionDates}</p>
          )}
        </div>
      )}

      {/* Venue */}
      {program.venue && (
        <p className="text-xs mb-3 truncate" style={{ color: "var(--muted, #78716C)" }}>
          {program.venue.name}
          {program.venue.neighborhood ? ` · ${program.venue.neighborhood}` : ""}
        </p>
      )}

      {/* Practical care notes */}
      {(program.before_after_care || program.lunch_included) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {program.before_after_care && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
              style={{ color: "#756E63", backgroundColor: "#E0DDD420", borderWidth: 1, borderStyle: "solid", borderColor: "#E0DDD4" }}
            >
              <span aria-hidden="true">🕐</span>
              Extended care available
            </span>
          )}
          {program.lunch_included && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
              style={{ color: "#756E63", backgroundColor: "#E0DDD420", borderWidth: 1, borderStyle: "solid", borderColor: "#E0DDD4" }}
            >
              <span aria-hidden="true">🥪</span>
              Lunch included
            </span>
          )}
        </div>
      )}

      {/* Cost notes if any */}
      {program.cost_notes && (
        <p className="text-xs mb-3 italic" style={{ color: "var(--muted, #78716C)" }}>{program.cost_notes}</p>
      )}

      {/* Registration CTA */}
      {program.registration_url && (
        <a
          href={program.registration_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium hover:opacity-80 transition-opacity"
          style={{ color: "#C48B1D" }}
        >
          Register →
        </a>
      )}
    </div>
  );
});

export type { ProgramCardProps };
