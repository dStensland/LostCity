import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { format, parseISO } from "date-fns";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import { createServiceClient } from "@/lib/supabase/service";
import { formatTime } from "@/lib/formats";
import { createClient } from "@/lib/supabase/server";
import { getCivicEventHref } from "@/lib/civic-routing";
import { GroupSubscribeButton } from "@/components/civic/GroupSubscribeButton";
import { CivicTabBar } from "@/components/civic/CivicTabBar";
import ScrollToTop from "@/components/ScrollToTop";
import {
  ArrowLeft,
  ShareNetwork,
  CalendarBlank,
  MapPin,
  Clock,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";

export const revalidate = 60;

// ─── Design tokens (light theme) ─────────────────────────────────────────────

const T = {
  BG: "#F5F4F1",
  CARD_BG: "#FFFFFF",
  BORDER: "#E5E4E1",
  TEXT_PRIMARY: "#1A1918",
  TEXT_SECONDARY: "#6D6C6A",
  TEXT_MUTED: "#9C9B99",
  BLUE: "#1D4ED8",
  GREEN: "#2D6A4F",
  BORDER_INNER: "#F0EFEC",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type ChannelType =
  | "jurisdiction"
  | "institution"
  | "topic"
  | "community"
  | "intent"
  | "cause";

type InterestChannel = {
  id: string;
  slug: string;
  name: string;
  channel_type: ChannelType;
  description: string | null;
  portal_id: string | null;
};

type MatchedEvent = {
  id: number;
  title: string;
  category: string | null;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean;
  venue: { name: string; slug: string | null } | null;
};

type UserSubscription = {
  id: string;
  channel_id: string;
  delivery_mode: string;
  digest_frequency: string | null;
} | null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Channel types that use blue accent (governance/institutional).
 * Community/topic/intent/cause use green.
 */
function channelAccentColor(type: ChannelType): string {
  return type === "jurisdiction" || type === "institution" ? T.BLUE : T.GREEN;
}

function channelTypeLabel(type: ChannelType): string {
  const labels: Record<ChannelType, string> = {
    jurisdiction: "Jurisdiction",
    institution: "Institution",
    topic: "Topic",
    community: "Community",
    intent: "Interest",
    cause: "Cause",
  };
  return labels[type] ?? type;
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

const getCachedChannelBySlug = cache(
  async (portalId: string, slug: string): Promise<InterestChannel | null> => {
    const db = createServiceClient();

    const { data, error } = await db
      .from("interest_channels")
      .select("id, slug, name, channel_type, description, portal_id")
      .eq("slug", slug)
      .eq("is_active", true)
      .or(`portal_id.eq.${portalId},portal_id.is.null`)
      .maybeSingle();

    if (error || !data) return null;
    return data as InterestChannel;
  },
);

async function getMatchedEvents(
  channelId: string,
  portalId: string,
): Promise<MatchedEvent[]> {
  const db = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await db
    .from("event_channel_matches")
    .select(
      "event_id, events!inner(id, title, category, start_date, start_time, is_all_day, venue:venues(name, slug))",
    )
    .eq("channel_id", channelId)
    .eq("portal_id", portalId)
    .gte("events.start_date" as never, today)
    .order("events.start_date" as never, { ascending: true })
    .limit(20);

  if (error || !data) return [];

  return (data as Array<{ events: MatchedEvent }>)
    .map((row) => row.events)
    .filter(Boolean);
}

async function getCurrentUserSubscription(
  channelId: string,
): Promise<UserSubscription> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const db = createServiceClient();
    const { data } = await db
      .from("user_channel_subscriptions")
      .select("id, channel_id, delivery_mode, digest_frequency")
      .eq("user_id", user.id)
      .eq("channel_id", channelId)
      .maybeSingle();

    return (data as UserSubscription) ?? null;
  } catch {
    return null;
  }
}

// ─── Metadata ────────────────────────────────────────────────────────────────

type Props = { params: Promise<{ portal: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, portal: portalSlug } = await params;
  const portal = await getCachedPortalBySlug(portalSlug);

  if (!portal) {
    return { title: "Group Not Found", robots: { index: false, follow: false } };
  }

  const channel = await getCachedChannelBySlug(portal.id, slug);

  if (!channel) {
    return {
      title: `Group Not Found | ${portal.name}`,
      robots: { index: false, follow: false },
    };
  }

  const description =
    channel.description?.slice(0, 160) ||
    `Follow ${channel.name} on ${portal.name} to stay informed about local events and civic activity.`;

  return {
    title: `${channel.name} | ${portal.name}`,
    description,
    alternates: {
      canonical: `/${portalSlug}/groups/${slug}`,
    },
    openGraph: {
      title: channel.name,
      description,
      type: "website",
    },
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EventDateBadge({
  dateStr,
  accentColor,
}: {
  dateStr: string;
  accentColor: string;
}) {
  const dateObj = parseISO(dateStr);
  const dayName = format(dateObj, "EEE").toUpperCase();
  const dayNum = format(dateObj, "d");

  return (
    <div
      className="flex-shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl"
      style={{ backgroundColor: accentColor }}
    >
      <span
        className="text-2xs font-mono font-bold uppercase tracking-widest"
        style={{ color: "#ffffff" }}
      >
        {dayName}
      </span>
      <span
        className="text-xl font-bold leading-tight"
        style={{ color: "#ffffff" }}
      >
        {dayNum}
      </span>
    </div>
  );
}

function MatchedEventCard({
  event,
  portalSlug,
  accentColor,
  vertical,
}: {
  event: MatchedEvent;
  portalSlug: string;
  accentColor: string;
  vertical: string | null;
}) {
  const timeDisplay = event.is_all_day
    ? "All Day"
    : event.start_time
    ? formatTime(event.start_time)
    : "Time TBA";

  const formattedDate = format(parseISO(event.start_date), "EEEE, MMMM d");
  const href = getCivicEventHref({ id: event.id, category: event.category }, portalSlug, vertical)
    ?? `/${portalSlug}?event=${event.id}`;

  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 rounded-xl border transition-colors hover:border-blue-200"
      style={{ backgroundColor: "#FAFAF9", borderColor: T.BORDER }}
    >
      <EventDateBadge dateStr={event.start_date} accentColor={accentColor} />

      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium leading-snug line-clamp-2"
          style={{ color: T.TEXT_PRIMARY }}
        >
          {event.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-xs" style={{ color: T.TEXT_SECONDARY }}>
            {formattedDate}
          </span>
          {event.start_time && !event.is_all_day && (
            <>
              <span style={{ color: T.TEXT_MUTED }}>·</span>
              <span className="text-xs" style={{ color: T.TEXT_SECONDARY }}>
                {timeDisplay}
              </span>
            </>
          )}
        </div>
        {event.venue && (
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin size={11} style={{ color: T.TEXT_MUTED }} />
            <span className="text-xs" style={{ color: T.TEXT_MUTED }}>
              {event.venue.name}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function GroupDetailPage({ params }: Props) {
  const { slug, portal: portalSlug } = await params;

  const portal = await getCachedPortalBySlug(portalSlug);
  if (!portal) notFound();

  const channel = await getCachedChannelBySlug(portal.id, slug);
  if (!channel) notFound();

  const [matchedEvents, userSubscription] = await Promise.all([
    getMatchedEvents(channel.id, portal.id),
    getCurrentUserSubscription(channel.id),
  ]);

  const accentColor = channelAccentColor(channel.channel_type as ChannelType);
  const typeLabel = channelTypeLabel(channel.channel_type as ChannelType);

  const vertical = getPortalVertical(portal);
  const isCommunity = vertical === "community";
  const actLabel =
    typeof portal.settings?.nav_labels === "object" &&
    portal.settings.nav_labels !== null &&
    typeof (portal.settings.nav_labels as Record<string, unknown>).feed === "string"
      ? (portal.settings.nav_labels as Record<string, string>).feed
      : "Act";

  return (
    <>
      <ScrollToTop />

      <div className="min-h-screen" style={{ backgroundColor: T.BG }}>

        {/* ── Sticky top bar ── */}
        <header
          className="sticky top-0 z-50 flex items-center justify-between px-4 border-b"
          style={{
            height: 56,
            backgroundColor: T.CARD_BG,
            borderColor: T.BORDER,
          }}
        >
          <Link
            href={`/${portalSlug}/groups`}
            className="flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: T.TEXT_PRIMARY }}
          >
            <ArrowLeft size={18} weight="bold" />
            Groups
          </Link>

          <span
            className="text-sm font-semibold absolute left-1/2 -translate-x-1/2"
            style={{ color: T.TEXT_PRIMARY }}
          >
            {portal.name}
          </span>

          <button
            type="button"
            aria-label="Share this group"
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-black/5"
            style={{ color: T.TEXT_PRIMARY }}
          >
            <ShareNetwork size={20} weight="bold" />
          </button>
        </header>

        {/* ── Content ── */}
        <main className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-28">

          {/* ── Channel hero card ── */}
          <div
            className="rounded-2xl overflow-hidden border"
            style={{ backgroundColor: T.CARD_BG, borderColor: T.BORDER }}
          >
            <div className="p-5">
              {/* Type label + icon row */}
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: `${accentColor}14`,
                  }}
                >
                  <UsersThree size={13} style={{ color: accentColor }} />
                  <span
                    className="text-2xs font-mono font-bold uppercase tracking-wider"
                    style={{ color: accentColor }}
                  >
                    {typeLabel}
                  </span>
                </div>
              </div>

              {/* Channel name */}
              <h1
                className="text-2xl font-semibold leading-snug mb-2"
                style={{ color: T.TEXT_PRIMARY }}
              >
                {channel.name}
              </h1>

              {/* Description */}
              <p
                className={`text-sm leading-relaxed ${!channel.description ? "italic" : ""}`}
                style={{ color: T.TEXT_SECONDARY }}
              >
                {channel.description || "Follow this channel to stay updated"}
              </p>
            </div>

            {/* Subscribe action */}
            <div
              className="px-5 pb-5 pt-1 border-t flex items-center justify-between"
              style={{ borderColor: T.BORDER_INNER }}
            >
              <p className="text-xs" style={{ color: T.TEXT_MUTED }}>
                Follow to surface matched events in your feed
              </p>
              <GroupSubscribeButton
                channelId={channel.id}
                portalSlug={portalSlug}
                initialSubscribed={Boolean(userSubscription)}
                initialSubscriptionId={userSubscription?.id ?? null}
              />
            </div>
          </div>

          {/* ── Upcoming events section ── */}
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ backgroundColor: T.CARD_BG, borderColor: T.BORDER }}
          >
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <h2
                className="text-base font-semibold"
                style={{ color: T.TEXT_PRIMARY }}
              >
                Upcoming Events
              </h2>
              {matchedEvents.length > 0 && (
                <div className="flex items-center gap-1">
                  <CalendarBlank size={14} style={{ color: T.TEXT_MUTED }} />
                  <span className="text-xs" style={{ color: T.TEXT_MUTED }}>
                    {matchedEvents.length} upcoming
                  </span>
                </div>
              )}
            </div>

            <div className="px-5 pb-5">
              {matchedEvents.length > 0 ? (
                <div className="space-y-2">
                  {matchedEvents.map((event) => (
                    <MatchedEventCard
                      key={event.id}
                      event={event}
                      portalSlug={portalSlug}
                      accentColor={accentColor}
                      vertical={vertical}
                    />
                  ))}
                </div>
              ) : (
                <div
                  className="rounded-xl border p-5 text-center"
                  style={{ borderColor: T.BORDER, backgroundColor: "#FAFAF9" }}
                >
                  <Clock size={24} className="mx-auto mb-2" style={{ color: T.TEXT_MUTED }} />
                  <p className="text-sm" style={{ color: T.TEXT_SECONDARY }}>
                    No upcoming events matched to this group yet.
                  </p>
                  <p className="text-xs mt-1" style={{ color: T.TEXT_MUTED }}>
                    Events will appear here as they&apos;re added.
                  </p>
                </div>
              )}
            </div>
          </div>

        </main>
      </div>

      {/* ── CivicTabBar (community vertical only) ── */}
      {isCommunity && (
        <>
          <Suspense fallback={null}>
            <CivicTabBar portalSlug={portalSlug} actLabel={actLabel} />
          </Suspense>
          <div className="h-14 sm:hidden" />
        </>
      )}
    </>
  );
}
