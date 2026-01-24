"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import NotificationDropdown from "./NotificationDropdown";
import ShareInviteLink from "./ShareInviteLink";
import SavedEventsButton from "./SavedEventsButton";

export default function UserMenu() {
  const { user, profile, loading, signOut } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  const [profileTimeout, setProfileTimeout] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Timeout to prevent infinite loading state - show sign in after 2s
  useEffect(() => {
    if (!loading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync with loading state
      setShowLoading(false);
      return;
    }

    const timeout = setTimeout(() => {
      setShowLoading(false);
    }, 2000);

    return () => clearTimeout(timeout);
  }, [loading]);

  // Timeout for profile loading - if user exists but profile takes too long, show fallback
  useEffect(() => {
    if (!user || profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync with profile state
      setProfileTimeout(false);
      return;
    }

    const timeout = setTimeout(() => {
      setProfileTimeout(true);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [user, profile]);

  const loginUrl = pathname && pathname !== "/"
    ? `/auth/login?redirect=${encodeURIComponent(pathname)}`
    : "/auth/login";

  // Brief loading state (max 2 seconds)
  if (loading && showLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-[var(--twilight)] animate-pulse" />
    );
  }

  // Not logged in (or loading timed out without user)
  if (!user) {
    return (
      <Link
        href={loginUrl}
        className="font-mono text-[0.7rem] font-medium text-[var(--muted)] uppercase tracking-wide hover:text-[var(--cream)] transition-colors"
      >
        Sign in
      </Link>
    );
  }

  // User exists but profile still loading - show loading state (with timeout fallback)
  if (!profile && !profileTimeout) {
    return (
      <div className="w-8 h-8 rounded-full bg-[var(--twilight)] animate-pulse" />
    );
  }

  // Logged in - show avatar and dropdown (profile may be null if timed out)
  const initials = profile?.display_name
    ? profile.display_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : profile?.username?.slice(0, 2).toUpperCase() || user.email?.slice(0, 2).toUpperCase() || "U";

  return (
    <div className="flex items-center gap-2">
      {/* Saved Events */}
      <SavedEventsButton />

      {/* Notifications */}
      <NotificationDropdown />

      {/* Invite Friends */}
      <ShareInviteLink variant="icon" />

      {/* Avatar and dropdown */}
      <div className="relative flex items-center" ref={menuRef}>
        {/* Avatar - clicks through to profile (or settings if no profile) */}
        <Link
          href={profile?.username ? `/profile/${profile.username}` : "/settings"}
          className="focus:outline-none"
        >
          {profile?.avatar_url && !imgError ? (
            <Image
              src={profile.avatar_url}
              alt={profile.display_name || profile.username || "Profile"}
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover border border-[var(--twilight)] hover:border-[var(--coral)] transition-colors"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[var(--coral)] flex items-center justify-center hover:bg-[var(--rose)] transition-colors">
              <span className="font-mono text-xs font-bold text-[var(--void)]">
                {initials}
              </span>
            </div>
          )}
        </Link>

        {/* Dropdown trigger */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="ml-0.5 p-2 -mr-2 text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 rounded-lg transition-colors focus:outline-none active:scale-95"
          aria-label="User menu"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 py-1 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-lg z-[1050]">
          <div className="px-4 py-2 border-b border-[var(--twilight)]">
            <p className="font-mono text-sm text-[var(--cream)]">
              {profile?.display_name || profile?.username || user.email?.split("@")[0] || "User"}
            </p>
            <p className="font-mono text-xs text-[var(--muted)]">
              {profile?.username ? `@${profile.username}` : user.email}
            </p>
          </div>

          {profile?.username && (
            <Link
              href={`/profile/${profile.username}`}
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 font-mono text-xs text-[var(--soft)] hover:bg-[var(--twilight)] transition-colors"
            >
              Your Profile
            </Link>
          )}

          <Link
            href="/dashboard"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2 font-mono text-xs text-[var(--soft)] hover:bg-[var(--twilight)] transition-colors"
          >
            Your Scene
          </Link>

          <Link
            href="/dashboard?tab=planning"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2 font-mono text-xs text-[var(--soft)] hover:bg-[var(--twilight)] transition-colors"
          >
            Your Moves
          </Link>

          <Link
            href="/dashboard?tab=activity"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2 font-mono text-xs text-[var(--soft)] hover:bg-[var(--twilight)] transition-colors"
          >
            The Scene
          </Link>

          <Link
            href="/people"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2 font-mono text-xs text-[var(--soft)] hover:bg-[var(--twilight)] transition-colors"
          >
            Find Friends
          </Link>

          <Link
            href="/settings"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2 font-mono text-xs text-[var(--soft)] hover:bg-[var(--twilight)] transition-colors"
          >
            Settings
          </Link>

          <div className="border-t border-[var(--twilight)] mt-1">
            <button
              onClick={() => {
                signOut();
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 font-mono text-xs text-[var(--coral)] hover:bg-[var(--twilight)] transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
