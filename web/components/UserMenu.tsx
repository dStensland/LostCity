"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import NotificationDropdown from "./NotificationDropdown";

export default function UserMenu() {
  const { user, profile, loading, signOut } = useAuth();
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

  // Loading state
  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-[var(--twilight)] animate-pulse" />
    );
  }

  // Not logged in
  if (!user) {
    return (
      <Link
        href="/auth/login"
        className="font-mono text-[0.7rem] font-medium text-[var(--muted)] uppercase tracking-wide hover:text-[var(--cream)] transition-colors"
      >
        Sign in
      </Link>
    );
  }

  // Logged in - show avatar and dropdown
  const initials = profile?.display_name
    ? profile.display_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : profile?.username?.slice(0, 2).toUpperCase() || "??";

  return (
    <div className="flex items-center gap-2">
      {/* Notifications */}
      <NotificationDropdown />

      {/* Avatar and dropdown */}
      <div className="relative flex items-center" ref={menuRef}>
        {/* Avatar - clicks through to profile */}
        <Link
          href={`/profile/${profile?.username}`}
          className="focus:outline-none"
        >
          {profile?.avatar_url && !imgError ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name || profile.username}
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
          className="ml-1 p-1 text-[var(--muted)] hover:text-[var(--cream)] transition-colors focus:outline-none"
          aria-label="User menu"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 py-1 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-lg z-50">
          <div className="px-4 py-2 border-b border-[var(--twilight)]">
            <p className="font-mono text-sm text-[var(--cream)]">
              {profile?.display_name || profile?.username}
            </p>
            <p className="font-mono text-xs text-[var(--muted)]">
              @{profile?.username}
            </p>
          </div>

          <Link
            href={`/profile/${profile?.username}`}
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2 font-mono text-xs text-[var(--soft)] hover:bg-[var(--twilight)] transition-colors"
          >
            Your Profile
          </Link>

          <Link
            href="/foryou"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2 font-mono text-xs text-[var(--soft)] hover:bg-[var(--twilight)] transition-colors"
          >
            For You
          </Link>

          <Link
            href="/saved"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2 font-mono text-xs text-[var(--soft)] hover:bg-[var(--twilight)] transition-colors"
          >
            Saved Events
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
