import ScrollToTop from "@/components/ScrollToTop";
import { getEventById } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { cache } from "react";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import type { Metadata } from "next";
import { formatTime, formatDuration } from "@/lib/formats";
import {
  ArrowLeft,
  ShareNetwork,
  MapPin,
  Calendar,
  Clock,
  Buildings,
  ArrowRight,
  UsersThree,
  Timer,
} from "@phosphor-icons/react/dist/ssr";
import { resolveCommunityPageRequest } from "../../_surfaces/community/resolve-community-page-request";

export const revalidate = 180;

type Props = {
  params: Promise<{ portal: string; id: string }>;
};

// Cache the event fetch so metadata + page render share one round-trip
const getCachedVolunteerEvent = cache(async (id: number) => {
  return getEventById(id);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, portal: portalSlug } = await params;
  const event = await getCachedVolunteerEvent(parseInt(id, 10));
  const request = await resolveCommunityPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/volunteer/${id}`,
  });

  if (!event) {
    return {
      title: "Opportunity Not Found | HelpATL",
      robots: { index: false, follow: false },
    };
  }

  const activePortalSlug = request?.portal.slug || portalSlug;
  const portalName = request?.portal.name || "HelpATL";
  const venueName = event.venue?.name || "Location TBA";
  const dateObj = parseISO(event.start_date);
  const formattedDate = format(dateObj, "EEEE, MMMM d, yyyy");
  const description = event.description
    ? event.description.slice(0, 160)
    : `Volunteer opportunity: ${event.title} at ${venueName} on ${formattedDate}. Find ways to give back with ${portalName}.`;

  return {
    title: `${event.title} | ${venueName} | ${portalName}`,
    description,
    alternates: {
      canonical: `/${activePortalSlug}/volunteer/${event.id}`,
    },
    openGraph: {
      title: event.title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a short duration string like "3 hrs" from start/end times,
 * falling back to civic_metadata.duration_minutes if times are absent.
 */
function deriveDurationLabel(
  startTime: string | null,
  endTime: string | null,
  durationMinutes?: number | null
): string | null {
  if (startTime && endTime) {
    const full = formatDuration(startTime, endTime);
    if (full) {
      // Convert "3 hours" → "3 hrs", "1 hour" → "1 hr", "1.5 hours" → "1.5 hrs"
      return full.replace("hours", "hrs").replace("hour", "hr");
    }
  }
  if (durationMinutes && durationMinutes > 0) {
    const h = durationMinutes / 60;
    if (h === 1) return "1 hr";
    if (h === Math.floor(h)) return `${h} hrs`;
    return `${h.toFixed(1)} hrs`;
  }
  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function VolunteerDetailPage({ params }: Props) {
  const { id, portal: portalSlug } = await params;
  const event = await getCachedVolunteerEvent(parseInt(id, 10));
  const request = await resolveCommunityPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/volunteer/${id}`,
  });

  if (!event) {
    notFound();
  }

  const activePortalSlug = request?.portal.slug || portalSlug;
  const activePortalName = request?.portal.name || "HelpATL";

  // Typed access to future civic_metadata JSONB field
  const civicMeta = (event as { civic_metadata?: {
    spots_total?: number | null;
    spots_remaining?: number | null;
    duration_minutes?: number | null;
    skill_tags?: string[] | null;
    commitment_level?: string | null;
    signup_url?: string | null;
  } | null }).civic_metadata ?? null;

  // --- Date display ---
  const dateObj = parseISO(event.start_date);
  const dayOfWeek = format(dateObj, "EEE").toUpperCase(); // "SAT"
  const dayNumber = format(dateObj, "d");                 // "14"
  const fullDate = format(dateObj, "EEEE, MMMM d, yyyy");

  // --- Time display ---
  const timeDisplay = event.is_all_day
    ? "All Day"
    : event.start_time
    ? formatTime(event.start_time)
    : "Time TBA";

  const timeRange = event.start_time && event.end_time
    ? `${formatTime(event.start_time)} – ${formatTime(event.end_time)}`
    : timeDisplay;

  // --- Duration ---
  const durationLabel = deriveDurationLabel(
    event.start_time,
    event.end_time,
    civicMeta?.duration_minutes
  );

  // --- Spots ---
  const spotsRemaining = civicMeta?.spots_remaining ?? null;

  // --- Skill tags ---
  const skillTags: string[] = civicMeta?.skill_tags ?? [];
  const showSkillTags = skillTags.length > 0;

  // --- Org name from organization relation or source ---
  const orgName =
    event.organization?.name ??
    (event as { source_name?: string | null }).source_name ??
    null;

  // --- Signup URL ---
  const signupUrl =
    civicMeta?.signup_url ??
    event.ticket_url ??
    event.source_url ??
    null;

  // --- Venue ---
  const venue = event.venue ?? null;
  const venueAddress = venue?.address
    ? `${venue.address}, ${venue.city}, ${venue.state}`
    : venue?.city
    ? `${venue.city}, ${venue.state}`
    : null;

  // Design tokens (inline — this page intentionally doesn't use the dark-mode
  // token system since HelpATL is a light-themed civic portal)
  const GREEN = "#2D6A4F";
  const GREEN_BG = "#E6F3EF";
  const GREEN_BORDER = "#B7DDD0";
  const CORAL = "#D08068";
  const CORAL_BG = "#FEF0E8";
  const BG = "#F5F4F1";
  const CARD_BG = "#FFFFFF";
  const BORDER = "#E5E4E1";
  const TEXT_PRIMARY = "#1A1918";
  const TEXT_SECONDARY = "#6D6C6A";
  const TEXT_MUTED = "#9C9B99";

  return (
    <>
      <ScrollToTop />

      {/* ── Minimal civic header (back + portal name + share) ── */}
      <header
        style={{
          backgroundColor: CARD_BG,
          borderBottom: `1px solid ${BORDER}`,
          height: "56px",
        }}
        className="sticky top-0 z-40 flex items-center justify-between px-4"
      >
        <Link
          href={`/${activePortalSlug}`}
          className="flex items-center gap-1.5 text-sm font-medium"
          style={{ color: TEXT_PRIMARY }}
        >
          <ArrowLeft size={18} weight="bold" />
          Back
        </Link>

        <span className="text-sm font-semibold" style={{ color: TEXT_PRIMARY }}>
          {activePortalName}
        </span>

        <button
          aria-label="Share this opportunity"
          className="flex items-center justify-center w-9 h-9 rounded-full"
          style={{ backgroundColor: GREEN_BG }}
        >
          <ShareNetwork size={18} weight="bold" style={{ color: GREEN }} />
        </button>
      </header>

      <div style={{ backgroundColor: BG }} className="min-h-screen">
        <main className="max-w-2xl mx-auto px-4 py-5 pb-28 space-y-4">

          {/* ── Hero card ─────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{
              backgroundColor: CARD_BG,
              border: `1px solid ${BORDER}`,
            }}
          >
            {/* Date badge + org name row */}
            <div className="flex items-start gap-4">
              {/* Green date badge */}
              <div
                className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl w-14 h-14"
                style={{ backgroundColor: GREEN_BG, border: `1px solid ${GREEN_BORDER}` }}
              >
                <span
                  className="text-2xs font-mono font-bold uppercase tracking-wider leading-none"
                  style={{ color: GREEN }}
                >
                  {dayOfWeek}
                </span>
                <span
                  className="text-2xl font-bold leading-tight tabular-nums"
                  style={{ color: GREEN }}
                >
                  {dayNumber}
                </span>
              </div>

              {/* Org + title */}
              <div className="flex-1 min-w-0">
                {orgName && (
                  <p
                    className="text-xs font-mono font-bold uppercase tracking-wider mb-1"
                    style={{ color: GREEN }}
                  >
                    {orgName}
                  </p>
                )}
                <h1
                  className="text-xl font-semibold leading-snug"
                  style={{ color: TEXT_PRIMARY, fontFamily: "Outfit, sans-serif" }}
                >
                  {event.title}
                </h1>
              </div>
            </div>

            {/* Metadata rows */}
            <div className="space-y-2.5">
              {/* Date + time */}
              <div className="flex items-center gap-2.5">
                <Calendar
                  size={16}
                  weight="duotone"
                  style={{ color: GREEN, flexShrink: 0 }}
                />
                <span className="text-sm" style={{ color: TEXT_SECONDARY }}>
                  {fullDate}
                  {event.start_time && ` · ${timeRange}`}
                </span>
              </div>

              {/* Location — tappable if venue exists */}
              {venue && venueAddress && (
                <Link
                  href={`/${activePortalSlug}?spot=${venue.slug}`}
                  scroll={false}
                  className="flex items-center gap-2.5 group"
                >
                  <MapPin
                    size={16}
                    weight="duotone"
                    style={{ color: GREEN, flexShrink: 0 }}
                  />
                  <span
                    className="text-sm underline-offset-2 group-hover:underline"
                    style={{ color: TEXT_SECONDARY }}
                  >
                    {venueAddress}
                  </span>
                </Link>
              )}

              {/* Duration + commitment level */}
              {(durationLabel || civicMeta?.commitment_level === "beginner") && (
                <div className="flex items-center gap-2.5">
                  <Clock
                    size={16}
                    weight="duotone"
                    style={{ color: GREEN, flexShrink: 0 }}
                  />
                  <span className="text-sm" style={{ color: TEXT_SECONDARY }}>
                    {[
                      durationLabel,
                      civicMeta?.commitment_level === "beginner" ? "Beginner friendly" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              )}
            </div>

            {/* Badges row */}
            {(spotsHasData(spotsRemaining) || durationLabel) && (
              <div className="flex items-center gap-2 flex-wrap">
                {spotsHasData(spotsRemaining) && (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
                    style={{
                      backgroundColor: GREEN_BG,
                      color: GREEN,
                      border: `1px solid ${GREEN_BORDER}`,
                    }}
                  >
                    <UsersThree size={14} weight="fill" />
                    {spotsRemaining} spots left
                  </span>
                )}
                {durationLabel && (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
                    style={{
                      backgroundColor: CORAL_BG,
                      color: CORAL,
                      border: `1px solid #F0C4B0`,
                    }}
                  >
                    <Timer size={14} weight="fill" />
                    {durationLabel}
                  </span>
                )}
              </div>
            )}

            {/* Sign Up CTA */}
            {signupUrl ? (
              <a
                href={signupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-full rounded-xl text-base font-semibold transition-opacity hover:opacity-90 active:opacity-80"
                style={{
                  backgroundColor: GREEN,
                  color: "#FFFFFF",
                  height: "44px",
                  fontFamily: "Outfit, sans-serif",
                }}
              >
                Sign Up to Volunteer
              </a>
            ) : (
              <div
                className="flex items-center justify-center w-full rounded-xl text-base font-semibold"
                style={{
                  backgroundColor: GREEN_BG,
                  color: GREEN,
                  height: "44px",
                  fontFamily: "Outfit, sans-serif",
                  border: `1px solid ${GREEN_BORDER}`,
                }}
              >
                Sign Up to Volunteer
              </div>
            )}
          </div>

          {/* ── About this opportunity ────────────────────────────── */}
          {event.description && (
            <div
              className="rounded-2xl p-5"
              style={{
                backgroundColor: CARD_BG,
                border: `1px solid ${BORDER}`,
              }}
            >
              <h2
                className="text-xs font-mono font-bold uppercase tracking-wider mb-3"
                style={{ color: TEXT_MUTED }}
              >
                About This Opportunity
              </h2>
              <p
                className="text-sm whitespace-pre-wrap"
                style={{
                  color: TEXT_SECONDARY,
                  lineHeight: "1.6",
                  fontFamily: "Outfit, sans-serif",
                }}
              >
                {event.description}
              </p>
            </div>
          )}

          {/* ── Good For tags ─────────────────────────────────────── */}
          {showSkillTags && (
            <div
              className="rounded-2xl p-5"
              style={{
                backgroundColor: CARD_BG,
                border: `1px solid ${BORDER}`,
              }}
            >
              <h2
                className="text-xs font-mono font-bold uppercase tracking-wider mb-3"
                style={{ color: TEXT_MUTED }}
              >
                Good For
              </h2>
              <div className="flex flex-wrap gap-2">
                {skillTags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1.5 rounded-full text-sm font-medium capitalize"
                    style={{
                      backgroundColor: GREEN_BG,
                      color: GREEN,
                      border: `1px solid ${GREEN_BORDER}`,
                    }}
                  >
                    {tag.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Location card ─────────────────────────────────────── */}
          {venue && (
            <Link
              href={`/${activePortalSlug}?spot=${venue.slug}`}
              scroll={false}
              className="flex items-center gap-3 rounded-2xl p-5 group transition-colors"
              style={{
                backgroundColor: CARD_BG,
                border: `1px solid ${BORDER}`,
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: GREEN_BG }}
              >
                <Buildings size={20} weight="duotone" style={{ color: GREEN }} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: TEXT_PRIMARY }}
                >
                  {venue.name}
                </p>
                {venueAddress && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: TEXT_MUTED }}>
                    {venueAddress}
                  </p>
                )}
              </div>
              <ArrowRight
                size={18}
                weight="bold"
                style={{ color: TEXT_MUTED, flexShrink: 0 }}
                className="group-hover:translate-x-0.5 transition-transform"
              />
            </Link>
          )}

          {/* ── More from this group ──────────────────────────────── */}
          {event.organization && (
            <div
              className="rounded-2xl p-5"
              style={{
                backgroundColor: CARD_BG,
                border: `1px solid ${BORDER}`,
              }}
            >
              {/* Section header */}
              <div className="flex items-center justify-between mb-4">
                <h2
                  className="text-xs font-mono font-bold uppercase tracking-wider"
                  style={{ color: TEXT_MUTED }}
                >
                  More From This Group
                </h2>
                <Link
                  href={`/${activePortalSlug}?org=${event.organization.slug}&category=volunteer`}
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: GREEN }}
                >
                  See all
                  <ArrowRight size={12} weight="bold" />
                </Link>
              </div>

              {/* Placeholder cards — populated when org has events */}
              <p
                className="text-sm text-center py-4"
                style={{ color: TEXT_MUTED }}
              >
                More opportunities from {event.organization.name} will appear here.
              </p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

// Helper defined outside JSX to keep the render clean
function spotsHasData(spotsRemaining: number | null): spotsRemaining is number {
  return spotsRemaining !== null;
}
