"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import ShareInviteLink from "./ShareInviteLink";
import NotificationDropdown from "./NotificationDropdown";
import CalendarButton from "./CalendarButton";

export default function UserMenu() {
  const { user, profile, loading, signOut } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
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

  // Build full URL with query params for redirect
  const currentUrl = pathname && pathname !== "/"
    ? searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname
    : null;
  const loginUrl = currentUrl
    ? `/auth/login?redirect=${encodeURIComponent(currentUrl)}`
    : "/auth/login";

  // Brief loading state during auth init only
  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-[var(--twilight)] animate-pulse" />
    );
  }

  // Not logged in
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

  // User exists - show avatar even if profile is still loading (use fallback initials)
  // This prevents the loading spinner from showing while profile loads
  const initials = profile?.display_name
    ? profile.display_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : profile?.username?.slice(0, 2).toUpperCase() || user.email?.slice(0, 2).toUpperCase() || "U";

  return (
    <div className="flex items-center gap-2">
      {/* Notifications */}
      <NotificationDropdown />

      {/* Invite Friends */}
      <ShareInviteLink variant="icon" />

      {/* Calendar */}
      <CalendarButton />

      {/* Avatar and dropdown */}
      <div className="relative flex items-center z-[1000]" ref={menuRef}>
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
        <div className="absolute right-0 top-full mt-2 w-64 bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl shadow-2xl shadow-black/30 z-[1050] overflow-hidden">
          {/* Header with avatar and name */}
          <div className="p-4 bg-gradient-to-br from-[var(--twilight)]/50 to-transparent">
            <div className="flex items-center gap-3">
              {profile?.avatar_url && !imgError ? (
                <Image
                  src={profile.avatar_url}
                  alt=""
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-[var(--coral)]/30"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[var(--coral)] flex items-center justify-center ring-2 ring-[var(--coral)]/30">
                  <span className="font-mono text-sm font-bold text-[var(--void)]">
                    {initials}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-[var(--cream)] truncate">
                  {profile?.display_name || profile?.username || user.email?.split("@")[0] || "User"}
                </p>
                <p className="font-mono text-xs text-[var(--muted)] truncate">
                  @{profile?.username || user.email?.split("@")[0] || "user"}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation links */}
          <div className="p-2">
            <Link
              href={profile?.username ? `/profile/${profile.username}` : "/settings"}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors group"
            >
              <svg className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-mono text-sm">Profile</span>
            </Link>

            <Link
              href="/calendar"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors group"
            >
              <svg className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="font-mono text-sm">My Calendar</span>
            </Link>

            <Link
              href="/invite-friends"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors group"
            >
              <svg className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span className="font-mono text-sm">Invite Friends</span>
            </Link>

            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors group"
            >
              <svg className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-mono text-sm">Settings</span>
            </Link>

            {profile?.is_admin && (
              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors group"
              >
                <svg className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="font-mono text-sm">Admin</span>
              </Link>
            )}
          </div>

          {/* Sign out */}
          <div className="p-2 border-t border-[var(--twilight)]">
            <button
              onClick={() => {
                signOut();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--coral)] hover:bg-[var(--coral)]/10 transition-colors group"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="font-mono text-sm">Sign out</span>
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
