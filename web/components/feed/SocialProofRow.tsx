"use client";

const AVATAR_PALETTE = [
  "#3a3a4a",
  "#4a3a3a",
  "#3a4a3a",
  "#4a4a3a",
  "#3a3a5a",
];

function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function avatarColor(userId: string): string {
  return AVATAR_PALETTE[hashUserId(userId) % AVATAR_PALETTE.length];
}

function initials(displayName: string | null, username: string): string {
  const name = displayName ?? username;
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

interface Friend {
  user_id: string;
  username: string;
  display_name: string | null;
}

interface SocialProofRowProps {
  friendsGoing?: Friend[];
  goingCount?: number;
  interestedCount?: number;
  className?: string;
}

export function SocialProofRow({
  friendsGoing,
  goingCount = 0,
  interestedCount = 0,
  className,
}: SocialProofRowProps) {
  const hasFriends = friendsGoing && friendsGoing.length > 0;
  const hasGoing = goingCount > 0;
  const hasInterested = interestedCount > 0;

  if (!hasFriends && !hasGoing && !hasInterested) {
    return null;
  }

  const visibleFriends = hasFriends ? friendsGoing.slice(0, 4) : [];

  let goingText: string;
  if (hasFriends) {
    const firstName = friendsGoing[0].display_name ?? friendsGoing[0].username;
    const othersCount = goingCount > 1 ? goingCount - 1 : friendsGoing.length - 1;
    if (othersCount > 0) {
      goingText = `${firstName} and ${othersCount} ${othersCount === 1 ? "other" : "others"} are going`;
    } else {
      goingText = `${firstName} is going`;
    }
  } else {
    goingText = `${goingCount} going`;
  }

  const interestedSuffix = hasInterested ? ` · ${interestedCount} interested` : "";

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      {visibleFriends.length > 0 && (
        <div className="flex items-center" aria-hidden="true">
          {visibleFriends.map((friend, index) => (
            <div
              key={friend.user_id}
              className="w-6 h-6 rounded-full border-2 border-[var(--night)] flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: avatarColor(friend.user_id),
                marginLeft: index === 0 ? 0 : "-0.5rem",
                zIndex: visibleFriends.length - index,
                position: "relative",
              }}
              title={friend.display_name ?? friend.username}
            >
              <span className="text-2xs text-[var(--soft)] font-medium leading-none select-none">
                {initials(friend.display_name, friend.username)}
              </span>
            </div>
          ))}
        </div>
      )}

      <span className={`text-xs leading-tight ${hasFriends ? "text-[var(--soft)]" : "text-[var(--muted)]"}`}>
        {goingText}
        {interestedSuffix && (
          <span className="text-[var(--muted)]">{interestedSuffix}</span>
        )}
      </span>
    </div>
  );
}

export type { SocialProofRowProps };
