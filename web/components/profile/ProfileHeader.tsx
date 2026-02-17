"use client";

import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import { getGradientForString } from "@/components/UserAvatar";
import FriendButton from "@/components/FriendButton";
import type { RelationshipStatus } from "@/lib/hooks/useFriendship";
import { format } from "date-fns";

interface ProfileHeaderProps {
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    location: string | null;
    website: string | null;
    created_at: string;
  };
  isOwnProfile: boolean;
  followerCount: number;
  followingCount: number;
  eventsAttended: number;
  initialRelationship: RelationshipStatus;
}

export default function ProfileHeader({
  profile,
  isOwnProfile,
  followerCount,
  followingCount,
  eventsAttended,
  initialRelationship,
}: ProfileHeaderProps) {
  const gradient = getGradientForString(profile.username);

  return (
    <div className="relative">
      {/* Cover gradient */}
      <div
        className="h-40 md:h-52"
        style={{
          background: `linear-gradient(135deg, ${gradient.from}33 0%, ${gradient.to}33 50%, var(--void) 100%)`,
        }}
      >
        {/* Subtle pattern overlay */}
        <div
          className="absolute inset-0 h-40 md:h-52 opacity-30"
          style={{
            background: `radial-gradient(circle at 30% 50%, ${gradient.from}22 0%, transparent 50%), radial-gradient(circle at 70% 30%, ${gradient.to}22 0%, transparent 50%)`,
          }}
        />
      </div>

      {/* Profile info section */}
      <div className="max-w-3xl mx-auto px-4">
        {/* Avatar - overlaps cover */}
        <div className="relative -mt-16 md:-mt-20 mb-4 flex items-end justify-between">
          <div className="relative">
            <div className="rounded-full border-4 border-[var(--void)] bg-[var(--void)]">
              <UserAvatar
                src={profile.avatar_url}
                name={profile.display_name || profile.username}
                size="xl"
                glow
              />
            </div>
            {isOwnProfile && (
              <Link
                href="/settings?tab=profile"
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[var(--dusk)] border-2 border-[var(--void)] flex items-center justify-center text-[var(--coral)] hover:bg-[var(--twilight)] transition-colors"
                aria-label="Edit avatar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
            )}
          </div>

          {/* Action button */}
          <div className="pb-2">
            {isOwnProfile ? (
              <Link
                href="/settings?tab=profile"
                className="px-4 py-2 rounded-lg border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm hover:border-[var(--coral)] transition-colors"
              >
                Edit Profile
              </Link>
            ) : (
              <FriendButton
                targetUserId={profile.id}
                targetUsername={profile.username}
                initialRelationship={initialRelationship}
              />
            )}
          </div>
        </div>

        {/* Identity */}
        <div className="mb-4">
          <h1 className="text-2xl md:text-3xl font-semibold text-[var(--cream)]">
            {profile.display_name || profile.username}
          </h1>
          <p className="font-mono text-sm text-[var(--muted)]">@{profile.username}</p>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-[var(--soft)] text-sm mb-4 max-w-lg">{profile.bio}</p>
        )}

        {/* Stats row */}
        <div className="flex flex-wrap gap-4 text-sm mb-3">
          <Link
            href={`/profile/${profile.username}/followers`}
            className="hover:text-[var(--cream)] transition-colors"
          >
            <span className="font-semibold text-[var(--cream)]">{followerCount}</span>
            <span className="text-[var(--muted)] ml-1">followers</span>
          </Link>
          <span className="text-[var(--twilight)]">·</span>
          <Link
            href={`/profile/${profile.username}/following`}
            className="hover:text-[var(--cream)] transition-colors"
          >
            <span className="font-semibold text-[var(--cream)]">{followingCount}</span>
            <span className="text-[var(--muted)] ml-1">following</span>
          </Link>
          {eventsAttended > 0 && (
            <>
              <span className="text-[var(--twilight)]">·</span>
              <div>
                <span className="font-semibold text-[var(--cream)]">{eventsAttended}</span>
                <span className="text-[var(--muted)] ml-1">events</span>
              </div>
            </>
          )}
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-4 pb-6 border-b border-[var(--twilight)]">
          {profile.location && (
            <span className="font-mono text-xs text-[var(--muted)] flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {profile.location}
            </span>
          )}
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] flex items-center gap-1 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {profile.website.replace(/^https?:\/\//, "")}
            </a>
          )}
          <span className="font-mono text-xs text-[var(--muted)] flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Joined {format(new Date(profile.created_at), "MMM yyyy")}
          </span>
        </div>
      </div>
    </div>
  );
}
