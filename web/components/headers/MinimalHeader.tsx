"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "@/components/SmartImage";
import Logo from "../Logo";
import UserMenu from "../UserMenu";
import HeaderSearchButton from "../HeaderSearchButton";
import { DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";
import type { HeaderConfig } from "@/lib/visual-presets";
import type { PortalBranding } from "@/lib/portal-context";

interface MinimalHeaderProps {
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

/**
 * Minimal Header Template
 * Logo + user menu only, no navigation tabs in header.
 * Clean, professional look ideal for corporate portals.
 */
export default function MinimalHeader({
  portalSlug,
  portalName,
  branding,
  backLink,
  headerConfig,
}: MinimalHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  // Track scroll for glass effect
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Logo size classes
  const logoSizeClass = headerConfig.logo_size === "lg" ? "h-10" : headerConfig.logo_size === "sm" ? "h-6" : "h-8";

  return (
    <header
      className={`sticky top-0 z-[100] border-b transition-all duration-300 ${
        isScrolled
          ? "glass border-[var(--twilight)]/50"
          : "bg-[var(--void)]/95 backdrop-blur-sm border-[var(--twilight)]/30"
      }`}
    >
      <div className="px-4 py-3 flex items-center justify-between">
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
              {/* Only show "powered by" if attribution is not hidden */}
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

        {/* Right: Search (optional) + User menu */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {headerConfig.show_search_in_header && <HeaderSearchButton />}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
