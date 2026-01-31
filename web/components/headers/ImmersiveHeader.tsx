"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Logo from "../Logo";
import UserMenu from "../UserMenu";
import HeaderSearchButton from "../HeaderSearchButton";
import HeroSection from "../HeroSection";
import { usePortalOptional, DEFAULT_PORTAL, DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";
import { useAuth } from "@/lib/auth-context";
import type { HeaderConfig } from "@/lib/visual-presets";
import type { PortalBranding } from "@/lib/portal-context";

interface ImmersiveHeaderProps {
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
};

const DEFAULT_TABS: NavTab[] = [
  { key: "feed", defaultLabel: "Feed", href: "feed" },
  { key: "find", defaultLabel: "Find", href: "find" },
  { key: "community", defaultLabel: "Community", href: "community" },
];

/**
 * Immersive Header Template
 * Transparent header over hero image that becomes solid on scroll.
 * Ideal for nightlife and visually-driven portals.
 */
export default function ImmersiveHeader({
  portalSlug,
  portalName,
  branding,
  backLink,
  hideNav = false,
  headerConfig,
}: ImmersiveHeaderProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const portalContext = usePortalOptional();
  const portal = portalContext?.portal ?? DEFAULT_PORTAL;
  const { user } = useAuth();

  // Get custom nav labels from portal settings
  const navLabels = (portal.settings?.nav_labels || {}) as Record<string, string | undefined>;

  // Build tabs with custom labels
  const TABS = DEFAULT_TABS
    .filter(tab => !tab.authRequired || user)
    .map(tab => ({
      ...tab,
      label: navLabels[tab.key] || tab.defaultLabel,
    }));

  const currentView = searchParams?.get("view") || "feed";

  // Hero config
  const heroConfig = headerConfig.hero;
  const heroImageUrl = heroConfig?.image_url || branding.hero_image_url;

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

  // Track scroll for transparency fade
  useEffect(() => {
    const handleScroll = () => {
      // Calculate scroll progress (0 = top, 1 = past hero)
      const heroHeight = window.innerHeight * 0.5; // Assume 50vh hero
      const progress = Math.min(1, window.scrollY / heroHeight);
      setScrollProgress(progress);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const getHref = (tab: typeof TABS[0]) => {
    if (tab.key === "feed") return `/${portalSlug}`;
    return `/${portalSlug}?view=${tab.key}`;
  };

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
  const logoSizeClass = headerConfig.logo_size === "sm" ? "h-8" : headerConfig.logo_size === "md" ? "h-10" : "h-12";

  // Dynamic header styles based on scroll
  const headerBg = scrollProgress > 0.3
    ? `rgba(9, 9, 11, ${Math.min(0.95, scrollProgress)})`
    : "transparent";
  const headerBorder = scrollProgress > 0.5
    ? "rgba(37, 37, 48, 0.5)"
    : "transparent";

  return (
    <>
      {/* Hero Section */}
      {heroImageUrl && (
        <HeroSection
          imageUrl={heroImageUrl}
          title={heroConfig?.title_visible !== false ? portal.name : undefined}
          tagline={heroConfig?.tagline_visible !== false ? portal.tagline || undefined : undefined}
          height={heroConfig?.height || "lg"}
          overlayOpacity={heroConfig?.overlay_opacity ?? 0.5}
          logoUrl={headerConfig.logo_position === "center" ? branding.logo_url : undefined}
        />
      )}

      {/* Floating Header */}
      <header
        className="fixed top-0 left-0 right-0 z-[100] transition-all duration-300"
        style={{
          background: headerBg,
          borderBottom: `1px solid ${headerBorder}`,
          backdropFilter: scrollProgress > 0.3 ? "blur(12px)" : "none",
        }}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          {/* Left: Back button (optional) + Logo (when not centered) */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {backLink && (
              <Link
                href={backLink.href}
                className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors mr-1"
                aria-label={`Back to ${backLink.label}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-mono text-xs hidden sm:inline">{backLink.label}</span>
              </Link>
            )}

            {headerConfig.logo_position !== "center" && (
              branding?.logo_url ? (
                <div className="flex items-center gap-2">
                  <Link href={`/${portalSlug}`}>
                    <Image
                      src={branding.logo_url}
                      alt={portalName}
                      width={120}
                      height={40}
                      className={`${logoSizeClass} w-auto object-contain`}
                    />
                  </Link>
                  {!branding?.hide_attribution && scrollProgress > 0.5 && (
                    <div className="hidden lg:flex items-center gap-1 text-[0.6rem] text-white/60 font-mono">
                      <span>powered by</span>
                      <Link href={`/${DEFAULT_PORTAL_SLUG}`} className="text-[var(--coral)] hover:opacity-80 transition-opacity">
                        Lost City
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <Logo href={`/${portalSlug}`} size="sm" portal={portalSlug} />
              )
            )}
          </div>

          {/* Center: Navigation (desktop, when header becomes solid) */}
          {!hideNav && scrollProgress > 0.5 && (
            <nav className="hidden sm:flex items-center gap-1 flex-1 max-w-md mx-auto justify-center">
              {TABS.map((tab) => {
                const active = isActive(tab);
                return (
                  <Link
                    key={tab.key}
                    href={getHref(tab)}
                    className={`nav-tab relative px-4 py-1.5 rounded-md font-mono text-xs whitespace-nowrap transition-all duration-300 ${
                      active
                        ? "nav-tab-active bg-white/20 text-white font-medium"
                        : "text-white/70 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Right: Search + User menu + Mobile menu */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {headerConfig.show_search_in_header !== false && (
              <div className={scrollProgress > 0.3 ? "" : "text-white"}>
                <HeaderSearchButton />
              </div>
            )}
            <UserMenu />

            {/* Mobile hamburger */}
            <div className="relative sm:hidden" ref={mobileMenuRef}>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors active:scale-95"
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
                    Navigate
                  </div>
                  {TABS.map((tab) => (
                    <Link
                      key={tab.key}
                      href={getHref(tab)}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-2 px-3 py-2 font-mono text-sm ${
                        isActive(tab)
                          ? "text-[var(--coral)] bg-[var(--twilight)]/30"
                          : "text-[var(--muted)] hover:text-[var(--neon-amber)] hover:bg-[var(--twilight)]/30"
                      }`}
                    >
                      {tab.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Fixed mobile nav at bottom when scrolled past hero */}
      {!hideNav && scrollProgress > 0.8 && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-[90] border-t border-[var(--twilight)]/50 bg-[var(--void)]/95 backdrop-blur-md">
          <div className="flex py-2 px-4 justify-around">
            {TABS.map((tab) => {
              const active = isActive(tab);
              return (
                <Link
                  key={tab.key}
                  href={getHref(tab)}
                  className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg font-mono text-xs transition-all duration-300 ${
                    active
                      ? "text-[var(--coral)]"
                      : "text-[var(--muted)] hover:text-[var(--cream)]"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
