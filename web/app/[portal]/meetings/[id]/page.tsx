import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { format, parseISO, isBefore } from "date-fns";
import { getEventById } from "@/lib/supabase";
import { formatTime } from "@/lib/formats";
import ScrollToTop from "@/components/ScrollToTop";
import { resolveDetailPageRequest } from "../../_surfaces/detail/resolve-detail-page-request";
import {
  ArrowLeft,
  ShareNetwork,
  CalendarBlank,
  FileText,
  MapPin,
  Clock,
  CaretRight,
  ChatCircle,
} from "@phosphor-icons/react/dist/ssr";

export const revalidate = 120;

// ─── Types ───────────────────────────────────────────────────────────────────

type AgendaItem = {
  number: number;
  title: string;
  description?: string;
  deadline_date?: string | null;
};

type CivicMetadata = {
  agenda_items?: AgendaItem[];
  comment_deadline?: string | null;
  comment_instructions?: string | null;
  comment_url?: string | null;
};

// ─── Data Fetching ───────────────────────────────────────────────────────────

const getCachedMeetingById = cache(async (id: number) => {
  return getEventById(id);
});

async function getRelatedMeetings(
  currentEventId: number,
  category: string | null
): Promise<Array<{ id: number; title: string; start_date: string; start_time: string | null; venue: { name: string; address: string | null } | null }>> {
  const { supabase } = await import("@/lib/supabase");
  const today = new Date().toISOString().split("T")[0];

  // Filter by civic categories — government or community
  const categoryFilter = category && category !== "community" && category !== "government"
    ? "category.eq.community,category.eq.government"
    : `category.eq.${category ?? "community"},category.eq.government`;

  const { data } = await supabase
    .from("events")
    .select("id, title, start_date, start_time, venue:places(name, address)")
    .neq("id", currentEventId)
    .gte("start_date", today)
    .or(categoryFilter)
    .order("start_date", { ascending: true })
    .limit(3);

  return (data ?? []) as Array<{
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    venue: { name: string; address: string | null } | null;
  }>;
}

// ─── Metadata ────────────────────────────────────────────────────────────────

type Props = { params: Promise<{ portal: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, portal: portalSlug } = await params;
  const event = await getCachedMeetingById(parseInt(id, 10));
  const request = await resolveDetailPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/meetings/${id}`,
  });

  if (!event) {
    return {
      title: "Meeting Not Found | HelpATL",
      robots: { index: false, follow: false },
    };
  }

  const activePortalSlug = request?.portal.slug || portalSlug;
  const portalName = request?.portal.name || "HelpATL";
  const dateObj = parseISO(event.start_date);
  const formattedDate = format(dateObj, "EEEE, MMMM d, yyyy");
  const venueName = event.venue?.name || "TBA";
  const description =
    event.description?.slice(0, 160) ||
    `${event.title} on ${formattedDate} at ${venueName}. Stay informed with ${portalName}.`;

  return {
    title: `${event.title} | ${portalName}`,
    description,
    alternates: {
      canonical: `/${activePortalSlug}/meetings/${event.id}`,
    },
    openGraph: {
      title: event.title,
      description,
      type: "website",
    },
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DateBadge({ dateStr }: { dateStr: string }) {
  const dateObj = parseISO(dateStr);
  const dayName = format(dateObj, "EEE").toUpperCase();
  const dayNum = format(dateObj, "d");

  return (
    <div
      className="flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-xl"
      style={{ backgroundColor: "#1D4ED8" }}
    >
      <span
        className="text-2xs font-mono font-bold uppercase tracking-widest"
        style={{ color: "rgba(255,255,255,0.7)" }}
      >
        {dayName}
      </span>
      <span className="text-2xl font-bold leading-tight" style={{ color: "#ffffff" }}>
        {dayNum}
      </span>
    </div>
  );
}

function MeetingCard({
  event,
  portalSlug,
}: {
  event: NonNullable<Awaited<ReturnType<typeof getEventById>>>;
  portalSlug: string;
}) {
  const civicMeta = (event as { civic_metadata?: CivicMetadata }).civic_metadata ?? {};
  const organizationName = event.organization?.name ?? null;

  const timeDisplay = event.is_all_day
    ? "All Day"
    : event.start_time
    ? (() => {
        const t = formatTime(event.start_time);
        return t;
      })()
    : "Time TBA";

  const dateObj = parseISO(event.start_date);
  const formattedDate = format(dateObj, "EEEE, MMMM d, yyyy");

  const agendaUrl = civicMeta.comment_url ?? event.source_url ?? null;
  const calendarHref = buildCalendarHref(event);

  return (
    <div
      className="rounded-2xl overflow-hidden border"
      style={{ backgroundColor: "#FFFFFF", borderColor: "#E5E4E1" }}
    >
      {/* Hero row */}
      <div className="p-5 flex gap-4">
        <DateBadge dateStr={event.start_date} />
        <div className="flex-1 min-w-0">
          {organizationName && (
            <p
              className="text-xs font-mono font-bold uppercase tracking-wider mb-1"
              style={{ color: "#1D4ED8" }}
            >
              {organizationName}
            </p>
          )}
          <h1
            className="text-xl font-semibold leading-snug"
            style={{ color: "#1A1918" }}
          >
            {event.title}
          </h1>
        </div>
      </div>

      {/* Metadata rows */}
      <div
        className="px-5 pb-2 space-y-2 border-t pt-4"
        style={{ borderColor: "#F0EFEC" }}
      >
        {/* Date + time */}
        <div className="flex items-center gap-2.5">
          <Clock size={16} style={{ color: "#6D6C6A" }} />
          <span className="text-sm" style={{ color: "#1A1918" }}>
            {formattedDate}
            {event.start_time && !event.is_all_day && (
              <span style={{ color: "#6D6C6A" }}> · {timeDisplay}</span>
            )}
          </span>
        </div>

        {/* Location */}
        {event.venue && (
          <div className="flex items-start gap-2.5">
            <MapPin size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#6D6C6A" }} />
            <Link
              href={`/${portalSlug}?venue=${event.venue.slug}`}
              scroll={false}
              className="text-sm hover:underline"
              style={{ color: "#1D4ED8" }}
            >
              {event.venue.name}
              {event.venue.address && (
                <span className="block text-xs mt-0.5" style={{ color: "#6D6C6A" }}>
                  {event.venue.address}
                </span>
              )}
            </Link>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-5 pb-5 pt-4 flex gap-3">
        {/* Add to Calendar */}
        <a
          href={calendarHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#16A34A" }}
        >
          <CalendarBlank size={16} weight="bold" />
          Add to Calendar
        </a>

        {/* View Agenda */}
        {agendaUrl && (
          <a
            href={agendaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-blue-50"
            style={{ color: "#1D4ED8", borderColor: "#1D4ED8", backgroundColor: "transparent" }}
          >
            <FileText size={16} weight="bold" />
            View Agenda
          </a>
        )}
      </div>
    </div>
  );
}

function AgendaPreview({ civicMeta }: { civicMeta: CivicMetadata }) {
  const items = civicMeta.agenda_items ?? [];
  const deadline = civicMeta.comment_deadline;
  const hasActiveDeadline = deadline ? isBefore(new Date(), parseISO(deadline)) : false;

  // Find the item with the active deadline (last item that mentions a deadline)
  const highlightIndex = hasActiveDeadline ? items.length - 1 : -1;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "#FFFFFF", borderColor: "#E5E4E1" }}>
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-base font-semibold" style={{ color: "#1A1918" }}>
            Agenda Preview
          </h2>
        </div>
        <div className="px-5 pb-5">
          <p className="text-sm" style={{ color: "#9C9B99" }}>
            No agenda available yet. Check back closer to the meeting date.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "#FFFFFF", borderColor: "#E5E4E1" }}>
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-base font-semibold" style={{ color: "#1A1918" }}>
          Agenda Preview
        </h2>
      </div>
      <div className="px-5 pb-5 space-y-2">
        {items.map((item, idx) => {
          const isHighlighted = idx === highlightIndex && hasActiveDeadline;
          return (
            <div
              key={item.number}
              className="flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer hover:border-blue-200"
              style={{
                backgroundColor: isHighlighted ? "rgba(208,128,104,0.08)" : "#FAFAF9",
                borderColor: isHighlighted ? "#D08068" : "#E5E4E1",
              }}
            >
              {/* Number badge */}
              <div
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: "#1D4ED8" }}
              >
                {item.number}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug" style={{ color: "#1A1918" }}>
                  {item.title}
                </p>
                {item.description && (
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#6D6C6A" }}>
                    {item.description}
                  </p>
                )}
                {isHighlighted && deadline && (
                  <p className="text-xs mt-1 font-medium" style={{ color: "#D08068" }}>
                    Public comment deadline: {format(parseISO(deadline), "MMM d")}
                  </p>
                )}
              </div>

              <CaretRight size={16} className="flex-shrink-0 mt-0.5" style={{ color: "#9C9B99" }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PublicCommentCard({ civicMeta }: { civicMeta: CivicMetadata }) {
  const deadline = civicMeta.comment_deadline;
  const hasActiveDeadline = deadline ? isBefore(new Date(), parseISO(deadline)) : false;
  const commentUrl = civicMeta.comment_url ?? null;
  const instructions = civicMeta.comment_instructions ?? null;

  if (!hasActiveDeadline && !commentUrl) return null;

  const deadlineLabel = deadline
    ? `Deadline: ${format(parseISO(deadline), "MMMM d, yyyy")}`
    : null;

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ backgroundColor: "rgba(208,128,104,0.08)", borderColor: "#D08068" }}
    >
      {/* Badge */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ backgroundColor: "#D08068", color: "#ffffff" }}
        >
          <ChatCircle size={13} weight="fill" />
          Public Comment Open
        </div>
        {deadlineLabel && hasActiveDeadline && (
          <span className="text-xs" style={{ color: "#D08068" }}>
            {deadlineLabel}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-sm leading-relaxed mb-4" style={{ color: "#1A1918" }}>
        {instructions ||
          "Your voice matters. Submit a written comment to make it part of the official public record before this meeting."}
      </p>

      {/* CTA */}
      {commentUrl && (
        <a
          href={commentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#D08068" }}
        >
          <ChatCircle size={16} weight="bold" />
          Submit Written Comment
        </a>
      )}
    </div>
  );
}

function RelatedMeetingCard({
  meeting,
  portalSlug,
}: {
  meeting: {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    venue: { name: string; address: string | null } | null;
  };
  portalSlug: string;
}) {
  return (
    <Link
      href={`/${portalSlug}/meetings/${meeting.id}`}
      className="flex items-center gap-3 p-3 rounded-xl border transition-colors hover:border-blue-200"
      style={{ backgroundColor: "#FFFFFF", borderColor: "#E5E4E1" }}
    >
      <DateBadge dateStr={meeting.start_date} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug line-clamp-2" style={{ color: "#1A1918" }}>
          {meeting.title}
        </p>
        {meeting.venue && (
          <p className="text-xs mt-0.5" style={{ color: "#6D6C6A" }}>
            {meeting.venue.name}
            {meeting.start_time && ` · ${formatTime(meeting.start_time)}`}
          </p>
        )}
      </div>
      <CaretRight size={16} className="flex-shrink-0" style={{ color: "#9C9B99" }} />
    </Link>
  );
}

// ─── Calendar link builder ────────────────────────────────────────────────────

function buildCalendarHref(event: NonNullable<Awaited<ReturnType<typeof getEventById>>>): string {
  const title = encodeURIComponent(event.title);
  const location = encodeURIComponent(
    [event.venue?.name, event.venue?.address].filter(Boolean).join(", ")
  );

  // Build ISO datetime strings for Google Calendar
  const startDate = event.start_date.replace(/-/g, "");
  let startDt: string;
  let endDt: string;

  if (event.start_time) {
    const [h, m] = event.start_time.split(":").map(Number);
    const endH = event.end_time ? parseInt(event.end_time.split(":")[0], 10) : (h + 2) % 24;
    const endM = event.end_time ? parseInt(event.end_time.split(":")[1], 10) : m;
    startDt = `${startDate}T${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
    endDt = `${startDate}T${String(endH).padStart(2, "0")}${String(endM).padStart(2, "0")}00`;
  } else {
    // All-day
    startDt = startDate;
    endDt = startDate;
  }

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDt}/${endDt}&location=${location}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CivicMeetingDetailPage({ params }: Props) {
  const { id, portal: portalSlug } = await params;
  const eventId = parseInt(id, 10);

  if (isNaN(eventId)) notFound();

  const [event, request] = await Promise.all([
    getCachedMeetingById(eventId),
    resolveDetailPageRequest({
      portalSlug,
      pathname: `/${portalSlug}/meetings/${id}`,
    }),
  ]);

  if (!event) notFound();

  const activePortalSlug = request?.portal.slug ?? portalSlug;

  // Parse civic metadata (future JSONB field, gracefully absent today)
  const civicMeta: CivicMetadata =
    (event as { civic_metadata?: CivicMetadata }).civic_metadata ?? {};

  const hasActiveComment = civicMeta.comment_deadline
    ? isBefore(new Date(), parseISO(civicMeta.comment_deadline))
    : false;

  const relatedMeetings = await getRelatedMeetings(event.id, event.category);

  return (
    <>
      <ScrollToTop />

      {/* Outer page shell — warm cream background */}
      <div className="min-h-screen" style={{ backgroundColor: "#F5F4F1" }}>

        {/* ── Minimal top bar ── */}
        <header
          className="sticky top-0 z-50 flex items-center justify-between px-4 border-b"
          style={{
            height: 56,
            backgroundColor: "#FFFFFF",
            borderColor: "#E5E4E1",
          }}
        >
          {/* Back */}
          <Link
            href={`/${activePortalSlug}`}
            className="flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: "#1A1918" }}
          >
            <ArrowLeft size={18} weight="bold" />
            Back
          </Link>

          {/* Share */}
          <button
            type="button"
            aria-label="Share this meeting"
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-gray-100"
            style={{ color: "#1A1918" }}
          >
            <ShareNetwork size={20} weight="bold" />
          </button>
        </header>

        {/* ── Content ── */}
        <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">

          {/* Meeting hero card */}
          <MeetingCard event={event} portalSlug={activePortalSlug} />

          {/* Description (if present) */}
          {event.description && (
            <div
              className="rounded-2xl border p-5"
              style={{ backgroundColor: "#FFFFFF", borderColor: "#E5E4E1" }}
            >
              <h2 className="text-base font-semibold mb-2" style={{ color: "#1A1918" }}>
                About This Meeting
              </h2>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#6D6C6A" }}>
                {event.description}
              </p>
            </div>
          )}

          {/* Agenda preview */}
          <AgendaPreview civicMeta={civicMeta} />

          {/* Public comment card (only when deadline is active or comment URL exists) */}
          {(hasActiveComment || civicMeta.comment_url) && (
            <PublicCommentCard civicMeta={civicMeta} />
          )}

          {/* Related meetings from this governing body */}
          {relatedMeetings.length > 0 && (
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ backgroundColor: "#FFFFFF", borderColor: "#E5E4E1" }}
            >
              <div className="px-5 pt-5 pb-3">
                <h2 className="text-base font-semibold" style={{ color: "#1A1918" }}>
                  {event.organization?.name
                    ? `From ${event.organization.name}`
                    : "Upcoming Meetings"}
                </h2>
              </div>
              <div className="px-5 pb-5 space-y-2">
                {relatedMeetings.map((m) => (
                  <RelatedMeetingCard key={m.id} meeting={m} portalSlug={activePortalSlug} />
                ))}
              </div>
            </div>
          )}

        </main>
      </div>
    </>
  );
}
