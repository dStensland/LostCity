"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "@/components/SmartImage";
import Logo from "./Logo";
import UserMenu from "./UserMenu";
import HeaderSearchButton from "./HeaderSearchButton";
import SavedEventsButton from "./SavedEventsButton";
import { usePortalOptional, DEFAULT_PORTAL, DEFAULT_PORTAL_SLUG, DEFAULT_PORTAL_NAME } from "@/lib/portal-context";
import { useAuth } from "@/lib/auth-context";
import { useLogoUrl } from "@/lib/hooks/useDesignOverrides";
import { useRealtimeFriendRequests } from "@/lib/hooks/useRealtimeFriendRequests";

interface PortalBranding {
  logo_url?: string;
  primary_color?: string;
  /** Enterprise only: Hide "Powered by LostCity" attribution */
  hide_attribution?: boolean;
  [key: string]: unknown;
}

interface UnifiedHeaderProps {
  portalSlug?: string;
  portalName?: string;
  branding?: PortalBranding;
  /** Show back button with contextual label */
  backLink?: {
    href: string;
    label: string;
  };
  /** Hide the main navigation tabs (rare, for minimal pages) */
  hideNav?: boolean;
}

type NavTab = {
  key: "feed" | "find" | "community";
  defaultLabel: string;
  href: string;
  authRequired?: boolean;
  icon?: React.ReactNode;
};

const DEFAULT_TABS: NavTab[] = [
  {
    key: "feed",
    defaultLabel: "Feed",
    href: "feed",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  },
  {
    key: "find",
    defaultLabel: "Find",
    href: "find",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    key: "community",
    defaultLabel: "Community",
    href: "community",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
];

// Inner component that uses useSearchParams (must be wrapped in Suspense)
function UnifiedHeaderInner({
  portalSlug = DEFAULT_PORTAL_SLUG,
  portalName = DEFAULT_PORTAL_NAME,
  branding,
  backLink,
  hideNav = false,
}: UnifiedHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const portalContext = usePortalOptional();
  const portal = portalContext?.portal ?? DEFAULT_PORTAL;
  const { user } = useAuth();
  const logoUrl = useLogoUrl(branding?.logo_url as string | undefined);
  const { pendingCount } = useRealtimeFriendRequests();

  // Get custom nav labels from portal settings
  const navLabels = (portal.settings?.nav_labels || {}) as Record<string, string | undefined>;

  // Build tabs with custom labels, filtering out auth-required tabs when not logged in
  const TABS = DEFAULT_TABS
    .filter(tab => !tab.authRequired || user)
    .map(tab => ({
      ...tab,
      label: navLabels[tab.key] || tab.defaultLabel,
    }));

  const currentView = searchParams?.get("view") || "feed";

  // Click outside to close mobile menu
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

  // Track scroll for glass effect
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const getHref = (tab: typeof TABS[0]) => {
    if (tab.key === "feed") {
      return `/${portalSlug}`;
    }
    return `/${portalSlug}?view=${tab.key}`;
  };

  const isActive = (tab: typeof TABS[0]) => {
    // Handle non-portal pages - nothing active except specific matches
    const isPortalPage = pathname === `/${portalSlug}`;

    if (tab.key === "feed") {
      // Feed is active when no view param or view=feed
      return isPortalPage && (!currentView || currentView === "feed");
    }
    if (tab.key === "find") {
      // Find is active for find view, or legacy events/spots/map/calendar views
      return isPortalPage && (currentView === "find" || currentView === "events" || currentView === "spots" || currentView === "map" || currentView === "calendar");
    }
    if (tab.key === "community") {
      return isPortalPage && currentView === "community";
    }
    return false;
  };

  return (
    <>
      {/* Main Header Bar */}
      <header
        className={`sticky top-0 z-[100] border-b transition-all duration-300 relative ${
          isScrolled
            ? "glass border-[var(--twilight)]/50"
            : "bg-[var(--void)]/95 backdrop-blur-sm border-[var(--twilight)]/30"
        }`}
      >
        {/* Atlanta atmospheric backdrop — inverted skyline */}
        {portalSlug === "atlanta" && (
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none overflow-hidden"
          >
            <div
              className="absolute inset-0 hidden sm:block"
              style={{
                backgroundImage: 'url("/portals/atlanta/header-skyline-collage.jpg")',
                backgroundSize: "cover",
                backgroundPosition: "center bottom",
                backgroundRepeat: "no-repeat",
                transform: "scaleY(-1)",
                mixBlendMode: "screen",
                opacity: 0.5,
              }}
            />
            <div
              className="absolute inset-0 hidden sm:block"
              style={{
                background: "linear-gradient(135deg, hsl(185 100% 46% / 0.12) 0%, hsl(320 80% 62% / 0.08) 100%)",
                mixBlendMode: "screen",
                pointerEvents: "none",
              }}
            />
            <div
              className="absolute inset-0 sm:hidden"
              style={{
                backgroundImage: 'url("/portals/atlanta/header-skyline-collage.jpg")',
                backgroundSize: "cover",
                backgroundPosition: "center bottom",
                backgroundRepeat: "no-repeat",
                transform: "scaleY(-1)",
                mixBlendMode: "screen",
                opacity: 0.35,
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: "radial-gradient(ellipse 120% 100% at 50% 0%, rgba(0,0,0,0.35) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />
          </div>
        )}
        <div className="relative px-4 py-2 sm:py-3 flex items-center gap-4">
          {/* Left: Back button (optional) + Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {backLink && (
              <Link
                href={backLink.href}
                className="flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--cream)] transition-colors mr-1"
                aria-label={`Back to ${backLink.label}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-mono text-xs hidden sm:inline">{backLink.label}</span>
              </Link>
            )}

            {logoUrl ? (
              <div className="flex items-center gap-2">
                <Link href={`/${portalSlug}`}>
                  <Image src={logoUrl} alt={portalName} width={120} height={32} className="h-8 w-auto object-contain" />
                </Link>
                {/* Only show "powered by" if attribution is not hidden (Enterprise feature) */}
                {!branding?.hide_attribution && (
                  <div className="hidden lg:flex items-center gap-1 text-[0.6rem] text-[var(--muted)] font-mono">
                    <span>powered by</span>
                    <Link href={`/${DEFAULT_PORTAL_SLUG}`} className="text-[var(--coral)] hover:opacity-80 transition-opacity">
                      Lost City
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <Logo href={`/${portalSlug}`} size="sm" portal={portalSlug} />
            )}
          </div>

          {/* Center: Nav tabs (desktop only) */}
          {!hideNav && (
            <nav className="hidden sm:flex items-center flex-1 max-w-md mx-auto">
              {TABS.map((tab) => {
                const active = isActive(tab);
                const showBadge = tab.key === "community" && pendingCount > 0;
                return (
                  <Link
                    key={tab.key}
                    href={getHref(tab)}
                    className={`nav-tab relative flex-1 text-center px-3 py-1.5 rounded-md font-mono text-xs whitespace-nowrap transition-all duration-300 ${
                      active
                        ? "nav-tab-active text-[var(--void)] font-medium"
                        : "text-[var(--muted)] hover:text-[var(--neon-amber)] border border-transparent"
                    }`}
                  >
                    {tab.label}
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--coral)] text-[var(--void)] text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                        {pendingCount > 9 ? '9+' : pendingCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Right: Search, User menu, Mobile menu */}
          <div className="relative flex items-center gap-2 flex-shrink-0 ml-auto">
            <HeaderSearchButton />
            <SavedEventsButton />
            <UserMenu />

            {/* Mobile hamburger menu */}
            <div className="relative sm:hidden" ref={mobileMenuRef}>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 rounded-lg transition-colors active:scale-95"
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
                <div className="absolute right-0 top-full mt-2 w-56 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-xl z-[200]">
                  <div className="px-3 py-1.5 text-[0.65rem] font-mono text-[var(--muted)] uppercase tracking-wider">
                    Quick Links
                  </div>
                  <Link
                    href={`/${portalSlug}?view=find&type=events`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 font-mono text-sm text-[var(--muted)] hover:text-[var(--neon-amber)] hover:bg-[var(--twilight)]/30"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Events
                  </Link>
                  <Link
                    href={`/${portalSlug}?view=find&type=places`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 font-mono text-sm text-[var(--muted)] hover:text-[var(--neon-amber)] hover:bg-[var(--twilight)]/30"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Places
                  </Link>
                  <Link
                    href={`/${portalSlug}?view=find&display=map`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 font-mono text-sm text-[var(--muted)] hover:text-[var(--neon-amber)] hover:bg-[var(--twilight)]/30"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Map View
                  </Link>

                  <div className="my-2 border-t border-[var(--twilight)]" />

                  <div className="px-3 py-1.5 text-[0.65rem] font-mono text-[var(--muted)] uppercase tracking-wider">
                    Settings
                  </div>
                  <Link
                    href="/settings"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 font-mono text-sm text-[var(--muted)] hover:text-[var(--neon-amber)] hover:bg-[var(--twilight)]/30"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Nav Bar (below header on mobile) - compact to maximize content area */}
        {!hideNav && (
          <nav className="sm:hidden relative border-t border-[var(--twilight)]/30 bg-[var(--night)]/95">
            <div className="flex py-1.5 px-4">
              {TABS.map((tab) => {
                const active = isActive(tab);
                const showBadge = tab.key === "community" && pendingCount > 0;
                return (
                  <Link
                    key={tab.key}
                    href={getHref(tab)}
                    className={`nav-tab relative flex-1 text-center py-1.5 rounded-md font-mono text-xs whitespace-nowrap transition-all duration-300 ${
                      active
                        ? "nav-tab-active text-[var(--void)] font-medium"
                        : "text-[var(--muted)] hover:text-[var(--neon-amber)] border border-transparent"
                    }`}
                  >
                    {tab.label}
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--coral)] text-[var(--void)] text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                        {pendingCount > 9 ? '9+' : pendingCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </header>
    </>
  );
}

// Export a wrapper that handles Suspense for useSearchParams
export default function UnifiedHeader(props: UnifiedHeaderProps) {
  return (
    <Suspense fallback={
      <header className="sticky top-0 z-[100] border-b bg-[var(--void)]/95 backdrop-blur-sm border-[var(--twilight)]/30">
        <div className="px-4 py-2 sm:py-3 flex items-center gap-4">
          <div className="h-8 w-24 rounded skeleton-shimmer" />
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full skeleton-shimmer" />
          </div>
        </div>
      </header>
    }>
      <UnifiedHeaderInner {...props} />
    </Suspense>
  );
}
