"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Logo from "../Logo";
import UserMenu from "../UserMenu";
import HeaderSearchButton from "../HeaderSearchButton";
import ATLittleLogo from "../logos/ATLittleLogo";
import { usePortalOptional, DEFAULT_PORTAL, DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";
import { useAuth } from "@/lib/auth-context";
import type { HeaderConfig } from "@/lib/visual-presets";
import type { PortalBranding } from "@/lib/portal-context";

interface BrandedHeaderProps {
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
 * Branded Header Template
 * Large centered logo with navigation tabs below.
 * Ideal for community groups and family-friendly portals.
 */
export default function BrandedHeader({
  portalSlug,
  portalName,
  branding,
  backLink,
  hideNav = false,
  headerConfig,
}: BrandedHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
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

  // Check if light theme
  const isLightTheme = branding?.theme_mode === "light";

  // Nav style class
  const getNavStyleClass = () => {
    switch (headerConfig.nav_style) {
      case "pills":
        return "nav-tab-pills gap-2";
      case "underline":
        return "nav-tab-underline";
      case "minimal":
        return "nav-tab-minimal gap-4";
      default:
        return "gap-1";
    }
  };

  return (
    <header
      className={`sticky top-0 z-[100] border-b transition-all duration-300 ${
        isScrolled
          ? isLightTheme
            ? "bg-white/90 backdrop-blur-md border-[var(--twilight)]/20 shadow-sm"
            : "glass border-[var(--twilight)]/50"
          : isLightTheme
            ? "bg-[var(--void)]/95 backdrop-blur-sm border-[var(--twilight)]/20"
            : "bg-[var(--void)]/95 backdrop-blur-sm border-[var(--twilight)]/30"
      }`}
    >
      {/* Top row: back link, user menu */}
      <div className="px-4 py-2 flex items-center justify-between">
        {/* Left: Back button (optional) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {backLink ? (
            <Link
              href={backLink.href}
              className="flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
              aria-label={`Back to ${backLink.label}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-mono text-xs hidden sm:inline">{backLink.label}</span>
            </Link>
          ) : (
            <div className="w-12" /> // Spacer for alignment
          )}
        </div>

        {/* Right: Search + User menu + Mobile menu */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {headerConfig.show_search_in_header !== false && <HeaderSearchButton />}
          <UserMenu />

          {/* Mobile hamburger */}
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
              <div className={`absolute right-0 top-full mt-2 w-56 py-2 border rounded-lg shadow-xl z-50 ${
                isLightTheme
                  ? "bg-white border-gray-200"
                  : "bg-[var(--dusk)] border-[var(--twilight)]"
              }`}>
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
                        : "text-[var(--muted)] hover:text-[var(--coral)] hover:bg-[var(--twilight)]/30"
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

      {/* Center row: Large logo - collapses on scroll with smooth transform */}
      <div
        className="px-4 flex items-center justify-center overflow-hidden"
        style={{
          height: isScrolled ? "50px" : "86px",
          transition: "height 300ms ease-out",
        }}
      >
        {/* ATLittle logo for atlanta-families portal */}
        {portalSlug === "atlanta-families" ? (
          <Link
            href={`/${portalSlug}`}
            className="block"
            style={{
              transform: isScrolled ? "scale(0.65)" : "scale(1)",
              transformOrigin: "center center",
              transition: "transform 300ms ease-out",
            }}
          >
            <ATLittleLogo variant="header" className="h-[70px] w-auto" />
          </Link>
        ) : branding?.logo_url ? (
          <Link
            href={`/${portalSlug}`}
            className="block"
            style={{
              transform: isScrolled ? "scale(0.6)" : "scale(1)",
              transformOrigin: "center center",
              transition: "transform 300ms ease-out",
            }}
          >
            <Image
              src={branding.logo_url}
              alt={portalName}
              width={200}
              height={80}
              className="h-[80px] w-auto object-contain"
            />
          </Link>
        ) : (
          <div
            style={{
              transform: isScrolled ? "scale(0.7)" : "scale(1)",
              transformOrigin: "center center",
              transition: "transform 300ms ease-out",
            }}
          >
            <Logo href={`/${portalSlug}`} size="lg" portal={portalSlug} />
          </div>
        )}
      </div>

      {/* Bottom row: Navigation tabs (desktop) */}
      {!hideNav && (
        <nav className={`hidden sm:flex items-center justify-center pb-3 px-4 ${getNavStyleClass()}`}>
          {TABS.map((tab) => {
            const active = isActive(tab);
            return (
              <Link
                key={tab.key}
                href={getHref(tab)}
                className={`nav-tab relative px-4 py-1.5 rounded-full font-mono text-xs whitespace-nowrap transition-all duration-300 ${
                  active
                    ? "nav-tab-active bg-[var(--coral)] text-[var(--void)] font-medium"
                    : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Mobile navigation bar */}
      {!hideNav && (
        <nav className={`sm:hidden border-t border-[var(--twilight)]/30 ${
          isLightTheme ? "bg-white/80" : "bg-[var(--night)]/95"
        } ${getNavStyleClass()}`}>
          <div className="flex py-2 px-4 justify-center gap-2">
            {TABS.map((tab) => {
              const active = isActive(tab);
              return (
                <Link
                  key={tab.key}
                  href={getHref(tab)}
                  className={`nav-tab relative px-4 py-1.5 rounded-full font-mono text-xs whitespace-nowrap transition-all duration-300 ${
                    active
                      ? "nav-tab-active bg-[var(--coral)] text-[var(--void)] font-medium"
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
    </header>
  );
}
