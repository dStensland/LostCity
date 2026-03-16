"use client";

import { memo, useState, useDeferredValue } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  formatScheduleDays,
  formatCost,
  formatAgeRange,
  isRegistrationUrgent,
  type ProgramWithVenue,
  type ProgramType,
  type RegistrationStatus,
} from "@/lib/types/programs";
import { isAgeMatch, type KidProfile } from "@/lib/types/kid-profiles";
import { formatTime } from "@/lib/formats";
import { ProgramDetailSheet } from "./ProgramDetailSheet";

// ---- Palette ---------------------------------------------------------------

const CARD_BG = "#FAFAF6";
const SAGE = "#5E7A5E";
const AMBER = "#C48B1D";
const MOSS = "#7A9E7A";
const TEXT = "#1E2820";
const MUTED = "#756E63";
const BORDER = "#E0DDD4";

// ---- Types -----------------------------------------------------------------

interface ProgramsBrowserProps {
  portalSlug: string;
  activeKidIds?: string[];
  kids?: KidProfile[];
}

type CategoryFilter = "all" | "camps" | "enrichment" | "leagues" | "classes";

const CATEGORY_PILLS: Array<{ id: CategoryFilter; label: string; type?: ProgramType }> = [
  { id: "all", label: "All" },
  { id: "camps", label: "Camps", type: "camp" },
  { id: "enrichment", label: "Enrichment", type: "enrichment" },
  { id: "leagues", label: "Leagues", type: "league" },
  { id: "classes", label: "Classes", type: "class" },
];

// ---- Data fetcher ----------------------------------------------------------

async function fetchPrograms(
  portalSlug: string,
  type: ProgramType | ""
): Promise<ProgramWithVenue[]> {
  const params = new URLSearchParams({ portal: portalSlug, limit: "60", active: "true" });
  if (type) params.set("type", type);

  const res = await fetch(`/api/programs?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.programs ?? []) as ProgramWithVenue[];
}

// ---- Helpers ---------------------------------------------------------------

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

function formatRegistrationCloses(closes: string | null): string | null {
  if (!closes) return null;
  const date = new Date(closes + "T00:00:00");
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return null;
  if (diffDays === 0) return "Closes today";
  if (diffDays === 1) return "Closes tomorrow";
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (diffDays <= 7) return `Closes ${dayNames[date.getDay()]}`;
  return `Closes ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

// ---- Program Card (inline) -------------------------------------------------

interface ProgramCardItemProps {
  program: ProgramWithVenue;
  matchingKid: KidProfile | null;
}

const ProgramCardItem = memo(function ProgramCardItem({
  program,
  matchingKid,
}: ProgramCardItemProps) {
  const ageLabel = formatAgeRange(program.age_min, program.age_max);
  const scheduleDays = formatScheduleDays(program.schedule_days);
  const cost = formatCost(program.cost_amount, program.cost_period);
  const sessionDates = formatSessionDates(program.session_start, program.session_end);
  const isFree = program.cost_amount === null || program.cost_amount === 0;
  const isUrgent = isRegistrationUrgent(program);
  const closesLabel = formatRegistrationCloses(program.registration_closes);

  // Build meta line: "Ages 8–14 · Mon–Fri 9am–3pm · $285/wk"
  const metaParts: string[] = [];
  if (ageLabel !== "All ages") metaParts.push(ageLabel);
  if (scheduleDays) {
    const startFmt = formatTime(program.schedule_start_time);
    const endFmt = program.schedule_end_time ? formatTime(program.schedule_end_time) : null;
    const timeStr =
      startFmt !== "TBA" && endFmt && endFmt !== "TBA"
        ? ` ${startFmt} – ${endFmt}`
        : startFmt !== "TBA"
        ? ` ${startFmt}`
        : "";
    metaParts.push(scheduleDays + timeStr);
  }
  metaParts.push(cost);
  const metaLine = metaParts.join(" · ");

  // Left border color
  const accentColor = matchingKid ? matchingKid.color : SAGE;

  // Registration status badge
  const status: RegistrationStatus = program.registration_status;

  return (
    <div
      style={{
        backgroundColor: CARD_BG,
        borderRadius: 14,
        borderLeft: `3px solid ${accentColor}`,
        border: `1px solid ${BORDER}`,
        borderLeftWidth: 4,
        borderLeftColor: accentColor,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {/* Title */}
      <div
        style={{
          fontFamily: "Outfit, system-ui, sans-serif",
          fontSize: 15,
          fontWeight: 700,
          color: TEXT,
          lineHeight: 1.3,
        }}
      >
        {program.name.replace(/\s*\([A-Z]{2,4}\d{4,6}\)\s*$/, "")}
      </div>

      {/* Provider / venue */}
      {(program.provider_name || program.venue?.name) && (
        <div
          style={{
            fontFamily: "DM Sans, system-ui, sans-serif",
            fontSize: 12,
            color: MUTED,
          }}
        >
          {program.provider_name || program.venue?.name}
          {program.venue?.neighborhood ? ` · ${program.venue.neighborhood}` : ""}
        </div>
      )}

      {/* Meta line */}
      {metaLine && (
        <div
          style={{
            fontFamily: "DM Sans, system-ui, sans-serif",
            fontSize: 12,
            color: MUTED,
          }}
        >
          {metaLine}
        </div>
      )}

      {/* Tags row */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        {/* Registration status badge */}
        {status === "open" && (
          <span
            style={{
              fontFamily: "DM Sans, system-ui, sans-serif",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              color: MOSS,
              backgroundColor: `${MOSS}14`,
              borderRadius: 8,
              padding: "2px 8px",
            }}
          >
            OPEN
          </span>
        )}

        {status === "waitlist" && (
          <span
            style={{
              fontFamily: "DM Sans, system-ui, sans-serif",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              color: MUTED,
              backgroundColor: `${MUTED}1A`,
              borderRadius: 8,
              padding: "2px 8px",
            }}
          >
            WAITLIST
          </span>
        )}

        {status === "sold_out" && (
          <span
            style={{
              fontFamily: "DM Sans, system-ui, sans-serif",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              color: MUTED,
              backgroundColor: `${MUTED}1A`,
              borderRadius: 8,
              padding: "2px 8px",
            }}
          >
            SOLD OUT
          </span>
        )}

        {status === "upcoming" && (
          <span
            style={{
              fontFamily: "DM Sans, system-ui, sans-serif",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              color: AMBER,
              backgroundColor: `${AMBER}1A`,
              border: `1px solid ${AMBER}30`,
              borderRadius: 8,
              padding: "2px 8px",
            }}
          >
            COMING SOON
          </span>
        )}

        {status === "walk_in" && (
          <span
            style={{
              fontFamily: "DM Sans, system-ui, sans-serif",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              color: SAGE,
              backgroundColor: `${SAGE}14`,
              borderRadius: 8,
              padding: "2px 8px",
            }}
          >
            WALK-IN
          </span>
        )}

        {/* Closing soon badge — shown when open + urgent */}
        {status === "open" && isUrgent && closesLabel && (
          <span
            style={{
              fontFamily: "DM Sans, system-ui, sans-serif",
              fontSize: 10,
              fontWeight: 600,
              color: AMBER,
              backgroundColor: `${AMBER}1A`,
              border: `1px solid ${AMBER}30`,
              borderRadius: 10,
              padding: "3px 8px",
            }}
          >
            {closesLabel.toUpperCase()}
          </span>
        )}

        {/* Free badge */}
        {isFree && (
          <span
            style={{
              fontFamily: "DM Sans, system-ui, sans-serif",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              color: "#3A7D44",
              backgroundColor: "#3A7D4412",
              borderRadius: 8,
              padding: "2px 8px",
            }}
          >
            FREE
          </span>
        )}

        {/* Date range */}
        {sessionDates && (
          <span
            style={{
              fontFamily: "DM Sans, system-ui, sans-serif",
              fontSize: 11,
              color: MUTED,
            }}
          >
            {sessionDates}
          </span>
        )}
      </div>

      {/* Registration link */}
      {program.registration_url && (status === "open" || status === "walk_in") && (
        <div style={{ marginTop: 2 }}>
          <a
            href={program.registration_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "DM Sans, system-ui, sans-serif",
              fontSize: 12,
              fontWeight: 600,
              color: SAGE,
              textDecoration: "none",
            }}
          >
            Register →
          </a>
        </div>
      )}
    </div>
  );
});

// ---- Main component --------------------------------------------------------

export const ProgramsBrowser = memo(function ProgramsBrowser({
  portalSlug,
  activeKidIds = [],
  kids = [],
}: ProgramsBrowserProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [matchingOnly, setMatchingOnly] = useState(false);
  const [searchQuery] = useState("");
  const [selectedProgram, setSelectedProgram] = useState<ProgramWithVenue | null>(null);
  const deferredQuery = useDeferredValue(searchQuery);

  // Resolve selected kids
  const selectedKids =
    activeKidIds.length > 0 ? kids.filter((k) => activeKidIds.includes(k.id)) : [];

  // Map category pill to ProgramType
  const activeType =
    CATEGORY_PILLS.find((p) => p.id === activeCategory)?.type ?? "";

  const { data: programs, isLoading } = useQuery({
    queryKey: ["family-programs", portalSlug, activeType],
    queryFn: () => fetchPrograms(portalSlug, activeType),
    staleTime: 2 * 60 * 1000,
  });

  const allResults = programs ?? [];

  // Text search (deferred)
  let results = deferredQuery.trim()
    ? allResults.filter(
        (p) =>
          p.name.toLowerCase().includes(deferredQuery.toLowerCase()) ||
          (p.provider_name ?? "").toLowerCase().includes(deferredQuery.toLowerCase())
      )
    : allResults;

  // Kid age filtering
  if (selectedKids.length > 0 && (matchingOnly || activeKidIds.length > 0)) {
    results = results.filter((p) =>
      selectedKids.some((kid) => isAgeMatch(kid.age, p.age_min, p.age_max))
    );
  }

  // Count for match display
  const matchCount = results.length;

  // Derive age range label from selected kids
  const ageRangeLabel =
    selectedKids.length === 1
      ? `${selectedKids[0].age}'s age`
      : selectedKids.length > 1
      ? `${Math.min(...selectedKids.map((k) => k.age))}–${Math.max(...selectedKids.map((k) => k.age))}`
      : null;

  // For each result, find the first matching kid (for card accent color)
  function getMatchingKid(program: ProgramWithVenue): KidProfile | null {
    if (selectedKids.length === 0) return null;
    return (
      selectedKids.find((kid) => isAgeMatch(kid.age, program.age_min, program.age_max)) ?? null
    );
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Sticky header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backgroundColor: CARD_BG,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        {/* Title row + toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px 10px",
          }}
        >
          <span
            style={{
              fontFamily: "Outfit, system-ui, sans-serif",
              fontSize: 28,
              fontWeight: 800,
              color: TEXT,
            }}
          >
            Programs
          </span>

          {/* Matching-only toggle */}
          {selectedKids.length > 0 && (
            <button
              onClick={() => setMatchingOnly((v) => !v)}
              aria-label={matchingOnly ? "Show all programs" : "Show matching programs only"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "DM Sans, system-ui, sans-serif",
                  fontSize: 11,
                  color: MUTED,
                  lineHeight: 1,
                }}
              >
                Matching only
              </span>
              {/* Toggle track */}
              <div
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: matchingOnly ? SAGE : BORDER,
                  position: "relative",
                  transition: "background-color 0.18s",
                  flexShrink: 0,
                }}
              >
                {/* Toggle knob */}
                <div
                  style={{
                    position: "absolute",
                    top: 2,
                    left: matchingOnly ? 18 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    backgroundColor: "white",
                    transition: "left 0.18s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                  }}
                />
              </div>
            </button>
          )}
        </div>

        {/* Category filter pills */}
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            padding: "0 20px 12px",
            scrollbarWidth: "none",
          }}
        >
          {CATEGORY_PILLS.map((pill) => {
            const isActive = activeCategory === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setActiveCategory(pill.id)}
                style={{
                  flexShrink: 0,
                  borderRadius: 20,
                  padding: "6px 14px",
                  fontSize: 14,
                  fontFamily: "DM Sans, system-ui, sans-serif",
                  fontWeight: 500,
                  border: isActive ? "none" : `1px solid ${BORDER}`,
                  backgroundColor: isActive ? SAGE : CARD_BG,
                  color: isActive ? "white" : TEXT,
                  cursor: "pointer",
                  transition: "background-color 0.15s, color 0.15s",
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Age filter row + match count */}
      {selectedKids.length > 0 && (
        <div style={{ padding: "10px 20px 4px", display: "flex", flexDirection: "column", gap: 4 }}>
          {/* Age chip row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontFamily: "DM Sans, system-ui, sans-serif",
                fontSize: 12,
                color: MUTED,
              }}
            >
              Ages:
            </span>
            {selectedKids.map((kid) => (
              <span
                key={kid.id}
                style={{
                  borderRadius: 14,
                  padding: "2px 10px",
                  fontSize: 12,
                  fontFamily: "DM Sans, system-ui, sans-serif",
                  fontWeight: 500,
                  backgroundColor: `${kid.color}15`,
                  border: `1px solid ${kid.color}30`,
                  color: kid.color,
                }}
              >
                {kid.age} · {kid.nickname}
              </span>
            ))}
          </div>

          {/* Match count */}
          {ageRangeLabel && (
            <span
              style={{
                fontFamily: "DM Sans, system-ui, sans-serif",
                fontSize: 12,
                color: MUTED,
              }}
            >
              {matchCount} program{matchCount !== 1 ? "s" : ""} match{matchCount === 1 ? "es" : ""}{" "}
              {selectedKids.length === 1
                ? `${selectedKids[0].nickname}'s age`
                : "your kids' ages"}
            </span>
          )}
        </div>
      )}

      {/* Card list */}
      <div style={{ padding: "12px 16px 0", display: "flex", flexDirection: "column", gap: 10, maxWidth: 680 }}>
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 120,
                  borderRadius: 14,
                  backgroundColor: BORDER,
                  opacity: 0.5,
                }}
                className="skeleton-shimmer-light"
              />
            ))}
          </>
        ) : results.length > 0 ? (
          results.map((program) => (
            <div
              key={program.id}
              style={{ cursor: "pointer" }}
              onClick={() => setSelectedProgram(program)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedProgram(program);
                }
              }}
            >
              <ProgramCardItem
                program={program}
                matchingKid={getMatchingKid(program)}
              />
            </div>
          ))
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "48px 20px",
            }}
          >
            <div
              className="inline-flex items-center justify-center rounded-2xl mb-4"
              style={{ width: 56, height: 56, backgroundColor: `${SAGE}12` }}
            >
              <span style={{ fontSize: 24 }}>🎒</span>
            </div>
            <p
              style={{
                fontFamily: "DM Sans, system-ui, sans-serif",
                fontSize: 15,
                fontWeight: 600,
                color: TEXT,
                marginBottom: 4,
              }}
            >
              No programs yet
            </p>
            <p
              style={{
                fontFamily: "DM Sans, system-ui, sans-serif",
                fontSize: 13,
                color: MUTED,
              }}
            >
              Try a different category or check back soon.
            </p>
          </div>
        )}
      </div>

      {/* Detail sheet */}
      <ProgramDetailSheet
        program={selectedProgram}
        onClose={() => setSelectedProgram(null)}
        portalSlug={portalSlug}
        matchingKid={selectedProgram ? getMatchingKid(selectedProgram) : null}
      />
    </div>
  );
});

export type { ProgramsBrowserProps };
