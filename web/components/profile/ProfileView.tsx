"use client";

import { memo, useState, useEffect } from "react";
import Link from "next/link";
import Image from "@/components/SmartImage";
import UserAvatar, { getGradientForString } from "@/components/UserAvatar";
import FriendButton from "@/components/FriendButton";
import {
  EyeSlash,
  Users,
  Globe,
  MapPin,
  ShareNetwork,
  UserPlus,
  NavigationArrow,
} from "@phosphor-icons/react";
import type { PublicProfile, PrivacyMode } from "@/lib/types/profile";
import { PRIVACY_MODES } from "@/lib/types/profile";
import { getInterestColor, getProfileLabel } from "@/lib/profile-utils";

// ─── Privacy badge ─────────────────────────────────────────────────────────

const PRIVACY_ICONS: Record<PrivacyMode, React.ReactNode> = {
  low_key: <EyeSlash size={12} />,
  social: <Users size={12} />,
  open_book: <Globe size={12} />,
};

function PrivacyBadge({ mode }: { mode: PrivacyMode }) {
  const meta = PRIVACY_MODES[mode];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--twilight)] border border-[var(--twilight)]/60 text-[var(--muted)] font-mono text-2xs">
      {PRIVACY_ICONS[mode]}
      {meta.label}
    </span>
  );
}

// ─── Interest pill ──────────────────────────────────────────────────────────

function InterestPill({ interest }: { interest: string }) {
  const color = getInterestColor(interest);
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full font-mono text-xs border"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      {interest}
    </span>
  );
}

// ─── Regular spot card ──────────────────────────────────────────────────────

interface SpotCardProps {
  venue_id: number;
  name: string;
  slug: string | null;
  neighborhood: string | null;
  image_url: string | null;
  portalSlug: string;
}

function SpotCard({ name, slug, neighborhood, image_url, portalSlug }: SpotCardProps) {
  const href = slug ? `/${portalSlug}/venues/${slug}` : null;
  const inner = (
    <div className="flex-shrink-0 w-36 sm:w-full rounded-card overflow-hidden bg-[var(--night)] border border-[var(--twilight)]/40 hover-lift shadow-card-sm sm:flex sm:flex-row">
      <div className="relative h-20 sm:h-auto sm:w-16 sm:flex-shrink-0 bg-[var(--dusk)]">
        {image_url ? (
          <Image
            src={image_url}
            alt={name}
            fill
            className="object-cover"
            sizes="(min-width: 640px) 64px, 144px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <MapPin size={20} weight="duotone" className="text-[var(--muted)]" />
          </div>
        )}
      </div>
      <div className="p-2 sm:flex sm:flex-col sm:justify-center">
        <p className="text-xs font-medium text-[var(--cream)] truncate leading-tight">{name}</p>
        {neighborhood && (
          <p className="text-2xs text-[var(--muted)] truncate mt-0.5 font-mono">{neighborhood}</p>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}

// ─── Share button ───────────────────────────────────────────────────────────

function ShareButton({ username }: { username: string }) {
  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `@${username} on Lost City`, url });
      } catch {
        // user cancelled or not supported
      }
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="p-2 rounded-lg border border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--soft)] hover:text-[var(--cream)] transition-colors"
      aria-label="Share profile"
    >
      <ShareNetwork size={16} />
    </button>
  );
}

// ─── Active hang badge ──────────────────────────────────────────────────────

function ActiveHangInline({
  venueName,
  venueSlug,
  startedAt,
  portalSlug,
}: {
  venueName: string;
  venueSlug: string | null;
  startedAt: string;
  portalSlug: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const elapsed = now - new Date(startedAt).getTime();
  const minutes = Math.floor(elapsed / 60_000);
  const hours = Math.floor(minutes / 60);
  const timeLabel = hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;

  const venueHref = venueSlug ? `/${portalSlug}/spots/${venueSlug}` : null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--neon-green)]/8 border border-[var(--neon-green)]/20 mb-4">
      <span className="relative flex-shrink-0">
        <NavigationArrow size={14} weight="fill" className="text-[var(--neon-green)]" />
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--neon-green)] animate-pulse" />
      </span>
      <span className="text-sm text-[var(--cream)]">
        At{" "}
        {venueHref ? (
          <Link
            href={venueHref}
            className="font-semibold hover:text-[var(--neon-green)] transition-colors"
          >
            {venueName}
          </Link>
        ) : (
          <span className="font-semibold">{venueName}</span>
        )}
      </span>
      <span className="text-xs font-mono text-[var(--soft)] ml-auto">{timeLabel}</span>
    </div>
  );
}

// ─── ProfileView ────────────────────────────────────────────────────────────

export interface ProfileViewProps {
  profile: PublicProfile;
  portalSlug: string;
}

export const ProfileView = memo(function ProfileView({ profile, portalSlug }: ProfileViewProps) {
  const gradient = getGradientForString(profile.username);
  const displayName = getProfileLabel(profile);
  const isOwn = profile.is_own === true;

  const hasInterests = Array.isArray(profile.interests) && profile.interests.length > 0;
  const hasSpots = Array.isArray(profile.regular_spots) && profile.regular_spots.length > 0;
  const hasPortalActivity = Array.isArray(profile.portal_activity) && profile.portal_activity.length > 0;
  const hasCurrentHang = profile.current_hang != null;

  return (
    <div className="min-h-screen bg-[var(--void)]">
      {/* Cover gradient */}
      <div
        className="h-36 sm:h-48 relative"
        style={{
          background: `linear-gradient(135deg, ${gradient.from}33 0%, ${gradient.to}33 50%, var(--void) 100%)`,
        }}
      >
        <div
          className="absolute inset-0 opacity-25"
          style={{
            background: `radial-gradient(circle at 30% 50%, ${gradient.from}22 0%, transparent 55%), radial-gradient(circle at 70% 30%, ${gradient.to}22 0%, transparent 55%)`,
          }}
        />
      </div>

      <div className="max-w-2xl sm:max-w-4xl mx-auto px-4">
        {/* Avatar row */}
        <div className="relative -mt-12 sm:-mt-14 mb-4 flex items-end justify-between">
          {/* Avatar with active hang ring */}
          <div className="relative">
            <div
              className={`rounded-full border-4 ${
                hasCurrentHang
                  ? "border-[var(--neon-green)] shadow-[0_0_12px_var(--neon-green)/30]"
                  : "border-transparent"
              }`}
            >
              <UserAvatar
                src={profile.avatar_url}
                name={displayName}
                size="xl"
                glow
                momentUrl={profile.city_moment_url}
                momentThumbnailUrl={profile.city_moment_thumbnail_url}
                momentPlayMode="auto"
              />
            </div>
            {/* Green dot indicator when hanging */}
            {hasCurrentHang && (
              <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-[var(--neon-green)] border-2 border-[var(--void)]" />
            )}
          </div>

          {/* Actions */}
          <div className="pb-2 flex items-center gap-2">
            {isOwn ? (
              <Link
                href="/settings"
                className="px-4 py-2 rounded-lg border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm hover:border-[var(--coral)] transition-colors"
              >
                Edit Profile
              </Link>
            ) : (
              <>
                <FriendButton
                  targetUserId={profile.id}
                  targetUsername={profile.username}
                />
                <ShareButton username={profile.username} />
              </>
            )}
          </div>
        </div>

        {/* Identity */}
        <div className="mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-[var(--cream)]">{displayName}</h1>
            <PrivacyBadge mode={profile.privacy_mode} />
          </div>
          <p className="font-mono text-sm text-[var(--muted)] mt-0.5">@{profile.username}</p>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-sm text-[var(--soft)] mb-4 max-w-md line-clamp-2">
            {profile.bio}
          </p>
        )}

        {/* Active hang banner */}
        {hasCurrentHang && (
          <ActiveHangInline
            venueName={profile.current_hang!.venue_name}
            venueSlug={profile.current_hang!.venue_slug}
            startedAt={profile.current_hang!.started_at}
            portalSlug={portalSlug}
          />
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 text-sm mb-5 pb-5 border-b border-[var(--twilight)]">
          <div>
            <span className="font-semibold text-[var(--cream)]">{profile.hang_count ?? 0}</span>
            <span className="text-[var(--muted)] ml-1">{profile.hang_count === 1 ? "hang" : "hangs"}</span>
          </div>
          <div>
            <span className="font-semibold text-[var(--cream)]">{profile.friend_count ?? 0}</span>
            <span className="text-[var(--muted)] ml-1">{profile.friend_count === 1 ? "friend" : "friends"}</span>
          </div>
        </div>

        {/* Two-column grid on desktop */}
        <div className="sm:grid sm:grid-cols-[1fr_280px] sm:gap-8">
          {/* Left column — main content */}
          <div>
            {/* Portal Activity */}
            {hasPortalActivity && (
              <section className="mb-6">
                <h2 className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--muted)] mb-3">
                  Active On
                </h2>
                <div className="flex flex-wrap gap-2">
                  {profile.portal_activity!.map((pa) => (
                    <Link
                      key={pa.portal_id}
                      href={`/${pa.portal_slug}`}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--night)] border border-[var(--twilight)]/60 hover:border-[var(--twilight)] transition-colors font-mono text-xs text-[var(--soft)] hover:text-[var(--cream)]"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: "var(--coral)" }}
                      />
                      {pa.portal_name}
                      {pa.hang_count > 0 && (
                        <span className="text-[var(--muted)]">· {pa.hang_count} {pa.hang_count === 1 ? "hang" : "hangs"}</span>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Interests */}
            {hasInterests && (
              <section className="mb-6">
                <h2 className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--muted)] mb-3">
                  Into
                </h2>
                <div className="flex flex-wrap gap-2">
                  {profile.interests!.map((interest) => (
                    <InterestPill key={interest} interest={interest} />
                  ))}
                </div>
              </section>
            )}

            {/* Empty state for restricted profiles */}
            {!hasInterests && !hasSpots && !hasPortalActivity && !isOwn && !profile.bio && !hasCurrentHang && (
              <div className="py-10 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--twilight)]/40 flex items-center justify-center">
                  <UserPlus size={20} className="text-[var(--muted)]" />
                </div>
                <p className="text-sm text-[var(--muted)]">
                  Add {displayName} as a friend to see more.
                </p>
              </div>
            )}
          </div>

          {/* Right column — sidebar (regular spots) */}
          {hasSpots && (
            <aside>
              <section className="mb-8">
                <h2 className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--muted)] mb-3">
                  Regular Spots
                </h2>
                {/* Horizontal scroll on mobile, vertical stack on desktop */}
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide sm:flex-col sm:overflow-x-visible sm:pb-0">
                  {profile.regular_spots!.map((spot) => (
                    <SpotCard
                      key={spot.venue_id}
                      {...spot}
                      portalSlug={portalSlug}
                    />
                  ))}
                </div>
              </section>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
});
