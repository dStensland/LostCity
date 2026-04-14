"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import UserMenu from "../UserMenu";
import { LaunchButton } from "@/components/search/LaunchButton";
import { useAuth } from "@/lib/auth-context";

/*
 * Lost Youth (Family Portal) Header
 * Design: "Adventure Guide" - Bold, playful, illustrated feeling
 *
 * Nav tabs are intentionally omitted here. FamilyFeed owns all navigation:
 * desktop uses a sticky sidebar, mobile uses a bottom tab bar. The header
 * is logo + search + sign-in only.
 */

const PORTAL_SLUG = "atlanta-families";

export default function ATLittleHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  useAuth();

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 10);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="sticky top-0 z-[100] family-theme bg-[var(--family-cream)]">
      {/* Main bar */}
      <div
        className={`relative h-16 flex items-center justify-between px-4 transition-shadow duration-200 family-header ${
          isScrolled ? "family-header-shadow" : ""
        }`}
      >
        {/* Logo */}
        <Link
          href={`/${PORTAL_SLUG}`}
          className="flex items-center gap-2 group"
        >
          <div
            className="relative px-4 py-1.5 rounded-full transition-transform group-hover:scale-105 group-hover:-rotate-2 family-logo-badge"
          >
            <span
              className="text-xl font-black text-white family-font-display"
            >
              Lost Youth
            </span>
          </div>
        </Link>

        {/* Right side actions: search + user menu only */}
        <div className="flex items-center gap-2">
          <div className="rounded-full family-header-pill">
            <LaunchButton />
          </div>
          <div className="rounded-full family-header-pill">
            <UserMenu minimal />
          </div>
        </div>
      </div>
    </header>
  );
}
