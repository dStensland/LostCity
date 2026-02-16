"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { hospitalBodyFont } from "@/lib/hospital-art";
import { DEFAULT_HOSPITAL_MODE } from "@/lib/hospital-modes";
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

function buildConciergeHref(portalSlug: string): string {
  return `/${portalSlug}/hospitals/${DEFAULT_EMORY_CONCIERGE_HOSPITAL}`;
}

function getActiveNav(pathname: string, searchParams: URLSearchParams, portalSlug: string): NavKey {
  if (pathname.startsWith(`/${portalSlug}/hospitals`)) return "concierge";

  const view = searchParams.get("view");
  if (view === "community") return "community_hub";
  return "hospital_hub";
}

function navClass(active: boolean): string {
  if (active) return "bg-[#8ed585] text-[#0f2f5f] border-[#7fcf75] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)]";
  return "text-[#374151] border-transparent hover:text-[#143b83] hover:bg-[#f3f5f8]";
}

export default function EmoryDemoHeader({ portalSlug }: EmoryDemoHeaderProps) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const queryString = searchParams?.toString() || "";
  const queryParams = new URLSearchParams(queryString);

  const hospitalHubHref = `/${portalSlug}`;
  const communityHref = `/${portalSlug}?view=community`;
  const hospitalsHref = `/${portalSlug}/hospitals`;
  const conciergeHref = buildConciergeHref(portalSlug);

  const activeNav = getActiveNav(pathname, queryParams, portalSlug);

  const navItems: NavItem[] = [
    { key: "hospital_hub", label: "Hospital Hub", href: hospitalHubHref },
    { key: "concierge", label: "Concierge", href: conciergeHref },
    { key: "community_hub", label: "Community Hub", href: communityHref },
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

  return (
    <header className="sticky top-0 z-[130] bg-[#f8f8f8]/95 backdrop-blur supports-[backdrop-filter]:bg-[#f8f8f8]/85">
      <div className={`${hospitalBodyFont.className} border-b border-[#d7dce4]`}>
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3 px-3 sm:px-4 lg:px-6 py-3">
          <Link href={hospitalHubHref} className="min-w-0 leading-none">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#002f6c] text-[10px] font-bold text-white">E</span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#111827]">Emory Health</p>
              <span className="hidden text-[11px] text-[#6b7280] sm:inline">Together</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1.5 lg:flex" aria-label="Portal sections">
            {navItems.map((item) => {
              const isActive = item.key === activeNav;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold leading-none transition-colors ${navClass(isActive)}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSelector onLocaleChange={() => window.location.reload()} />
            <Link
              href={hospitalsHref}
              className="inline-flex items-center rounded-md border border-[#002f6c] bg-[#002f6c] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#003d8f]"
            >
              All Hospitals
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
