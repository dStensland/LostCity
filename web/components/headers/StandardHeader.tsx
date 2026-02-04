"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Logo from "../Logo";
import UserMenu from "../UserMenu";
import HeaderSearchButton from "../HeaderSearchButton";
import { usePortalOptional, DEFAULT_PORTAL, DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";
import { useAuth } from "@/lib/auth-context";
import type { HeaderConfig } from "@/lib/visual-presets";
import type { PortalBranding } from "@/lib/portal-context";

interface StandardHeaderProps {
  portalSlug: string;
  portalName: string;
  branding: PortalBranding;
  backLink?: {
    href: string;
    label: string;
  };
  hideNav?: boolean;
  headerConfig: HeaderConfig;
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

/**
 * Standard Header Template
 * Current layout: logo left, nav tabs center, user menu right
 */
export default function StandardHeader({
  portalSlug,
  portalName,
  branding,
  backLink,
  hideNav = false,
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

  // Build tabs with custom labels, filtering out auth-required tabs when not logged in
  const TABS = DEFAULT_TABS
    .filter(tab => !tab.authRequired || user)
    .map(tab => ({
      ...tab,
      label: navLabels[tab.key] || tab.defaultLabel,
    }));

  const currentView = searchParams?.get("view") || "feed";

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
      return `/${portalSlug}`;
    }
    return `/${portalSlug}?view=${tab.key}`;
  }, [portalSlug]);

  const isActive = (tab: typeof TABS[0]) => {
    const isPortalPage = pathname === `/${portalSlug}`;

    if (tab.key === "feed") {
      return isPortalPage && (!currentView || currentView === "feed");
    }
    if (tab.key === "find") {
      return isPortalPage && (currentView === "find" || currentView === "events" || currentView === "spots" || currentView === "map" || currentView === "calendar");
    }
    if (tab.key === "community") {
      return isPortalPage && currentView === "community";
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
        className="sticky top-0 z-[100] border-b border-[var(--twilight)]/30 bg-[var(--void)]/95 backdrop-blur-sm relative"
      >
        {/* Content layer */}
        <div className="relative z-10 flex flex-col">
        <div className="px-4 py-3 flex items-center gap-4 relative">
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

            {branding?.logo_url ? (
              <div className="flex items-center gap-2">
                <Link href={`/${portalSlug}`}>
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
            <nav
              className={`hidden sm:flex items-center flex-1 max-w-md mx-auto ${getNavStyleClass()}`}
              role="tablist"
              aria-label="Main navigation"
            >
              {TABS.map((tab, index) => {
                const active = isActive(tab);
                return (
                  <Link
                    key={tab.key}
                    href={getHref(tab)}
                    className={`nav-tab relative flex-1 text-center px-3 py-1.5 rounded-md font-mono text-xs whitespace-nowrap transition-all duration-300 ${
                      active
                        ? "nav-tab-active text-[var(--void)] font-medium"
                        : "text-[var(--cream)] hover:text-[var(--neon-amber)] border border-transparent font-semibold"
                    }`}
                    style={!active ? {
                      textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.5)",
                    } : undefined}
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
          )}

          {/* Right: Search, User menu, Mobile menu */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            {headerConfig.show_search_in_header !== false && <HeaderSearchButton />}
            <UserMenu />

            {/* Mobile hamburger menu */}
            <div className="relative sm:hidden" ref={mobileMenuRef}>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-[var(--cream)] hover:text-[var(--neon-amber)] hover:bg-[var(--twilight)]/70 rounded-lg transition-colors active:scale-95"
                style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))" }}
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
                <div className="absolute right-0 top-full mt-2 w-56 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-xl z-50">
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

        {/* Mobile Nav Bar (below header on mobile) */}
        {!hideNav && (
          <nav
            className={`sm:hidden border-t border-[var(--twilight)]/30 bg-[var(--night)]/95 ${getNavStyleClass()}`}
            role="tablist"
            aria-label="Main navigation"
          >
            <div className="flex py-2 px-4">
              {TABS.map((tab, index) => {
                const active = isActive(tab);
                return (
                  <Link
                    key={tab.key}
                    href={getHref(tab)}
                    className={`nav-tab relative flex-1 text-center py-1.5 rounded-md font-mono text-xs whitespace-nowrap transition-all duration-300 ${
                      active
                        ? "nav-tab-active text-[var(--void)] font-medium"
                        : "text-[var(--cream)] hover:text-[var(--neon-amber)] border border-transparent font-semibold"
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
        )}
        </div>{/* end content layer */}
      </header>
    </>
  );
}
