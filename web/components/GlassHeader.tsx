"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "@/components/SmartImage";
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
      </nav>
    </header>
  );
}
