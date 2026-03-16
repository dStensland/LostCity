"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  MapPin,
  Clock,
  CalendarDots,
  Tag,
  Users,
  CurrencyDollar,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import {
  formatAgeRange,
  formatCost,
  formatScheduleDays,
  REGISTRATION_STATUS_LABELS,
  PROGRAM_TYPE_LABELS,
  SEASON_LABELS,
  type ProgramWithVenue,
} from "@/lib/types/programs";
import { type KidProfile } from "@/lib/types/kid-profiles";

// ---- Palette (Afternoon Field) ---------------------------------------------

const CARD_BG = "#FAFAF6";
const SAGE = "#5E7A5E";
const AMBER = "#C48B1D";
const TEXT = "#1E2820";
const MUTED = "#756E63";
const BORDER = "#E0DDD4";
const SAGE_WASH = "#EEF2EE";
const MOSS = "#7A9E7A";

// ---- Types -----------------------------------------------------------------

export interface ProgramDetailSheetProps {
  program: ProgramWithVenue | null;
  onClose: () => void;
  portalSlug: string;
  matchingKid?: KidProfile | null;
}

// ---- Sub-components --------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-plus-jakarta-sans, system-ui, sans-serif)",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase" as const,
        color: AMBER,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "7px 0",
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <div style={{ color: MUTED, flexShrink: 0, paddingTop: 1 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
            fontSize: 11,
            color: MUTED,
            marginBottom: 1,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
            fontSize: 13,
            color: TEXT,
            fontWeight: 500,
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
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

function formatTimeRange(start: string | null, end: string | null): string {
  if (!start) return "";
  if (!end) return start;
  return `${start}–${end}`;
}

// ---- Main component --------------------------------------------------------

export function ProgramDetailSheet({
  program,
  onClose,
  portalSlug: _portalSlug, // eslint-disable-line @typescript-eslint/no-unused-vars
  matchingKid,
}: ProgramDetailSheetProps) {
  // rendered = in the DOM; visible = animation state (entered)
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Open: mount then trigger enter animation
  useEffect(() => {
    if (program) {
      setRendered(true);
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true)),
      );
      return () => cancelAnimationFrame(raf);
    }
  }, [program]);

  // Escape key
  useEffect(() => {
    if (!rendered) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered]);

  // Body scroll lock
  useEffect(() => {
    if (rendered) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [rendered]);

  function handleClose() {
    setVisible(false);
    setTimeout(() => {
      setRendered(false);
      onClose();
    }, 300);
  }

  if (!rendered || !program) return null;

  // Non-null alias so TypeScript narrows correctly inside closures
  const p = program;

  // Derived values
  const isFree = p.cost_amount === null || p.cost_amount === 0;
  const ageLabel = formatAgeRange(p.age_min, p.age_max);
  const costLabel = formatCost(p.cost_amount, p.cost_period);
  const scheduleDays = formatScheduleDays(p.schedule_days);
  const sessionDates = formatSessionDates(p.session_start, p.session_end);
  const timeRange = formatTimeRange(p.schedule_start_time, p.schedule_end_time);
  const scheduleDisplay = [scheduleDays, timeRange].filter(Boolean).join(" · ");

  const status = p.registration_status;
  const statusLabel = REGISTRATION_STATUS_LABELS[status];

  function statusBadgeStyle(): React.CSSProperties {
    if (status === "open" || status === "walk_in")
      return { color: MOSS, backgroundColor: `${MOSS}1A`, border: `1px solid ${MOSS}40` };
    if (status === "upcoming")
      return { color: AMBER, backgroundColor: `${AMBER}1A`, border: `1px solid ${AMBER}40` };
    if (status === "waitlist")
      return { color: "#A0824A", backgroundColor: "#A0824A1A", border: "1px solid #A0824A40" };
    return { color: MUTED, backgroundColor: `${MUTED}12`, border: `1px solid ${MUTED}30` };
  }

  function renderCTA() {
    const base: React.CSSProperties = {
      display: "block",
      width: "100%",
      padding: "14px 20px",
      borderRadius: 12,
      fontFamily: "var(--font-plus-jakarta-sans, system-ui, sans-serif)",
      fontSize: 15,
      fontWeight: 700,
      textAlign: "center",
      textDecoration: "none",
      border: "none",
      cursor: "pointer",
      boxSizing: "border-box",
    };

    if ((status === "open" || status === "walk_in") && p.registration_url) {
      return (
        <a
          href={p.registration_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...base, backgroundColor: SAGE, color: "white" }}
        >
          Register →
        </a>
      );
    }
    if (status === "upcoming") {
      return (
        <button
          disabled
          style={{
            ...base,
            backgroundColor: "transparent",
            color: AMBER,
            border: `2px solid ${AMBER}`,
            cursor: "default",
          }}
        >
          Registration opens soon
        </button>
      );
    }
    if (status === "waitlist" && p.registration_url) {
      return (
        <a
          href={p.registration_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...base, backgroundColor: `${MUTED}18`, color: MUTED }}
        >
          Join Waitlist →
        </a>
      );
    }
    return (
      <button
        disabled
        style={{
          ...base,
          backgroundColor: `${MUTED}12`,
          color: MUTED,
          cursor: "not-allowed",
          border: `1px solid ${BORDER}`,
        }}
      >
        {statusLabel}
      </button>
    );
  }

  // Detail rows
  const detailRows: Array<{ icon: React.ReactNode; label: string; value: string }> = [];

  if (p.venue) {
    const loc = [p.venue.name, p.venue.neighborhood].filter(Boolean).join(" · ");
    if (loc) {
      detailRows.push({ icon: <MapPin size={15} weight="duotone" />, label: "Location", value: loc });
    }
  }
  detailRows.push({ icon: <Users size={15} weight="duotone" />, label: "Age range", value: ageLabel });
  if (scheduleDisplay) {
    detailRows.push({ icon: <Clock size={15} weight="duotone" />, label: "Schedule", value: scheduleDisplay });
  }
  detailRows.push({
    icon: <CurrencyDollar size={15} weight="duotone" />,
    label: "Cost",
    value: costLabel + (p.cost_notes ? `  ·  ${p.cost_notes}` : ""),
  });
  if (p.program_type) {
    detailRows.push({ icon: <Tag size={15} weight="duotone" />, label: "Type", value: PROGRAM_TYPE_LABELS[p.program_type] });
  }
  if (p.season) {
    detailRows.push({ icon: <CalendarDots size={15} weight="duotone" />, label: "Season", value: SEASON_LABELS[p.season] });
  }

  return (
    <>
      {/* Scoped animation styles */}
      <style>{`
        .pds-backdrop {
          position: fixed;
          inset: 0;
          z-index: 200;
          background: rgba(0,0,0,0.5);
          opacity: 0;
          transition: opacity 200ms ease;
        }
        .pds-backdrop.pds-visible {
          opacity: 1;
        }

        /* Mobile: bottom sheet */
        .pds-sheet {
          position: fixed;
          z-index: 201;
          bottom: 0;
          left: 0;
          right: 0;
          max-height: 90vh;
          border-radius: 16px 16px 0 0;
          background: ${CARD_BG};
          overflow-y: auto;
          transform: translateY(100%);
          transition: transform 300ms ease-out;
        }
        .pds-sheet.pds-visible {
          transform: translateY(0);
        }

        /* Desktop: centered dialog */
        @media (min-width: 640px) {
          .pds-sheet {
            top: 50%;
            left: 50%;
            right: auto;
            bottom: auto;
            width: 512px;
            max-width: calc(100vw - 32px);
            max-height: calc(100vh - 64px);
            border-radius: 16px;
            transform: translate(-50%, calc(-50% + 40px));
          }
          .pds-sheet.pds-visible {
            transform: translate(-50%, -50%);
          }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className={`pds-backdrop${visible ? " pds-visible" : ""}`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={p.name}
        className={`pds-sheet${visible ? " pds-visible" : ""}`}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 48, height: 4, borderRadius: 99, backgroundColor: BORDER }} />
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: `1px solid ${BORDER}`,
            backgroundColor: "white",
            color: MUTED,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: 15,
            lineHeight: 1,
            zIndex: 1,
            flexShrink: 0,
          }}
        >
          ✕
        </button>

        {/* Hero image */}
        <div style={{ height: 200, overflow: "hidden", position: "relative", backgroundColor: SAGE_WASH }}>
          {p.venue?.image_url ? (
            <Image
              src={p.venue.image_url}
              alt={p.venue.name ?? "Venue"}
              fill
              sizes="(max-width: 640px) 100vw, 512px"
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(135deg, ${SAGE_WASH} 0%, #D4E4D4 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Venue icon placeholder */}
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <rect x="8" y="14" width="32" height="24" rx="3" stroke={MOSS} strokeWidth="2" fill="none" />
                <circle cx="18" cy="21" r="3" fill={MOSS} opacity="0.6" />
                <path
                  d="M8 30 L16 22 L24 30 L30 24 L40 34"
                  stroke={MOSS}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div style={{ padding: "20px 20px 0" }}>
          {/* Title */}
          <h2
            style={{
              fontFamily: "var(--font-plus-jakarta-sans, system-ui, sans-serif)",
              fontSize: 22,
              fontWeight: 800,
              color: TEXT,
              lineHeight: 1.25,
              margin: "0 0 4px",
              paddingRight: 40,
            }}
          >
            {p.name}
          </h2>

          {/* Provider / venue line */}
          <p
            style={{
              fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
              fontSize: 13,
              color: MUTED,
              margin: "0 0 14px",
            }}
          >
            {p.venue
              ? `at ${p.venue.name}`
              : (p.provider_name ?? "")}
          </p>

          {/* Badges row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {/* Age */}
            <span
              style={{
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                fontSize: 12,
                fontWeight: 600,
                color: SAGE,
                backgroundColor: SAGE_WASH,
                border: `1px solid ${SAGE}30`,
                borderRadius: 20,
                padding: "4px 10px",
              }}
            >
              {ageLabel}
            </span>

            {/* Registration status */}
            <span
              style={{
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 20,
                padding: "4px 10px",
                ...statusBadgeStyle(),
              }}
            >
              {statusLabel}
            </span>

            {/* Kid match */}
            {matchingKid && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                  fontSize: 12,
                  fontWeight: 600,
                  color: matchingKid.color,
                  backgroundColor: `${matchingKid.color}15`,
                  border: `1px solid ${matchingKid.color}30`,
                  borderRadius: 20,
                  padding: "4px 10px",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: matchingKid.color,
                    flexShrink: 0,
                    display: "inline-block",
                  }}
                />
                {matchingKid.nickname}&apos;s match
              </span>
            )}

            {/* Free */}
            {isFree && (
              <span
                style={{
                  fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#3A7D44",
                  backgroundColor: "#3A7D4412",
                  border: "1px solid #3A7D4425",
                  borderRadius: 20,
                  padding: "4px 10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Free
              </span>
            )}

            {/* Cost (if not free) */}
            {!isFree && p.cost_amount !== null && (
              <span
                style={{
                  fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                  fontSize: 12,
                  fontWeight: 600,
                  color: TEXT,
                  backgroundColor: `${BORDER}80`,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 20,
                  padding: "4px 10px",
                }}
              >
                {costLabel}
              </span>
            )}
          </div>

          {/* Session calendar block */}
          {p.session_start && (
            <div style={{ marginBottom: 20 }}>
              <SectionLabel>Session</SectionLabel>
              <div
                style={{
                  backgroundColor: SAGE_WASH,
                  borderRadius: 10,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                    fontSize: 13,
                    color: TEXT,
                    fontWeight: 500,
                  }}
                >
                  {sessionDates}
                </div>
                {scheduleDisplay && (
                  <div style={{ fontFamily: "DM Sans, system-ui, sans-serif", fontSize: 12, color: MUTED }}>
                    {scheduleDisplay}
                  </div>
                )}
                {p.before_after_care && (
                  <span
                    style={{
                      alignSelf: "flex-start",
                      fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                      fontSize: 11,
                      fontWeight: 600,
                      color: AMBER,
                      backgroundColor: `${AMBER}18`,
                      border: `1px solid ${AMBER}35`,
                      borderRadius: 8,
                      padding: "2px 8px",
                    }}
                  >
                    Before/After Care Available
                  </span>
                )}
              </div>
            </div>
          )}

          {/* About */}
          {p.description && (
            <div style={{ marginBottom: 20 }}>
              <SectionLabel>About</SectionLabel>
              <p
                style={{
                  fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                  fontSize: 14,
                  color: TEXT,
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                {p.description}
              </p>
            </div>
          )}

          {/* Details */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>Details</SectionLabel>
            <div>
              {detailRows.map((row, i) => (
                <DetailRow key={i} icon={row.icon} label={row.label} value={row.value} />
              ))}
            </div>
          </div>

          {/* Registration opens notice */}
          {p.registration_opens && status === "upcoming" && (
            <div
              style={{
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                fontSize: 12,
                color: MUTED,
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              Registration opens{" "}
              {new Date(p.registration_opens + "T00:00:00").toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
              })}
            </div>
          )}

          {/* External link note */}
          {p.registration_url && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                fontSize: 11,
                color: MUTED,
                marginBottom: 8,
              }}
            >
              <ArrowSquareOut size={12} />
              Opens in new tab
            </div>
          )}
        </div>

        {/* Sticky CTA */}
        <div
          style={{
            position: "sticky",
            bottom: 0,
            backgroundColor: CARD_BG,
            borderTop: `1px solid ${BORDER}`,
            padding: "12px 20px 20px",
          }}
        >
          {renderCTA()}
        </div>
      </div>
    </>
  );
}

