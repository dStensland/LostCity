"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { getProxiedImageSrc } from "@/lib/image-proxy";
import { phoneHref } from "@/lib/forth-types";

interface HotelHeaderProps {
  portalSlug: string;
  portalName: string;
  logoUrl?: string | null;
  hideNav?: boolean;
  conciergePhone?: string;
  onOpenPlanner?: () => void;
  plannerOpen?: boolean;
}

/**
 * Minimal, refined header for hotel portal
 * Light background with thin border, hotel logo, and section-anchor navigation
 */
export default function HotelHeader({
  portalSlug,
  portalName,
  logoUrl,
  hideNav = false,
  conciergePhone,
  onOpenPlanner,
  plannerOpen = false,
}: HotelHeaderProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const resolvedLogoSrc = useMemo(() => {
    if (!logoUrl) return null;
    const proxied = getProxiedImageSrc(logoUrl);
    return typeof proxied === "string" ? proxied : null;
  }, [logoUrl]);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  const navItems = [
    {
      label: "Discover",
      anchorId: "discover-hero",
      active: false,
      onClick: () => scrollTo("discover-hero"),
    },
    {
      label: "Plan Your Evening",
      anchorId: "planner-cta",
      active: plannerOpen,
      onClick: onOpenPlanner ?? (() => scrollTo("planner-cta")),
    },
    {
      label: "Neighborhood",
      anchorId: "nearby",
      active: false,
      onClick: () => scrollTo("nearby"),
    },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[var(--hotel-ivory)]/95 backdrop-blur-md border-b border-[var(--hotel-sand)] shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Hotel branding — wordmark only, no "Concierge" badge */}
        <Link href={`/${portalSlug}`} className="flex items-center">
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
            <span className="font-display font-semibold text-xl tracking-[0.15em] uppercase text-[var(--hotel-charcoal)]">
              {portalName}
            </span>
          )}
        </Link>

        {/* Section-anchor navigation — desktop only */}
        {!hideNav && (
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <button
                key={item.anchorId}
                type="button"
                onClick={item.onClick}
                className={`text-sm font-body uppercase tracking-wide transition-colors cursor-pointer ${
                  item.active
                    ? "text-[var(--hotel-champagne)]"
                    : "text-[var(--hotel-stone)] hover:text-[var(--hotel-charcoal)]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}

        {/* Right side — "Call Concierge" pill + mobile phone icon */}
        <div className="flex items-center gap-3">
          {conciergePhone && (
            <>
              {/* Desktop: full pill CTA */}
              <a
                href={phoneHref(conciergePhone)}
                className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--hotel-charcoal)] text-white text-sm font-body hover:bg-[var(--hotel-ink)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Call Concierge
              </a>
              {/* Mobile: phone icon only */}
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
