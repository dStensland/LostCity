"use client";

import { memo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";
import {
  useMyHangs,
  useFriendHangs,
  useHotVenues,
  useEndHang,
  useUpdateHang,
} from "@/lib/hooks/useHangs";
import { ActiveHangBanner } from "@/components/hangs/ActiveHangBanner";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import FeedSectionSkeleton from "@/components/feed/FeedSectionSkeleton";
import type { HotVenue, FriendHang, HangVisibility } from "@/lib/types/hangs";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FRIENDS_SHOWN = 5;
const HOT_VENUES_LIMIT = 8;
const ACCENT = "var(--neon-green)";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function venueHref(slug: string | null, id: number): string {
  return slug ? `/spots/${slug}` : `/venues/${id}`;
}

function friendHref(username: string | null, id: string): string {
  return username ? `/profile/${username}` : `/user/${id}`;
}

function truncateNote(note: string | null, max = 60): string | null {
  if (!note) return null;
  return note.length > max ? `${note.slice(0, max).trimEnd()}…` : note;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Single friend row in the friends list. */
const FriendHangRow = memo(function FriendHangRow({
  item,
}: {
  item: FriendHang;
}) {
  const { hang, profile } = item;
  const name = profile.display_name ?? profile.username ?? "Someone";
  const noteExcerpt = truncateNote(hang.note);
  const href = venueHref(hang.venue.slug, hang.venue.id);
  const profileHref = friendHref(profile.username, profile.id);

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--cream)]/[0.03] transition-colors">
      {/* Avatar */}
      <Link href={profileHref} className="flex-shrink-0" aria-label={`View ${name}'s profile`}>
        <div className="w-6 h-6 rounded-full overflow-hidden bg-[var(--twilight)] relative">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={name}
              width={24}
              height={24}
              sizes="24px"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-2xs font-bold text-[var(--muted)]">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </Link>

      {/* Name + venue */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <Link
            href={profileHref}
            className="text-sm font-medium text-[var(--cream)] hover:text-[var(--neon-green)] transition-colors truncate"
          >
            {name}
          </Link>
          <span className="text-xs text-[var(--soft)] flex-shrink-0">at</span>
          <Link
            href={href}
            className="text-xs text-[var(--soft)] hover:text-[var(--cream)] transition-colors truncate"
          >
            {hang.venue.name}
          </Link>
        </div>
        {noteExcerpt && (
          <p className="text-xs text-[var(--muted)] truncate mt-0.5">{noteExcerpt}</p>
        )}
      </div>

      {/* Active pulse dot */}
      <span
        className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--neon-green)] shadow-[0_0_6px_var(--neon-green)]"
        aria-hidden="true"
      />
    </div>
  );
});

/** Small card for a hot venue in the horizontal scroll. */
const HotVenueCard = memo(function HotVenueCard({ venue }: { venue: HotVenue }) {
  const href = venueHref(venue.venue_slug, venue.venue_id);
  const count = venue.active_count;

  return (
    <Link
      href={href}
      className="flex-shrink-0 w-40 snap-start rounded-xl overflow-hidden bg-[var(--night)] border border-[var(--twilight)]/40 hover-lift shadow-card-sm block"
      aria-label={`${venue.venue_name} — ${count} ${count === 1 ? "person" : "people"} here`}
    >
      {/* Image */}
      <div className="relative h-24 bg-[var(--twilight)] overflow-hidden">
        {venue.venue_image_url ? (
          <Image
            src={venue.venue_image_url}
            alt={venue.venue_name}
            fill
            sizes="160px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <MapPin weight="duotone" className="w-8 h-8 text-[var(--muted)]" />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/60 to-transparent pointer-events-none" />
        {/* People count badge */}
        <span className="absolute bottom-2 left-2 text-2xs font-mono text-[var(--neon-green)] bg-[var(--neon-green)]/10 rounded-full px-1.5 py-0.5 border border-[var(--neon-green)]/20">
          {count} {count === 1 ? "person" : "people"}
        </span>
      </div>

      {/* Card body */}
      <div className="px-2.5 py-2">
        <p className="text-xs font-semibold text-[var(--cream)] leading-snug truncate">
          {venue.venue_name}
        </p>
        {venue.neighborhood && (
          <p className="text-2xs text-[var(--muted)] truncate mt-0.5">{venue.neighborhood}</p>
        )}
        {venue.current_event && (
          <p className="text-2xs text-[var(--neon-green)]/70 truncate mt-0.5 font-mono">
            {venue.current_event}
          </p>
        )}
      </div>
    </Link>
  );
});

/** Cold start empty state — subtle CTA, not a block. */
function HangsEmptyState({ portalSlug }: { portalSlug: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-3 rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)]">
      <div
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: "color-mix(in srgb, var(--neon-green) 10%, transparent)" }}
      >
        <MapPin weight="duotone" className="w-4 h-4 text-[var(--neon-green)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--soft)]">
          Check in at a venue to let friends know where you are
        </p>
      </div>
      <Link
        href={`/${portalSlug}?view=find`}
        className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-[var(--neon-green)]/15 border border-[var(--neon-green)]/25 text-xs font-mono font-medium text-[var(--neon-green)] hover:bg-[var(--neon-green)]/25 transition-colors active:scale-95"
      >
        I&apos;m Out
      </Link>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface HangFeedSectionProps {
  portalSlug: string;
}

export const HangFeedSection = memo(function HangFeedSection({
  portalSlug,
}: HangFeedSectionProps) {
  const { user, authState } = useAuth();
  const isAuthenticated = !!user;
  const authResolved = authState !== "initializing";

  const myHangs = useMyHangs();
  const friendHangs = useFriendHangs();
  const hotVenues = useHotVenues(portalSlug, HOT_VENUES_LIMIT);

  const endHang = useEndHang();
  const updateHang = useUpdateHang();

  const handleEnd = useCallback(() => {
    endHang.mutate();
  }, [endHang]);

  const handleVisibilityChange = useCallback(
    (visibility: HangVisibility) => {
      updateHang.mutate({ visibility });
    },
    [updateHang]
  );

  // ── Loading state ────────────────────────────────────────────────────────
  // Show skeleton only while auth is still resolving — avoids flash.
  const isLoading =
    !authResolved ||
    (isAuthenticated && (myHangs.isLoading || friendHangs.isLoading)) ||
    hotVenues.isLoading;

  if (isLoading) {
    return <FeedSectionSkeleton accentColor={ACCENT} minHeight={120} />;
  }

  // ── Data ─────────────────────────────────────────────────────────────────
  const activeHang = myHangs.data?.active ?? null;
  const friends = friendHangs.data?.friends ?? [];
  const venues = hotVenues.data?.venues ?? [];

  const visibleFriends = friends.slice(0, MAX_FRIENDS_SHOWN);
  const overflowCount = friends.length - MAX_FRIENDS_SHOWN;

  // ── Render gate ──────────────────────────────────────────────────────────
  // No content + not logged in = render nothing
  const hasContent =
    activeHang !== null ||
    visibleFriends.length > 0 ||
    venues.length > 0;

  if (!hasContent && !isAuthenticated) {
    return null;
  }

  return (
    <section className="pb-2">
      <FeedSectionHeader
        title="Hangs"
        priority="secondary"
        accentColor={ACCENT}
        icon={<MapPin weight="duotone" className="w-5 h-5" />}
      />

      <div className="space-y-3">
        {/* 1. Active hang banner */}
        {activeHang && (
          <ActiveHangBanner
            hang={activeHang}
            onEnd={handleEnd}
            onChangeVisibility={handleVisibilityChange}
          />
        )}

        {/* 2. Friends' hangs */}
        {visibleFriends.length > 0 && (
          <div className="rounded-xl overflow-hidden border border-[var(--twilight)]/40 bg-[var(--night)]">
            {visibleFriends.map((item) => (
              <FriendHangRow key={item.hang.id} item={item} />
            ))}

            {overflowCount > 0 && (
              <div className="px-3 py-2 border-t border-[var(--twilight)]/30">
                <Link
                  href={`/${portalSlug}?view=friends`}
                  className="text-xs font-mono text-[var(--neon-green)] hover:opacity-80 transition-opacity"
                >
                  +{overflowCount} more {overflowCount === 1 ? "friend" : "friends"} out
                </Link>
              </div>
            )}
          </div>
        )}

        {/* 3. Hot venues carousel */}
        {venues.length > 0 && (
          <div
            className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory"
            role="list"
            aria-label="Hot venues right now"
          >
            {venues.map((venue) => (
              <HotVenueCard key={venue.venue_id} venue={venue} />
            ))}
          </div>
        )}

        {/* 4. Cold start CTA — only when authenticated but nothing to show */}
        {isAuthenticated && !hasContent && (
          <HangsEmptyState portalSlug={portalSlug} />
        )}
      </div>
    </section>
  );
});

export type { HangFeedSectionProps };
