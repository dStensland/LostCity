"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Logo from "./Logo";
import UserMenu from "./UserMenu";
import HeaderSearchButton from "./HeaderSearchButton";
import { useLiveEventCount } from "@/lib/hooks/useLiveEvents";

interface PortalBranding {
  logo_url?: string;
  primary_color?: string;
  [key: string]: unknown;
}

interface GlassHeaderProps {
  portalSlug: string;
  portalName: string;
  branding?: PortalBranding;
}

export default function GlassHeader({ portalSlug, portalName, branding }: GlassHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const liveEventCount = useLiveEventCount();

  // Determine active nav item
  const isCollections = pathname?.startsWith("/collections");
  const isHappeningNow = pathname?.startsWith("/happening-now");
  const isEvents = !isCollections && !isHappeningNow;

  // Close mobile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    }

    if (mobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial state

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 px-4 sm:px-6 py-4 flex justify-between items-center border-b transition-all duration-300 ${
        isScrolled
          ? "glass border-[var(--twilight)]/50"
          : "bg-transparent border-[var(--twilight)]"
      }`}
    >
      <div className="flex items-center gap-3">
        {branding?.logo_url ? (
          <Link href={`/${portalSlug}`} className="flex items-center gap-2">
            <Image
              src={branding.logo_url}
              alt={portalName}
              width={120}
              height={32}
              className="h-8 w-auto object-contain"
            />
          </Link>
        ) : (
          <>
            <Logo href={`/${portalSlug}`} />
            <span className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest hidden sm:inline">
              {portalName}
            </span>
          </>
        )}
      </div>
      <nav className="flex items-center gap-3 sm:gap-4">
        {/* Pill-style navigation toggle - desktop */}
        <div className="hidden sm:flex items-center bg-[var(--twilight)]/50 rounded-full p-0.5">
          <Link
            href={`/${portalSlug}`}
            className={`px-3 py-1 font-mono text-[0.65rem] font-medium uppercase tracking-wide rounded-full transition-all ${
              isEvents
                ? "bg-[var(--neon-magenta)] text-white shadow-[0_0_10px_hsl(var(--neon-magenta-hsl)/0.4)]"
                : "text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            Events
          </Link>
          <Link
            href="/happening-now"
            className={`px-3 py-1 font-mono text-[0.65rem] font-medium uppercase tracking-wide rounded-full transition-all flex items-center gap-1.5 ${
              isHappeningNow
                ? "bg-[var(--neon-magenta)] text-white shadow-[0_0_10px_hsl(var(--neon-magenta-hsl)/0.4)]"
                : "text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            {liveEventCount > 0 && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-[var(--neon-red)] animate-pulse"
                style={{ boxShadow: "0 0 4px var(--neon-red)" }}
              />
            )}
            Live
          </Link>
          <Link
            href="/collections"
            className={`px-3 py-1 font-mono text-[0.65rem] font-medium uppercase tracking-wide rounded-full transition-all ${
              isCollections
                ? "bg-[var(--neon-magenta)] text-white shadow-[0_0_10px_hsl(var(--neon-magenta-hsl)/0.4)]"
                : "text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            Collections
          </Link>
        </div>
        <HeaderSearchButton />
        <a
          href="mailto:hello@lostcity.ai"
          className="font-mono text-[0.7rem] font-medium text-[var(--muted)] uppercase tracking-wide hover:text-[var(--cream)] transition-colors hidden sm:inline"
        >
          Submit
        </a>
        <UserMenu />

        {/* Mobile menu toggle */}
        <div className="relative sm:hidden" ref={mobileMenuRef}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          {/* Mobile dropdown menu */}
          {mobileMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-xl">
              <Link
                href={`/${portalSlug}`}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-2 font-mono text-sm ${
                  isEvents ? "text-[var(--coral)]" : "text-[var(--cream)] hover:bg-[var(--twilight)]"
                }`}
              >
                Events
              </Link>
              <Link
                href="/happening-now"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-4 py-2 font-mono text-sm ${
                  isHappeningNow ? "text-[var(--coral)]" : "text-[var(--cream)] hover:bg-[var(--twilight)]"
                }`}
              >
                {liveEventCount > 0 && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[var(--neon-red)] animate-pulse"
                    style={{ boxShadow: "0 0 4px var(--neon-red)" }}
                  />
                )}
                Happening Now
              </Link>
              <Link
                href="/collections"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-2 font-mono text-sm ${
                  isCollections ? "text-[var(--coral)]" : "text-[var(--cream)] hover:bg-[var(--twilight)]"
                }`}
              >
                Collections
              </Link>
              <div className="border-t border-[var(--twilight)] my-2" />
              <a
                href="mailto:hello@lostcity.ai"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2 font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]"
              >
                Submit Event
              </a>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
