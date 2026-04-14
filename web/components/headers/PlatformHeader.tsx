"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Logo from "../Logo";
import UserMenu from "../UserMenu";
import { LaunchButton } from "@/components/search/LaunchButton";
import SavedEventsButton from "../SavedEventsButton";

/**
 * PlatformHeader — used on portal-agnostic pages (profile, settings, calendar,
 * saved, notifications, etc.). Shows LC branding without portal-specific nav
 * tabs. Mobile search opens the global search overlay via LaunchButton.
 */
export default function PlatformHeader() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-[100] border-b transition-all duration-300 ${
        isScrolled
          ? "bg-[var(--night)] border-[var(--twilight)]/50 shadow-card-sm"
          : "bg-[var(--void)]/95 backdrop-blur-sm border-[var(--twilight)]/30"
      }`}
    >
      <div className="px-4 py-2 sm:py-3 flex items-center gap-3">
        {/* Left: LC Logo — links to root */}
        <Logo href="/" size="sm" />

        {/* Center spacer */}
        <div className="flex-1" />

        {/* Right: Search + Saved + User */}
        <div className="flex items-center gap-2">
          <LaunchButton />
          <SavedEventsButton />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
