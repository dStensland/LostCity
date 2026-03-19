"use client";

import { Tag } from "@phosphor-icons/react";
import { type ProgramWithVenue, formatAgeRange, formatCost } from "@/lib/types/programs";
import { RegistrationBadge } from "../RegistrationBadge";
import { FAMILY_TOKENS } from "@/lib/family-design-tokens";
import { SectionLabel, SkeletonBlock } from "./_shared";

const AMBER = FAMILY_TOKENS.amber;
const SAGE = FAMILY_TOKENS.sage;
const TEXT = FAMILY_TOKENS.text;
const MUTED = FAMILY_TOKENS.textSecondary;
const CARD = FAMILY_TOKENS.card;
const BORDER = FAMILY_TOKENS.border;

// ---- Exclusion patterns ----------------------------------------------------

// Programs whose title signals they are not open to the general public.
const RADAR_EXCLUSION_RE = /\bclosed\s+to\s+(the\s+)?public\b/i;

// ---- closingLabel ----------------------------------------------------------

/** Returns a human label for a closing deadline.
 *  Within 72 hours → "Closes tomorrow" / "Closes today" / "Closes in N hours".
 *  Beyond 72 hours → "Closes [date]". */
export function closingLabel(registrationCloses: string | null): string {
  if (!registrationCloses) return "Registration closes soon";
  const closeMs = new Date(registrationCloses + "T23:59:59").getTime();
  const nowMs = Date.now();
  const hoursLeft = (closeMs - nowMs) / (1000 * 60 * 60);
  if (hoursLeft <= 0) return "Registration closed";
  if (hoursLeft <= 24) return "Closes today";
  if (hoursLeft <= 48) return "Closes tomorrow";
  if (hoursLeft <= 72) return "Closes in 3 days";
  // Beyond 72 hours — show actual date
  const d = new Date(registrationCloses + "T00:00:00");
  return `Closes ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

// ---- RadarRow --------------------------------------------------------------

function RadarRow({
  program,
  urgencyLabel,
  urgencyColor,
}: {
  program: ProgramWithVenue;
  urgencyLabel: string;
  urgencyColor: string;
}) {
  return (
    <div
      className="flex items-start gap-3 py-2.5 border-b last:border-b-0"
      style={{ borderColor: BORDER }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            style={{
              fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
              fontSize: 14,
              fontWeight: 600,
              color: TEXT,
            }}
          >
            {program.name}
          </span>
          <RegistrationBadge status={program.registration_status} />
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          {program.provider_name && (
            <span style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 11, color: MUTED }}>
              {program.provider_name}
            </span>
          )}
          <span style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 11, color: MUTED }}>
            {formatAgeRange(program.age_min, program.age_max)}
          </span>
          <span style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 11, color: MUTED }}>
            {formatCost(program.cost_amount, program.cost_period)}
          </span>
        </div>
        <p style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 11, color: urgencyColor, marginTop: 2 }}>
          {urgencyLabel}
        </p>
      </div>
      {program.registration_url && (
        <a
          href={program.registration_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 hover:opacity-80 transition-opacity mt-0.5"
          style={{
            color: AMBER,
            fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Register →
        </a>
      )}
    </div>
  );
}

// ---- RegistrationRadarSection ----------------------------------------------

export function RegistrationRadarSection({
  radarData,
  isLoading,
}: {
  radarData:
    | { opening_soon: ProgramWithVenue[]; closing_soon: ProgramWithVenue[]; filling_fast: ProgramWithVenue[] }
    | undefined;
  isLoading: boolean;
}) {
  const urgentPrograms: Array<{
    program: ProgramWithVenue;
    urgencyLabel: string;
    urgencyColor: string;
  }> = [];

  if (radarData) {
    radarData.closing_soon
      .filter((p) => !RADAR_EXCLUSION_RE.test(p.name))
      .forEach((p) =>
        urgentPrograms.push({
          program: p,
          urgencyLabel: closingLabel(p.registration_closes ?? null),
          urgencyColor: "#C45A3B",
        })
      );
    radarData.filling_fast
      .filter((p) => !RADAR_EXCLUSION_RE.test(p.name))
      .forEach((p) =>
        urgentPrograms.push({ program: p, urgencyLabel: "Waitlist — act fast", urgencyColor: "#D97706" })
      );
    radarData.opening_soon
      .filter((p) => !RADAR_EXCLUSION_RE.test(p.name))
      .forEach((p) =>
        urgentPrograms.push({ program: p, urgencyLabel: "Registration opens soon", urgencyColor: SAGE })
      );
  }

  const has = urgentPrograms.length > 0;

  return (
    <section>
      <SectionLabel
        text="Registration Radar"
        color={AMBER}
        rightSlot={<Tag size={14} weight="bold" style={{ color: AMBER }} />}
      />
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <SkeletonBlock height={68} />
          <SkeletonBlock height={68} />
        </div>
      ) : has ? (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, padding: "0 14px" }}
        >
          {urgentPrograms.slice(0, 5).map(({ program, urgencyLabel, urgencyColor }) => (
            <RadarRow
              key={program.id}
              program={program}
              urgencyLabel={urgencyLabel}
              urgencyColor={urgencyColor}
            />
          ))}
        </div>
      ) : (
        <p style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 13, color: MUTED }}>
          Nothing urgent right now — check the Programs tab for what&apos;s coming.
        </p>
      )}
    </section>
  );
}
