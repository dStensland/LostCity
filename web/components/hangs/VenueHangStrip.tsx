"use client";

import { memo } from "react";
import Image from "next/image";
import { Users, User } from "@phosphor-icons/react";

interface FriendHang {
  profile: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

interface HangInfo {
  total_count: number;
  friend_hangs: FriendHang[];
  public_count: number;
}

interface VenueHangStripProps {
  venueId: number;
  /** Pre-loaded data to avoid fetch */
  hangInfo?: HangInfo;
  /** Compact for card use, full for detail pages */
  variant?: "compact" | "full";
  className?: string;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Small circular avatar used in the compact avatar stack */
function MiniAvatar({
  src,
  name,
  index,
}: {
  src: string | null | undefined;
  name: string;
  index: number;
}) {
  // Overlap: each avatar after the first pulls left
  const marginClass = index > 0 ? "-ml-1.5" : "";

  return (
    <span
      className={`
        flex-shrink-0 w-5 h-5 rounded-full overflow-hidden
        border-2 border-[var(--night)]
        bg-[var(--twilight)]
        ${marginClass}
      `}
      style={{ zIndex: 10 - index }}
      title={name}
    >
      {src ? (
        <Image
          src={src}
          alt={name}
          width={20}
          height={20}
          sizes="20px"
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="w-full h-full flex items-center justify-center text-[var(--muted)]">
          <User size={10} weight="bold" />
        </span>
      )}
    </span>
  );
}

/** Full-variant: single friend row */
function FriendRow({ hang }: { hang: FriendHang }) {
  const { profile } = hang;
  const name = profile.display_name || profile.username || "Someone";

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden border border-[var(--twilight)]/60 bg-[var(--twilight)]">
        {profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt={name}
            width={28}
            height={28}
            sizes="28px"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-[var(--muted)]">
            <User size={14} weight="bold" />
          </span>
        )}
      </span>
      <span className="text-sm text-[var(--cream)] font-medium">{name}</span>
    </div>
  );
}

// ─── Compact variant ──────────────────────────────────────────────────────────

function CompactStrip({ hangInfo }: { hangInfo: HangInfo }) {
  const { friend_hangs, public_count, total_count } = hangInfo;
  const hasFriends = friend_hangs.length > 0;

  if (total_count === 0) return null;

  if (hasFriends) {
    const visibleFriends = friend_hangs.slice(0, 3);
    const firstFriend = friend_hangs[0].profile;
    const firstName = firstFriend.display_name || firstFriend.username || "A friend";
    const othersCount = total_count - 1;

    return (
      <div className="flex items-center gap-1.5">
        {/* Avatar stack */}
        <div className="flex items-center">
          {visibleFriends.map((fh, idx) => (
            <MiniAvatar
              key={fh.profile.id}
              src={fh.profile.avatar_url}
              name={fh.profile.display_name || fh.profile.username || "?"}
              index={idx}
            />
          ))}
        </div>
        <span className="text-xs text-[var(--neon-green)] font-medium leading-tight">
          {othersCount > 0 ? (
            <>
              <span className="font-semibold">{firstName}</span>
              {" "}+{othersCount} here
            </>
          ) : (
            <>
              <span className="font-semibold">{firstName}</span>
              {" "}is here
            </>
          )}
        </span>
      </div>
    );
  }

  // Public only — no friends
  return (
    <div className="flex items-center gap-1 text-xs text-[var(--neon-green)]">
      <Users size={12} weight="bold" />
      <span>{public_count} {public_count === 1 ? "person" : "people"} here</span>
    </div>
  );
}

// ─── Full variant ─────────────────────────────────────────────────────────────

function FullStrip({ hangInfo }: { hangInfo: HangInfo }) {
  const { friend_hangs, public_count, total_count } = hangInfo;
  const hasFriends = friend_hangs.length > 0;
  const hasPublic = public_count > 0;

  return (
    <div className="bg-[var(--night)] border border-[var(--twilight)]/40 rounded-xl p-3">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <Users size={13} weight="duotone" className="text-[var(--neon-green)]" />
        <span className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--neon-green)]">
          People Here
        </span>
        {total_count > 0 && (
          <span className="ml-auto font-mono text-2xs font-bold text-[var(--neon-green)] bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/20 rounded-full px-1.5 py-0.5">
            {total_count}
          </span>
        )}
      </div>

      {total_count === 0 ? (
        /* Empty state */
        <p className="text-xs text-[var(--muted)] font-mono">
          Be the first to check in!
        </p>
      ) : (
        <div className="space-y-0.5">
          {hasFriends && (
            <div>
              {friend_hangs.map((fh) => (
                <FriendRow key={fh.profile.id} hang={fh} />
              ))}
            </div>
          )}

          {hasPublic && hasFriends && (
            <p className="text-xs text-[var(--soft)] font-mono pt-1">
              +{public_count} {public_count === 1 ? "other" : "others"} here
            </p>
          )}

          {hasPublic && !hasFriends && (
            <p className="text-xs text-[var(--soft)] font-mono">
              {public_count} {public_count === 1 ? "person" : "people"} hanging here right now
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export const VenueHangStrip = memo(function VenueHangStrip({
  hangInfo,
  variant = "compact",
  className,
}: VenueHangStripProps) {
  // If no data provided, render nothing (hook integration is deferred)
  if (!hangInfo) return null;

  const { total_count } = hangInfo;

  // Compact: suppress when empty (inline cards shouldn't show empty state)
  if (variant === "compact" && total_count === 0) return null;

  return (
    <div className={className}>
      {variant === "compact" ? (
        <CompactStrip hangInfo={hangInfo} />
      ) : (
        <FullStrip hangInfo={hangInfo} />
      )}
    </div>
  );
});

export type { VenueHangStripProps, HangInfo, FriendHang };
