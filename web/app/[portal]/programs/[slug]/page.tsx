import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import ScrollToTop from "@/components/ScrollToTop";
import {
  DetailHero,
  InfoCard,
  MetadataGrid,
  SectionHeader,
  DetailStickyBar,
} from "@/components/detail";
import { RegistrationBadge } from "@/components/family/RegistrationBadge";
import {
  formatAgeRange,
  formatCost,
  formatScheduleDays,
  PROGRAM_TYPE_LABELS,
  SEASON_LABELS,
  type ProgramWithVenue,
  type Program,
} from "@/lib/types/programs";
import { ISO_DAY_LABELS } from "@/lib/types/programs";
import { resolveDetailPageRequest } from "../../_surfaces/detail/resolve-detail-page-request";

export const revalidate = 120;

type Props = {
  params: Promise<{ portal: string; slug: string }>;
};

// Venue type from Supabase query — extends base with extra fields
type ProgramVenueFull = NonNullable<ProgramWithVenue["venue"]> & {
  state: string | null;
  slug: string | null;
  phone: string | null;
  website: string | null;
};

type ProgramDetail = Program & {
  venue: ProgramVenueFull | null;
};

async function getProgramBySlug(
  slug: string,
  portalSlug: string
): Promise<ProgramDetail | null> {
  const supabase = await createClient();

  const { data: portalRow } = await supabase
    .from("portals")
    .select("id")
    .eq("slug", portalSlug)
    .eq("is_active", true)
    .maybeSingle();

  const portal = portalRow as { id: string } | null;
  if (!portal) return null;

  const { data, error } = await supabase
    .from("programs")
    .select(
      `
      id,
      portal_id,
      source_id,
      place_id,
      name,
      slug,
      description,
      program_type,
      provider_name,
      age_min,
      age_max,
      season,
      session_start,
      session_end,
      schedule_days,
      schedule_start_time,
      schedule_end_time,
      cost_amount,
      cost_period,
      cost_notes,
      registration_status,
      registration_opens,
      registration_closes,
      registration_url,
      before_after_care,
      lunch_included,
      tags,
      status,
      created_at,
      updated_at,
      venue:places(id, name, neighborhood, address, city, state, lat, lng, image_url, slug, phone, website)
    `
    )
    .eq("slug", slug)
    .eq("portal_id", portal.id)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as ProgramDetail;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, portal: portalSlug } = await params;
  const [program, request] = await Promise.all([
    getProgramBySlug(slug, portalSlug),
    resolveDetailPageRequest({
      portalSlug,
      pathname: `/${portalSlug}/programs/${slug}`,
    }),
  ]);

  if (!program) {
    return {
      title: "Program Not Found | Lost City",
      robots: { index: false, follow: false },
    };
  }

  const portalName = request?.portal.name || "Lost City: Family";
  const activePortalSlug = request?.portal.slug || portalSlug;
  const ageLabel = formatAgeRange(program.age_min, program.age_max);
  const description = program.description
    ? program.description.slice(0, 160)
    : `${program.name} — ${ageLabel}. ${program.provider_name ? `Offered by ${program.provider_name}.` : ""} Discover family programs with ${portalName}.`;

  return {
    title: `${program.name} | ${portalName}`,
    description,
    alternates: {
      canonical: `/${activePortalSlug}/programs/${slug}`,
    },
  };
}

function formatDateShort(dateStr: string): string {
  return format(parseISO(dateStr + "T00:00:00"), "MMM d, yyyy");
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

// ---- Badge helpers -------------------------------------------------------

const SAGE = "#5E7A5E";
const AMBER = "#C48B1D";
const CREAM_CANVAS = "#F0EDE4";
const DARK_FOREST = "#1E2820";
const WARM_STONE = "#756E63";
const SKY = "#78B7D0";

function AgeRangeBadge({ min, max }: { min: number | null; max: number | null }) {
  if (min === null && max === null) return null;
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
      style={{
        backgroundColor: `${SAGE}18`,
        borderColor: `${SAGE}40`,
        color: SAGE,
      }}
    >
      {formatAgeRange(min, max)}
    </span>
  );
}

function TypeBadge({ type }: { type: Program["program_type"] }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
      style={{
        backgroundColor: `${WARM_STONE}15`,
        borderColor: `${WARM_STONE}35`,
        color: WARM_STONE,
      }}
    >
      {PROGRAM_TYPE_LABELS[type]}
    </span>
  );
}

function CostBadge({ amount, period, notes }: { amount: number | null; period: Program["cost_period"]; notes: string | null }) {
  const isFree = amount === null || amount === 0;
  const label = formatCost(amount, period);
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
      style={
        isFree
          ? { backgroundColor: "#5E7A5E18", borderColor: "#5E7A5E40", color: "#5E7A5E" }
          : { backgroundColor: `${AMBER}15`, borderColor: `${AMBER}35`, color: AMBER }
      }
    >
      {label}
      {notes && !isFree ? ` · ${notes}` : ""}
    </span>
  );
}

// ---- Main page -----------------------------------------------------------

export default async function ProgramDetailPage({ params }: Props) {
  const { slug, portal: portalSlug } = await params;
  const [program, request] = await Promise.all([
    getProgramBySlug(slug, portalSlug),
    resolveDetailPageRequest({
      portalSlug,
      pathname: `/${portalSlug}/programs/${slug}`,
    }),
  ]);

  if (!program) {
    notFound();
  }

  const portalName = request?.portal.name || "Lost City: Family";
  const activePortalSlug = request?.portal.slug || portalSlug;

  const hasImage = !!program.venue?.image_url;
  const imageUrl = program.venue?.image_url ?? null;

  const scheduleDays = formatScheduleDays(program.schedule_days);
  const hasSchedule = !!(
    scheduleDays ||
    program.schedule_start_time ||
    program.session_start
  );

  const metadataItems = [
    ...(program.season ? [{ label: "Season", value: SEASON_LABELS[program.season] ?? program.season }] : []),
    ...(program.session_start
      ? [
          {
            label: "Session",
            value: program.session_end && program.session_end !== program.session_start
              ? `${formatDateShort(program.session_start)} – ${formatDateShort(program.session_end)}`
              : formatDateShort(program.session_start),
          },
        ]
      : []),
    ...(program.registration_closes
      ? [
          {
            label: "Reg. closes",
            value: formatDateShort(program.registration_closes),
            color: "var(--coral)" as const,
          },
        ]
      : []),
  ];

  const hasBonusDetails = program.before_after_care || program.lunch_included;

  const ctaHref = program.registration_url ?? null;
  const ctaLabel =
    program.registration_status === "open" || program.registration_status === "walk_in"
      ? "Register Now"
      : program.registration_status === "waitlist"
      ? "Join Waitlist"
      : program.registration_status === "upcoming"
      ? "Get Notified"
      : null;

  return (
    <>
      <ScrollToTop />

      <div
        className="min-h-screen"
        data-theme="light"
        style={{ backgroundColor: CREAM_CANVAS, color: DARK_FOREST }}
      >
        <main className="max-w-2xl mx-auto px-4 py-4 sm:py-6 pb-28 space-y-4 sm:space-y-5">
          {/* Hero */}
          <DetailHero
            mode={hasImage ? "image" : "fallback"}
            imageUrl={imageUrl}
            title={program.name}
            subtitle={program.provider_name ?? program.venue?.name ?? undefined}
            categoryColor={SAGE}
            backFallbackHref={`/${activePortalSlug}`}
            portrait
            badge={
              <div className="flex items-center gap-2 flex-wrap">
                <TypeBadge type={program.program_type} />
                <RegistrationBadge status={program.registration_status} />
              </div>
            }
          />

          {/* Quick metadata bar */}
          <div
            className="flex flex-wrap gap-2 px-1"
          >
            <AgeRangeBadge min={program.age_min} max={program.age_max} />
            <CostBadge amount={program.cost_amount} period={program.cost_period} notes={program.cost_notes} />
          </div>

          {/* Main content card */}
          <InfoCard accentColor={SAGE}>
            {/* Dates / season metadata */}
            {metadataItems.length > 0 && (
              <>
                <MetadataGrid items={metadataItems} className="mb-5" />
              </>
            )}

            {/* Schedule section */}
            {hasSchedule && (
              <>
                <SectionHeader title="Schedule" variant="inline" />
                <div
                  className="rounded-lg p-3 mb-5 space-y-1"
                  style={{ backgroundColor: `${SAGE}10`, border: `1px solid ${SAGE}25` }}
                >
                  {scheduleDays && (
                    <p className="text-sm font-medium" style={{ color: DARK_FOREST }}>
                      {scheduleDays}
                    </p>
                  )}
                  {program.schedule_start_time && (
                    <p className="text-sm" style={{ color: WARM_STONE }}>
                      {formatTime12h(program.schedule_start_time)}
                      {program.schedule_end_time ? ` – ${formatTime12h(program.schedule_end_time)}` : ""}
                    </p>
                  )}
                  {program.schedule_days && program.schedule_days.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                        const active = program.schedule_days!.includes(d);
                        return (
                          <span
                            key={d}
                            className="w-8 h-7 flex items-center justify-center rounded text-xs font-medium"
                            style={
                              active
                                ? { backgroundColor: SAGE, color: "#fff" }
                                : { backgroundColor: `${WARM_STONE}15`, color: WARM_STONE }
                            }
                          >
                            {ISO_DAY_LABELS[d]?.slice(0, 1)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Description */}
            {program.description && (
              <>
                <SectionHeader title="About this program" variant={metadataItems.length > 0 || hasSchedule ? "divider" : "inline"} />
                <p
                  className="text-sm leading-relaxed whitespace-pre-wrap mb-5"
                  style={{ color: WARM_STONE }}
                >
                  {program.description}
                </p>
              </>
            )}

            {/* Bonus details */}
            {hasBonusDetails && (
              <>
                <SectionHeader title="Included" variant="divider" />
                <div className="flex flex-wrap gap-2 mb-5">
                  {program.before_after_care && (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                      style={{ backgroundColor: `${SKY}15`, borderColor: `${SKY}35`, color: SKY }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Before &amp; after care
                    </span>
                  )}
                  {program.lunch_included && (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                      style={{ backgroundColor: `${AMBER}15`, borderColor: `${AMBER}35`, color: AMBER }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Lunch included
                    </span>
                  )}
                </div>
              </>
            )}

            {/* Tags */}
            {program.tags && program.tags.length > 0 && (
              <>
                <SectionHeader title="Tags" variant="divider" />
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {program.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-full text-xs font-medium border"
                      style={{ backgroundColor: `${WARM_STONE}10`, borderColor: `${WARM_STONE}25`, color: WARM_STONE }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </>
            )}

            {/* Venue */}
            {program.venue && (
              <>
                <SectionHeader title="Location" variant="divider" />
                <div className="mb-5">
                  {program.venue.slug ? (
                    <Link
                      href={`/${activePortalSlug}?venue=${program.venue.slug}`}
                      scroll={false}
                      className="block p-3 rounded-lg border transition-all hover:opacity-80 group"
                      style={{ borderColor: `${WARM_STONE}30`, backgroundColor: `${WARM_STONE}08` }}
                    >
                      <p className="text-sm font-semibold group-hover:opacity-80 transition-opacity" style={{ color: DARK_FOREST }}>
                        {program.venue.name}
                        <svg className="inline-block w-3.5 h-3.5 ml-1" style={{ color: WARM_STONE }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </p>
                      {(program.venue.address || program.venue.neighborhood) && (
                        <p className="text-xs mt-0.5" style={{ color: WARM_STONE }}>
                          {[program.venue.address, program.venue.city, program.venue.state].filter(Boolean).join(", ")}
                          {program.venue.neighborhood ? ` · ${program.venue.neighborhood}` : ""}
                        </p>
                      )}
                    </Link>
                  ) : (
                    <div className="p-3 rounded-lg border" style={{ borderColor: `${WARM_STONE}30`, backgroundColor: `${WARM_STONE}08` }}>
                      <p className="text-sm font-semibold" style={{ color: DARK_FOREST }}>{program.venue.name}</p>
                      {(program.venue.address || program.venue.neighborhood) && (
                        <p className="text-xs mt-0.5" style={{ color: WARM_STONE }}>
                          {[program.venue.address, program.venue.city, program.venue.state].filter(Boolean).join(", ")}
                          {program.venue.neighborhood ? ` · ${program.venue.neighborhood}` : ""}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Registration window */}
            {(program.registration_opens || program.registration_closes) && (
              <>
                <SectionHeader title="Registration" variant="divider" />
                <div
                  className="rounded-lg p-3 mb-5 flex flex-col gap-1"
                  style={{ backgroundColor: `${AMBER}10`, border: `1px solid ${AMBER}25` }}
                >
                  {program.registration_opens && (
                    <p className="text-xs" style={{ color: WARM_STONE }}>
                      <span className="font-medium">Opens:</span>{" "}
                      {formatDateShort(program.registration_opens)}
                    </p>
                  )}
                  {program.registration_closes && (
                    <p className="text-xs" style={{ color: WARM_STONE }}>
                      <span className="font-medium">Closes:</span>{" "}
                      {formatDateShort(program.registration_closes)}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Inline register button — fallback when no sticky CTA applies */}
            {program.registration_url && !ctaLabel && (
              <a
                href={program.registration_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ backgroundColor: SAGE, color: "#fff" }}
              >
                Visit program site
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}

            {/* No registration URL — contact venue */}
            {!program.registration_url && program.venue && (
              <div
                className="p-3 rounded-lg border text-sm"
                style={{ backgroundColor: `${WARM_STONE}08`, borderColor: `${WARM_STONE}25`, color: WARM_STONE }}
              >
                <span className="font-medium" style={{ color: DARK_FOREST }}>To register,</span>{" "}
                contact {program.venue.name} directly
                {program.venue.phone ? ` at ${program.venue.phone}` : ""}
                {program.venue.website ? (
                  <>
                    {" or "}
                    <a
                      href={program.venue.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:opacity-70 transition-opacity"
                      style={{ color: SAGE }}
                    >
                      visit their website
                    </a>
                  </>
                ) : ""}
                .
              </div>
            )}
          </InfoCard>
        </main>
      </div>

      {/* Sticky CTA */}
      {ctaLabel && ctaHref && (
        <DetailStickyBar
          primaryColor={SAGE}
          primaryAction={{
            label: ctaLabel,
            href: ctaHref,
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            ),
          }}
        />
      )}
    </>
  );
}
