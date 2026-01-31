"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Logo from "./Logo";
import UserMenu from "./UserMenu";
import HeaderSearchButton from "./HeaderSearchButton";
import { DEFAULT_PORTAL_SLUG, DEFAULT_PORTAL_NAME } from "@/lib/portal-context";

interface PortalBranding {
  logo_url?: string;
  primary_color?: string;
  /** Enterprise only: Hide "Powered by LostCity" attribution */
  hide_attribution?: boolean;
  [key: string]: unknown;
}

interface GlassHeaderProps {
  portalSlug?: string;
  portalName?: string;
  branding?: PortalBranding;
}

export default function GlassHeader({ portalSlug = DEFAULT_PORTAL_SLUG, portalName = DEFAULT_PORTAL_NAME, branding }: GlassHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  const currentView = searchParams?.get("view") || "events";
  const isMap = currentView === "map";
  const isFeed = currentView === "feed";

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
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-[100] px-4 py-3 flex justify-between items-center border-b transition-all duration-500 ease-out ${
        isScrolled
          ? "glass border-[var(--twilight)]/50"
          : "bg-transparent border-[var(--twilight)]/30"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        {branding?.logo_url ? (
          <>
            <Link href={`/${portalSlug}`}>
              <Image src={branding.logo_url} alt={portalName} width={120} height={32} className="h-8 w-auto object-contain" />
            </Link>
            {/* Only show "powered by" if attribution is not hidden (Enterprise feature) */}
            {!branding?.hide_attribution && (
              <div className="hidden sm:flex items-center gap-1 text-[0.6rem] text-[var(--muted)] font-mono">
                <span>powered by</span>
                <Link href={`/${DEFAULT_PORTAL_SLUG}`} className="text-[var(--coral)] hover:opacity-80 transition-opacity">
                  Lost City
                </Link>
              </div>
            )}
          </>
        ) : (
          <Logo href={`/${portalSlug}`} size="sm" portal={portalSlug} />
        )}
      </div>

      {/* Right side */}
      <nav className="flex items-center gap-2">
        <div className="sm:hidden">
          <HeaderSearchButton />
        </div>
        <UserMenu />

        {/* Mobile menu */}
        <div className="relative sm:hidden" ref={mobileMenuRef}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 rounded-lg transition-colors active:scale-95"
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

          {mobileMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-xl">
              <div className="px-3 py-1.5 text-[0.65rem] font-mono text-[var(--muted)] uppercase tracking-wider">
                Discover
              </div>
              <Link
                href={`/${portalSlug}?view=feed`}
                onClick={() => setMobileMenuOpen(false)}
                className={`mobile-menu-item flex items-center gap-2 px-3 py-2 font-mono text-sm ${
                  isFeed ? "mobile-menu-active" : "text-[var(--muted)] hover:text-[var(--neon-amber)]"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Highlights
              </Link>
              <Link
                href={`/${portalSlug}`}
                onClick={() => setMobileMenuOpen(false)}
                className={`mobile-menu-item flex items-center gap-2 px-3 py-2 font-mono text-sm ${
                  !isMap && !isFeed ? "mobile-menu-active" : "text-[var(--muted)] hover:text-[var(--neon-amber)]"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Events
              </Link>
              <Link
                href={`/${portalSlug}?view=spots`}
                onClick={() => setMobileMenuOpen(false)}
                className="mobile-menu-item flex items-center gap-2 px-3 py-2 font-mono text-sm text-[var(--muted)] hover:text-[var(--neon-amber)]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Places
              </Link>
              <Link
                href={`/${portalSlug}?view=community`}
                onClick={() => setMobileMenuOpen(false)}
                className="mobile-menu-item flex items-center gap-2 px-3 py-2 font-mono text-sm text-[var(--muted)] hover:text-[var(--neon-amber)]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Groups
              </Link>

              <div className="my-2 border-t border-[var(--twilight)]" />

              <Link
                href={`/${portalSlug}?view=map`}
                onClick={() => setMobileMenuOpen(false)}
                className={`mobile-menu-item flex items-center gap-2 px-3 py-2 font-mono text-sm ${
                  isMap ? "mobile-menu-active" : "text-[var(--muted)] hover:text-[var(--neon-amber)]"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Map
              </Link>
              <Link
                href="/settings/notifications"
                onClick={() => setMobileMenuOpen(false)}
                className="mobile-menu-item flex items-center gap-2 px-3 py-2 font-mono text-sm text-[var(--muted)] hover:text-[var(--neon-amber)]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Notifications
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
