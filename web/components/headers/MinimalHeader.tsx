"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "@/components/SmartImage";
import Logo from "../Logo";
import UserMenu from "../UserMenu";
import HeaderSearchButton from "../HeaderSearchButton";
import BackButton from "./BackButton";
import { DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";
import type { HeaderConfig } from "@/lib/visual-presets";
import type { PortalBranding } from "@/lib/portal-context";

interface MinimalHeaderProps {
  portalSlug: string;
  portalName: string;
  branding: PortalBranding;
  backLink?: {
    href?: string;
    fallbackHref?: string;
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
  const searchParams = useSearchParams();
  const currentView = searchParams?.get("view");

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
      className={`sticky top-0 z-[100] border-b transition-all duration-300 backdrop-blur-md ${
        isScrolled
          ? "bg-[var(--void)]/95 border-[var(--twilight)]/50 shadow-sm"
          : "bg-[var(--void)]/95 border-[var(--twilight)]/30"
      }`}
    >
      <div className="px-4 py-3 flex items-center justify-between">
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
              {!branding?.hide_attribution && (
                <Link
                  href={`/${DEFAULT_PORTAL_SLUG}`}
                  className="hidden sm:inline-flex items-center gap-1 opacity-40 hover:opacity-70 transition-opacity"
                  title="Powered by Lost City"
                >
                  <span className="text-2xs font-mono text-[var(--muted)]">on</span>
                  <span className="text-2xs font-mono font-semibold text-[var(--soft)]">Lost City</span>
                </Link>
              )}
            </div>
          ) : portalSlug !== DEFAULT_PORTAL_SLUG ? (
            <div className="flex items-center gap-3">
              <Link href={`/${portalSlug}`} className="flex items-center gap-2.5 group/logo">
                {/* Portal monogram — squircle mark using portal colors */}
                <div
                  className="relative w-8 h-8 shrink-0 rounded-[9px] flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, var(--action-primary) 0%, color-mix(in srgb, var(--action-primary) 70%, #34d399) 100%)",
                    boxShadow: "0 2px 6px color-mix(in srgb, var(--action-primary) 20%, transparent)",
                  }}
                >
                  <span
                    className="text-sm font-extrabold text-white leading-none"
                    style={{ letterSpacing: "-0.03em" }}
                  >
                    {portalName.charAt(0).toUpperCase()}
                  </span>
                </div>
                {/* Portal wordmark — colored with action-primary for identity */}
                <span
                  className="font-semibold text-xl tracking-tight leading-none transition-opacity group-hover/logo:opacity-75"
                  style={{
                    fontFamily: "var(--portal-font-heading, inherit)",
                    color: "var(--action-primary)",
                  }}
                >
                  {portalName}
                </span>
              </Link>
              {/* Attribution — subtle, non-competing */}
              {!branding?.hide_attribution && (
                <Link
                  href={`/${DEFAULT_PORTAL_SLUG}`}
                  className="hidden sm:inline-flex items-center gap-1 opacity-40 hover:opacity-70 transition-opacity"
                  title="Powered by Lost City"
                >
                  <span className="text-2xs font-mono text-[var(--muted)]">on</span>
                  <span className="text-2xs font-mono font-semibold text-[var(--soft)]">Lost City</span>
                </Link>
              )}
            </div>
          ) : (
            <Logo href={`/${portalSlug}`} size="sm" portal={portalSlug} />
          )}
        </div>

        {/* Right: Search (optional) + User menu */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {headerConfig.show_search_in_header && currentView !== "find" && <HeaderSearchButton portalSlug={portalSlug} />}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
