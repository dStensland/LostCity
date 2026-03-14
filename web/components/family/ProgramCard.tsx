"use client";

import { memo } from "react";
import {
  formatScheduleDays,
  formatCost,
  formatAgeRange,
  PROGRAM_TYPE_LABELS,
  type ProgramWithVenue,
} from "@/lib/types/programs";
import { RegistrationBadge } from "./RegistrationBadge";

interface ProgramCardProps {
  program: ProgramWithVenue;
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

export const ProgramCard = memo(function ProgramCard({ program }: ProgramCardProps) {
  const typeLabel = PROGRAM_TYPE_LABELS[program.program_type];
  const ageLabel = formatAgeRange(program.age_min, program.age_max);
  const scheduleDays = formatScheduleDays(program.schedule_days);
  const cost = formatCost(program.cost_amount, program.cost_period);
  const sessionDates = formatSessionDates(program.session_start, program.session_end);
  const isFree = program.cost_amount === null || program.cost_amount === 0;

  const scheduleDisplay = [
    scheduleDays,
    program.schedule_start_time && program.schedule_end_time
      ? `${program.schedule_start_time}–${program.schedule_end_time}`
      : program.schedule_start_time || "",
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <div
      className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow"
      style={{ borderColor: "var(--twilight, #E8E4DF)" }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <h3
            className="text-base font-semibold leading-snug text-[var(--cream)]"
            style={{ fontFamily: "var(--font-outfit, system-ui, sans-serif)" }}
          >
            {program.name}
          </h3>
          {program.provider_name && (
            <p className="text-sm text-[var(--muted)] mt-0.5 truncate">
              {program.provider_name}
            </p>
          )}
        </div>
        <RegistrationBadge status={program.registration_status} className="flex-shrink-0 mt-0.5" />
      </div>

      {/* Metadata pills row */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {/* Type */}
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--night)] text-[var(--soft)] border border-[var(--twilight)]">
          {typeLabel}
        </span>

        {/* Age range */}
        {ageLabel !== "All ages" && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-[var(--coral)] bg-[color-mix(in_srgb,var(--coral)_8%,white)] border border-[color-mix(in_srgb,var(--coral)_20%,white)]">
            {ageLabel}
          </span>
        )}

        {/* Cost */}
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
            isFree
              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
              : "bg-[var(--night)] text-[var(--soft)] border-[var(--twilight)]"
          }`}
        >
          {cost}
        </span>
      </div>

      {/* Schedule + dates */}
      {(scheduleDisplay || sessionDates) && (
        <div className="space-y-0.5 mb-3">
          {scheduleDisplay && (
            <p className="text-sm text-[var(--soft)]">{scheduleDisplay}</p>
          )}
          {sessionDates && (
            <p className="text-sm text-[var(--muted)]">{sessionDates}</p>
          )}
        </div>
      )}

      {/* Venue */}
      {program.venue && (
        <p className="text-xs text-[var(--muted)] mb-3 truncate">
          {program.venue.name}
          {program.venue.neighborhood ? ` · ${program.venue.neighborhood}` : ""}
        </p>
      )}

      {/* Cost notes if any */}
      {program.cost_notes && (
        <p className="text-xs text-[var(--muted)] mb-3 italic">{program.cost_notes}</p>
      )}

      {/* Registration CTA */}
      {program.registration_url && (
        <a
          href={program.registration_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--coral)] hover:opacity-80 transition-opacity"
        >
          Register →
        </a>
      )}
    </div>
  );
});

export type { ProgramCardProps };
