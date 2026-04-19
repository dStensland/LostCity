"use client";

import { memo } from "react";
import SmartImage from "@/components/SmartImage";
import { Users, User } from "@phosphor-icons/react";
import type { PlacePlansAggregate } from "@/lib/types/plans";

// Renamed from PlaceHangStrip → PlacePlansStrip
// Types updated: HangInfo → PlacePlansAggregate, FriendHang → friends_here entries

interface FriendEntry {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface PlacePlansStripProps {
  placeId: number;
  /** Pre-loaded data to avoid fetch */
  plansInfo?: PlacePlansAggregate;
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
        <SmartImage
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
function FriendRow({ friend }: { friend: FriendEntry }) {
  const name = friend.display_name ?? "Someone";

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden border border-[var(--twilight)]/60 bg-[var(--twilight)]">
        {friend.avatar_url ? (
          <SmartImage
            src={friend.avatar_url}
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

function CompactStrip({ plansInfo }: { plansInfo: PlacePlansAggregate }) {
  const { friends_here, active_count } = plansInfo;
  const hasFriends = friends_here.length > 0;

  if (active_count === 0) return null;

  if (hasFriends) {
    const visibleFriends = friends_here.slice(0, 3);
    const firstFriend = friends_here[0];
    const firstName = firstFriend.display_name ?? "A friend";
    const othersCount = active_count - 1;

    return (
      <div className="flex items-center gap-1.5">
        {/* Avatar stack */}
        <div className="flex items-center">
          {visibleFriends.map((f, idx) => (
            <MiniAvatar
              key={f.user_id}
              src={f.avatar_url}
              name={f.display_name ?? "?"}
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
      <span>{active_count} {active_count === 1 ? "person" : "people"} here</span>
    </div>
  );
}

// ─── Full variant ─────────────────────────────────────────────────────────────

function FullStrip({ plansInfo }: { plansInfo: PlacePlansAggregate }) {
  const { friends_here, active_count } = plansInfo;
  const hasFriends = friends_here.length > 0;
  const publicCount = active_count - friends_here.length;
  const hasPublic = publicCount > 0;

  return (
    <div className="bg-[var(--night)] border border-[var(--twilight)]/40 rounded-xl p-3">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <Users size={13} weight="duotone" className="text-[var(--neon-green)]" />
        <span className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--neon-green)]">
          People Here
        </span>
        {active_count > 0 && (
          <span className="ml-auto font-mono text-2xs font-bold text-[var(--neon-green)] bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/20 rounded-full px-1.5 py-0.5">
            {active_count}
          </span>
        )}
      </div>

      {active_count === 0 ? (
        /* Empty state */
        <p className="text-xs text-[var(--muted)] font-mono">
          Be the first to check in!
        </p>
      ) : (
        <div className="space-y-0.5">
          {hasFriends && (
            <div>
              {friends_here.map((f) => (
                <FriendRow key={f.user_id} friend={f} />
              ))}
            </div>
          )}

          {hasPublic && hasFriends && (
            <p className="text-xs text-[var(--soft)] font-mono pt-1">
              +{publicCount} {publicCount === 1 ? "other" : "others"} here
            </p>
          )}

          {hasPublic && !hasFriends && (
            <p className="text-xs text-[var(--soft)] font-mono">
              {publicCount} {publicCount === 1 ? "person" : "people"} here right now
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export const PlacePlansStrip = memo(function PlacePlansStrip({
  plansInfo,
  variant = "compact",
  className,
}: PlacePlansStripProps) {
  if (!plansInfo) return null;

  const { active_count } = plansInfo;

  // Compact: suppress when empty (inline cards shouldn't show empty state)
  if (variant === "compact" && active_count === 0) return null;

  return (
    <div className={className}>
      {variant === "compact" ? (
        <CompactStrip plansInfo={plansInfo} />
      ) : (
        <FullStrip plansInfo={plansInfo} />
      )}
    </div>
  );
});

export type { PlacePlansStripProps };
