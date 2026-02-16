"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getProxiedImageSrc } from "@/lib/image-proxy";
import { phoneHref } from "@/lib/forth-types";

interface HotelHeaderProps {
  portalSlug: string;
  portalName: string;
  logoUrl?: string | null;
  hideNav?: boolean;
  conciergePhone?: string;
}

/**
 * Minimal, refined header for hotel portal
 * Light background with thin border, hotel logo, and minimal navigation
 */
export default function HotelHeader({
  portalSlug,
  portalName,
  logoUrl,
  hideNav = false,
  conciergePhone,
}: HotelHeaderProps) {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") || "feed";
  const findType = searchParams.get("type") || "events";
  const [logoFailed, setLogoFailed] = useState(false);
  const resolvedLogoSrc = useMemo(() => {
    if (!logoUrl) return null;
    const proxied = getProxiedImageSrc(logoUrl);
    return typeof proxied === "string" ? proxied : null;
  }, [logoUrl]);

  const navLinks = [
    { href: `/${portalSlug}`, label: "Live", active: view === "feed" },
    { href: `/${portalSlug}?view=find&type=events`, label: "Tonight", active: view === "find" && findType === "events" },
    { href: `/${portalSlug}?view=find&type=destinations`, label: "Explore", active: view === "find" && findType === "destinations" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[var(--hotel-ivory)]/95 backdrop-blur-md border-b border-[var(--hotel-sand)] shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Hotel branding */}
        <Link href={`/${portalSlug}`} className="flex items-center gap-3">
          {resolvedLogoSrc && !logoFailed ? (
            <div className="relative h-8 w-auto">
              <Image
                src={resolvedLogoSrc}
                alt={portalName}
                height={32}
                width={120}
                className="object-contain"
                style={{ height: "32px", width: "auto" }}
                onError={() => {
                  setLogoFailed(true);
                }}
              />
            </div>
          ) : (
            <span className="font-display font-semibold text-xl text-[var(--hotel-charcoal)]">
              {portalName}
            </span>
          )}
          <span className="text-sm font-body text-[var(--hotel-stone)] uppercase tracking-[0.2em] hidden sm:inline">
            Concierge
          </span>
        </Link>

        {/* Navigation - desktop (hidden when pillar nav is used) */}
        {!hideNav && (
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-body uppercase tracking-wide transition-colors ${
                  link.active
                    ? "text-[var(--hotel-charcoal)]"
                    : "text-[var(--hotel-stone)] hover:text-[var(--hotel-champagne)]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        {/* Right side - concierge phone */}
        <div className="flex items-center gap-3">
          {conciergePhone && (
            <>
              {/* Desktop: full CTA */}
              <a
                href={phoneHref(conciergePhone)}
                className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--hotel-charcoal)] text-white text-sm font-body hover:bg-[var(--hotel-ink)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Concierge
              </a>
              {/* Mobile: phone icon */}
              <a
                href={phoneHref(conciergePhone)}
                className="md:hidden text-[var(--hotel-stone)] hover:text-[var(--hotel-charcoal)] transition-colors"
                aria-label="Call Concierge"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </a>
            </>
          )}
        </div>
      </div>

    </header>
  );
}
