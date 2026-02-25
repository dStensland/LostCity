"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { hospitalDisplayFont, hospitalBodyFont } from "@/lib/hospital-art";
import {
  DEFAULT_HOSPITAL_MODE,
  type HospitalAudienceMode,
} from "@/lib/hospital-modes";
import { HOSPITAL_MODE_VALUES } from "@/lib/analytics/portal-action-types";
import { trackPortalAction } from "@/lib/analytics/portal-action-tracker";
import LanguageSelector from "@/components/LanguageSelector";

type EmoryDemoHeaderProps = {
  portalSlug: string;
};

type NavKey = "hospital_hub" | "concierge" | "community_hub";

type NavItem = {
  key: NavKey;
  label: string;
  href: string;
};

const SEARCH_KEYS_TO_CLEAR = ["event", "spot", "series", "festival", "org"] as const;
const DEFAULT_EMORY_CONCIERGE_HOSPITAL = "emory-university-hospital";
const HOSPITAL_MODE_SET = new Set(HOSPITAL_MODE_VALUES);

function isHospitalMode(value: string): value is HospitalAudienceMode {
  return HOSPITAL_MODE_SET.has(value as HospitalAudienceMode);
}

function buildConciergeHref(portalSlug: string): string {
  return `/${portalSlug}/hospitals/${DEFAULT_EMORY_CONCIERGE_HOSPITAL}`;
}

function getActiveNav(pathname: string, searchParams: URLSearchParams, portalSlug: string): NavKey {
  if (pathname.startsWith(`/${portalSlug}/hospitals`)) return "concierge";
  if (pathname.startsWith(`/${portalSlug}/community-hub`)) return "community_hub";

  const view = searchParams.get("view");
  if (view === "community") return "community_hub";
  return "hospital_hub";
}

function EmoryShield({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 42"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M18 1L3 7v14c0 10 6.5 16 15 19 8.5-3 15-9 15-19V7L18 1z"
        fill="#002f6c"
      />
      <path
        d="M18 1L3 7v14c0 10 6.5 16 15 19V1z"
        fill="#003a7c"
      />
      <rect x="8" y="17" width="20" height="2.5" rx="1.25" fill="#c9a84c" />
    </svg>
  );
}

export default function EmoryDemoHeader({ portalSlug }: EmoryDemoHeaderProps) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const trackedModeSelectionRef = useRef<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const queryString = searchParams?.toString() || "";
  const queryParams = new URLSearchParams(queryString);

  const hospitalHubHref = `/${portalSlug}`;
  const communityHref = `/${portalSlug}/community-hub`;
  const hospitalsHref = `/${portalSlug}/hospitals`;
  const conciergeHref = buildConciergeHref(portalSlug);

  const activeNav = getActiveNav(pathname, queryParams, portalSlug);

  const navItems: NavItem[] = [
    { key: "hospital_hub", label: "Hospital Hub", href: hospitalHubHref },
    { key: "concierge", label: "Concierge", href: conciergeHref },
    { key: "community_hub", label: "Community", href: communityHref },
  ];

  const params = new URLSearchParams(queryParams.toString());
  const isPortalRoot = pathname === `/${portalSlug}`;
  const isCommunityView = isPortalRoot && params.get("view") === "community";

  SEARCH_KEYS_TO_CLEAR.forEach((key) => params.delete(key));

  if (params.get("mode") === DEFAULT_HOSPITAL_MODE) params.delete("mode");

  if (!isCommunityView) {
    params.delete("view");
    params.delete("tab");
    params.delete("support");
    for (const key of Array.from(params.keys())) {
      if (key.startsWith("community_hub_")) params.delete(key);
    }
  } else if (params.get("tab") === "groups") {
    params.delete("tab");
  }
  const cleanedQuery = params.toString();

  useEffect(() => {
    const currentQuery = queryString;
    if (cleanedQuery === currentQuery) return;
    router.replace(cleanedQuery ? `${pathname}?${cleanedQuery}` : pathname, { scroll: false });
  }, [cleanedQuery, pathname, queryString, router]);

  useEffect(() => {
    const paramsForTracking = new URLSearchParams(queryString);
    const modeParam = paramsForTracking.get("mode");
    if (!modeParam || !isHospitalMode(modeParam)) return;

    const key = `${pathname}:${modeParam}`;
    if (trackedModeSelectionRef.current === key) return;
    trackedModeSelectionRef.current = key;

    trackPortalAction(portalSlug, {
      action_type: "mode_selected",
      page_type: pathname.startsWith(`/${portalSlug}/hospitals`) ? "hospital" : "feed",
      mode_context: modeParam,
      section_key: "emory_header_mode",
      target_kind: "mode",
      target_id: modeParam,
      target_label: modeParam,
    });
  }, [pathname, portalSlug, queryString]);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  const toggleMobileNav = useCallback(() => {
    setMobileNavOpen((prev) => !prev);
  }, []);

  return (
    <header className={`${hospitalBodyFont.className} sticky top-0 z-[130]`}>
      {/* Utility bar */}
      <div className="bg-[#002f6c]">
        <div className="mx-auto flex max-w-[1240px] items-center justify-end gap-3 px-4 lg:px-6 h-9">
          <Link
            href={hospitalsHref}
            className="text-[11.5px] tracking-[0.02em] text-white/80 hover:text-white transition-colors"
          >
            Find a Location
          </Link>
          <span className="text-white/40 text-[11px] select-none" aria-hidden="true">&middot;</span>
          <Link
            href={conciergeHref}
            className="text-[11.5px] tracking-[0.02em] text-white/80 hover:text-white transition-colors"
          >
            Patient Resources
          </Link>
          <span className="text-white/40 text-[11px] select-none" aria-hidden="true">&middot;</span>
          <LanguageSelector onLocaleChange={() => window.location.reload()} />
        </div>
      </div>

      {/* Main navigation */}
      <div className="bg-white border-b border-[#d5dfef] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-4 lg:px-6 h-[60px]">
          {/* Logo */}
          <Link href={hospitalHubHref} className="flex items-center gap-2.5 min-w-0">
            <EmoryShield className="h-8 w-7 shrink-0" />
            <div className="min-w-0">
              <p className={`${hospitalDisplayFont.className} text-[17px] leading-tight text-[#002f6c] tracking-[-0.01em]`}>
                Emory Healthcare
              </p>
              <p className="text-[11px] tracking-[0.06em] uppercase text-[#6b7280] leading-none mt-0.5 font-medium">
                Community Companion
              </p>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Portal sections">
            {navItems.map((item) => {
              const isActive = item.key === activeNav;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`relative px-4 py-2 text-[13px] font-semibold tracking-[0.01em] transition-colors ${
                    isActive
                      ? "text-[#002f6c]"
                      : "text-[#4b5563] hover:text-[#002f6c]"
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-4 right-4 h-[2.5px] rounded-full bg-[#8ed585]" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2.5">
            <Link
              href={hospitalsHref}
              className="hidden sm:inline-flex items-center rounded-md bg-[#002f6c] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#003d8f] transition-colors"
            >
              All Hospitals
            </Link>

            {/* Mobile hamburger */}
            <button
              onClick={toggleMobileNav}
              className="lg:hidden flex items-center justify-center w-10 h-10 -mr-2 rounded-lg text-[#002f6c] hover:bg-[#f2f5fa] transition-colors"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileNavOpen}
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                {mobileNavOpen ? (
                  <path d="M6 6l10 10M16 6L6 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                ) : (
                  <>
                    <path d="M3 6h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M3 11h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M3 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileNavOpen && (
          <div className="lg:hidden border-t border-[#e5e7eb] bg-white">
            <nav className="mx-auto max-w-[1240px] px-4 py-3 space-y-1" aria-label="Portal sections">
              {navItems.map((item) => {
                const isActive = item.key === activeNav;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={closeMobileNav}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-semibold transition-colors ${
                      isActive
                        ? "bg-[#f0f7ee] text-[#002f6c] border-l-[2.5px] border-[#8ed585]"
                        : "text-[#374151] hover:bg-[#f2f5fa]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <Link
                href={hospitalsHref}
                onClick={closeMobileNav}
                className="sm:hidden flex items-center justify-center rounded-md bg-[#002f6c] px-3.5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#003d8f] transition-colors mt-2"
              >
                All Hospitals
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
