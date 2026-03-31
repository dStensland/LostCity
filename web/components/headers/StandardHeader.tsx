"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "@/components/SmartImage";
import Logo from "../Logo";
import UserMenu from "../UserMenu";
import BackButton from "./BackButton";
import HeaderSearchButton from "../HeaderSearchButton";
import { usePortalOptional, DEFAULT_PORTAL, DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";
import { useAuth } from "@/lib/auth-context";
import { getPortalNavLabel } from "@/lib/nav-labels";
import { isHelpAtlSupportDirectoryEnabled } from "@/lib/helpatl-support";
import type { HeaderConfig } from "@/lib/visual-presets";
import type { PortalBranding } from "@/lib/portal-context";

interface StandardHeaderProps {
  portalSlug: string;
  portalName: string;
  branding: PortalBranding;
  backLink?: {
    href?: string;
    fallbackHref?: string;
    label: string;
  };
  headerConfig: HeaderConfig;
}

type NavTab = {
  key: "feed" | "find" | "happening" | "places" | "community" | "support";
  defaultLabel: string;
  authRequired?: boolean;
  icon?: React.ReactNode;
};

const DEFAULT_TABS: NavTab[] = [
  {
    key: "feed",
    defaultLabel: "Feed",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  },
  {
    key: "find",
    defaultLabel: "Explore",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    key: "community",
    defaultLabel: "Going Out",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
];

/**
 * Standard Header Template
 * Current layout: logo left, nav tabs center, user menu right
 */
export default function StandardHeader({
  portalSlug,
  portalName,
  branding,
  backLink,
  headerConfig,
}: StandardHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const portalContext = usePortalOptional();
  const portal = portalContext?.portal ?? DEFAULT_PORTAL;
  const { user } = useAuth();

  // Get custom nav labels from portal settings
  const navLabels = (portal.settings?.nav_labels || {}) as Record<string, string | undefined>;
  const showSupportTab = isHelpAtlSupportDirectoryEnabled(portalSlug);

  // Build tabs with custom labels, filtering out auth-required tabs when not logged in
  // Find tab replaces both Happening and Places — always visible on all portal verticals
  const TABS = [
    ...DEFAULT_TABS,
    ...(showSupportTab
      ? [
          {
            key: "support" as const,
            defaultLabel: "Support",
          },
        ]
      : []),
  ]
    .filter(tab => !tab.authRequired || user)
    .map(tab => ({
      ...tab,
      label: getPortalNavLabel(navLabels, tab.key, tab.defaultLabel),
    }));

  const currentView = searchParams?.get("view");

  // Get nav style class
  const getNavStyleClass = () => {
    switch (headerConfig.nav_style) {
      case "pills":
        return "nav-tab-pills";
      case "underline":
        return "nav-tab-underline";
      case "minimal":
        return "nav-tab-minimal";
      default:
        return ""; // tabs is default
    }
  };

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



  const getHref = useCallback((tab: typeof TABS[0]) => {
    if (tab.key === "feed") {
      // Feed = clean portal URL. Carrying over stale find-signal params
      // (search, categories, etc.) would trick the portal page into
      // rendering Find instead of the feed.
      return `/${portalSlug}`;
    }

    if (tab.key === "support") {
      return `/${portalSlug}/support`;
    }

    const params = new URLSearchParams(searchParams?.toString() || "");
    params.delete("event");
    params.delete("spot");
    params.delete("series");
    params.delete("festival");
    params.delete("org");

    if (tab.key === "find") {
      params.set("view", "find");
      params.delete("content");
      params.delete("tab");
      params.delete("type");
      params.delete("display");
      params.delete("lane");
    } else if (tab.key === "happening") {
      params.set("view", "happening");
      params.delete("tab");
      params.delete("type");
    } else if (tab.key === "places") {
      params.set("view", "places");
      params.delete("tab");
      params.delete("type");
      params.delete("content");
      params.delete("display");
    } else if (tab.key === "community") {
      params.set("view", "community");
      params.delete("type");
      params.delete("display");
      params.delete("tab");
      params.delete("content");
    }

    const query = params.toString();
    return query ? `/${portalSlug}?${query}` : `/${portalSlug}`;
  }, [portalSlug, searchParams]);

  const isActive = (tab: typeof TABS[0]) => {
    const isPortalPage = pathname === `/${portalSlug}`;
    const isFindRoute = pathname === `/${portalSlug}/find`;
    const isCommunityRoute = pathname === `/${portalSlug}/community`;
    const isFeedRoute = isPortalPage || pathname === `/${portalSlug}/feed`;

    if (tab.key === "feed") {
      return isFeedRoute && (!currentView || currentView === "feed");
    }
    if (tab.key === "find") {
      return (
        isFindRoute ||
        pathname.startsWith(`/${portalSlug}/spots/`) ||
        pathname.startsWith(`/${portalSlug}/events/`) ||
        pathname.startsWith(`/${portalSlug}/series/`) ||
        pathname.startsWith(`/${portalSlug}/festivals/`) ||
        (isPortalPage && (
          currentView === "find" ||
          currentView === "happening" ||
          currentView === "places" ||
          currentView === "events" ||
          currentView === "spots" ||
          currentView === "map" ||
          currentView === "calendar"
        ))
      );
    }
    if (tab.key === "happening") {
      return (
        isFindRoute ||
        pathname.startsWith(`/${portalSlug}/events/`) ||
        pathname.startsWith(`/${portalSlug}/series/`) ||
        pathname.startsWith(`/${portalSlug}/festivals/`) ||
        (isPortalPage && (
          currentView === "happening" ||
          currentView === "find" ||
          currentView === "events" ||
          currentView === "map" ||
          currentView === "calendar"
        ))
      );
    }
    if (tab.key === "places") {
      return (
        pathname.startsWith(`/${portalSlug}/spots/`) ||
        (isPortalPage && (currentView === "places" || currentView === "spots"))
      );
    }
    if (tab.key === "community") {
      return isCommunityRoute || (isPortalPage && currentView === "community");
    }
    if (tab.key === "support") {
      return pathname.startsWith(`/${portalSlug}/support`);
    }
    return false;
  };

  // Logo size classes
  const logoSizeClass = headerConfig.logo_size === "lg" ? "h-10" : headerConfig.logo_size === "sm" ? "h-6" : "h-8";

  // Keyboard navigation for tabs
  const handleKeyDown = useCallback((event: React.KeyboardEvent, currentIndex: number) => {
    let targetIndex: number | null = null;

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        targetIndex = currentIndex > 0 ? currentIndex - 1 : TABS.length - 1;
        break;
      case "ArrowRight":
        event.preventDefault();
        targetIndex = currentIndex < TABS.length - 1 ? currentIndex + 1 : 0;
        break;
      case "Home":
        event.preventDefault();
        targetIndex = 0;
        break;
      case "End":
        event.preventDefault();
        targetIndex = TABS.length - 1;
        break;
      default:
        return;
    }

    if (targetIndex !== null) {
      const targetTab = TABS[targetIndex];
      router.push(getHref(targetTab));
    }
  }, [TABS, router, getHref]);

  return (
    <>
      {/* Main Header Bar */}
      <header
        className="portal-feed-header sticky top-0 z-[100] border-b border-[var(--twilight)]/30 bg-[var(--void)]/95 backdrop-blur-sm relative"
      >
        {/* Atlanta atmospheric backdrop — inverted skyline silhouettes */}
        {portalSlug === "atlanta" && (
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none overflow-hidden"
          >
            {/* Inverted skyline — buildings hang from top edge */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: 'url("/portals/atlanta/header-skyline-collage.jpg")',
                backgroundSize: "cover",
                backgroundPosition: "center bottom",
                backgroundRepeat: "no-repeat",
                transform: "scaleY(-1)",
                mixBlendMode: "soft-light",
                opacity: 0.18,
              }}
            />
            {/* Coral-cyan tint */}
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(135deg, hsl(355 100% 71% / 0.06) 0%, hsl(185 100% 46% / 0.04) 100%)",
                pointerEvents: "none",
              }}
            />
          </div>
        )}
        {/* Content layer */}
        <div className="relative flex flex-col">
        <div className="portal-feed-header-row px-4 py-2 sm:py-3 flex items-center gap-3 relative">
          {/* Left: Back button (optional) + Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {backLink && (
              <BackButton
                href={backLink.href}
                fallbackHref={backLink.fallbackHref}
                label={backLink.label}
              />
            )}

            {branding?.logo_url ? (
              <div className="flex items-center gap-2 portal-feed-logo-wrap">
                <Link href={`/${portalSlug}`} className="portal-feed-logo-link">
                  <Image
                    src={branding.logo_url}
                    alt={portalName}
                    width={120}
                    height={32}
                    className={`${logoSizeClass} w-auto object-contain`}
                  />
                </Link>
                {/* Only show "powered by" if attribution is not hidden (Enterprise feature) */}
                {!branding?.hide_attribution && (
                  <div className="hidden lg:flex items-center gap-1 text-xs text-[var(--muted)] font-mono">
                    <span>powered by</span>
                    <Link href={`/${DEFAULT_PORTAL_SLUG}`} className="text-[var(--coral)] hover:opacity-80 transition-opacity">
                      Lost City
                    </Link>
                  </div>
                )}
              </div>
            ) : portalSlug !== DEFAULT_PORTAL_SLUG && portalSlug !== "nashville" ? (
              <Link href={`/${portalSlug}`} className="font-bold text-lg tracking-tight text-[var(--cream)]">
                {portalName}
              </Link>
            ) : (
              <Logo href={`/${portalSlug}`} size="sm" portal={portalSlug} />
            )}
          </div>

          {/* Center: Nav tabs (desktop only) */}
          <nav
            className={`portal-feed-nav hidden sm:flex items-center flex-1 max-w-md mx-auto ${getNavStyleClass()}`}
            role="tablist"
            aria-label="Main navigation"
          >
            {TABS.map((tab, index) => {
              const active = isActive(tab);
              return (
                <Link
                  key={tab.key}
                  href={getHref(tab)}
                  className={`portal-feed-tab nav-tab relative flex-1 text-center px-3 py-1.5 rounded-md font-mono text-xs whitespace-nowrap transition-all duration-300 ${
                    active
                      ? "nav-tab-active text-[var(--cream)] font-medium"
                      : "text-[var(--muted)] hover:text-[var(--soft)] border border-transparent"
                  }`}
                  role="tab"
                  aria-selected={active}
                  aria-controls={`${tab.key}-panel`}
                  tabIndex={active ? 0 : -1}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          {/* Right: Search, User menu, Mobile overflow */}
          <div className="portal-feed-actions flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ml-auto">
            {headerConfig.show_search_in_header !== false && currentView !== "find" && currentView !== "happening" && <HeaderSearchButton portalSlug={portalSlug} />}
            <UserMenu />

            {/* Mobile overflow menu — utility items only (nav is in the tab bar below) */}
            <div className="relative sm:hidden" ref={mobileMenuRef}>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-[var(--cream)] hover:text-[var(--soft)] hover:bg-[var(--twilight)]/70 rounded-lg transition-colors active:scale-95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                aria-expanded={mobileMenuOpen}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              >
                {mobileMenuOpen ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                  </svg>
                )}
              </button>

              {mobileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-xl z-[200]">
                  <Link
                    href={`/${portalSlug}?view=happening&display=map`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 font-mono text-sm text-[var(--muted)] hover:text-[var(--soft)] hover:bg-[var(--twilight)]/30"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Map View
                  </Link>
                  <div className="my-1.5 border-t border-[var(--twilight)]" />
                  <Link
                    href="/settings"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 font-mono text-sm text-[var(--muted)] hover:text-[var(--soft)] hover:bg-[var(--twilight)]/30"
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

        {/* Mobile Nav Bar (below header on mobile) */}
        <nav
          className={`portal-feed-nav portal-feed-nav-mobile sm:hidden border-t border-[var(--twilight)]/30 bg-[var(--night)]/95 ${getNavStyleClass()}`}
          role="tablist"
          aria-label="Main navigation"
        >
          <div className="flex py-1.5 px-3">
            {TABS.map((tab, index) => {
              const active = isActive(tab);
              return (
                <Link
                  key={tab.key}
                  href={getHref(tab)}
                  className={`portal-feed-tab nav-tab relative flex-1 text-center py-1 rounded-md font-mono text-xs whitespace-nowrap transition-all duration-300 ${
                    active
                      ? "nav-tab-active text-[var(--cream)] font-medium"
                      : "text-[var(--muted)] hover:text-[var(--soft)] border border-transparent"
                  }`}
                  role="tab"
                  aria-selected={active}
                  aria-controls={`${tab.key}-panel`}
                  tabIndex={active ? 0 : -1}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>
        </div>{/* end content layer */}
      </header>
    </>
  );
}
