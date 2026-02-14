"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { hospitalBodyFont } from "@/lib/hospital-art";

type EmoryDemoHeaderProps = {
  portalSlug: string;
};

type NavKey = "hospital_hub" | "hospitals" | "concierge" | "community_hub" | "programs";

type NavItem = {
  key: NavKey;
  label: string;
  href: string;
};

const SEARCH_KEYS_TO_CLEAR = ["event", "spot", "series", "festival", "org"] as const;
const DEFAULT_EMORY_CONCIERGE_HOSPITAL = "emory-university-hospital";

function getBaseQuery(searchParams: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(searchParams.toString());
  SEARCH_KEYS_TO_CLEAR.forEach((key) => params.delete(key));
  return params;
}

function buildPortalHref(portalSlug: string, currentParams: URLSearchParams, view: "feed" | "community"): string {
  const params = getBaseQuery(currentParams);

  if (view === "feed") {
    params.delete("view");
    params.delete("type");
    params.delete("display");
    params.delete("tab");
  } else {
    params.set("view", "community");
    params.delete("type");
    params.delete("display");
    params.set("tab", "groups");
  }

  const query = params.toString();
  return query ? `/${portalSlug}?${query}` : `/${portalSlug}`;
}

function buildHospitalsHref(portalSlug: string, currentParams: URLSearchParams, modeOverride?: string): string {
  const params = getBaseQuery(currentParams);
  params.delete("view");
  params.delete("tab");
  params.delete("type");
  params.delete("display");
  if (modeOverride) params.set("mode", modeOverride);
  const query = params.toString();
  return query ? `/${portalSlug}/hospitals?${query}` : `/${portalSlug}/hospitals`;
}

function buildConciergeHref(portalSlug: string, currentParams: URLSearchParams): string {
  const params = getBaseQuery(currentParams);
  params.delete("view");
  params.delete("tab");
  params.delete("type");
  params.delete("display");
  params.set("mode", "visitor");
  const query = params.toString();
  return query
    ? `/${portalSlug}/hospitals/${DEFAULT_EMORY_CONCIERGE_HOSPITAL}?${query}`
    : `/${portalSlug}/hospitals/${DEFAULT_EMORY_CONCIERGE_HOSPITAL}`;
}

function getActiveNav(pathname: string, searchParams: URLSearchParams, portalSlug: string): NavKey {
  if (pathname.startsWith(`/${portalSlug}/programs`)) return "programs";
  if (pathname.startsWith(`/${portalSlug}/hospitals/`)) return "concierge";
  if (pathname === `/${portalSlug}/hospitals` || pathname.startsWith(`/${portalSlug}/hospitals?`)) return "hospitals";

  const view = searchParams.get("view");
  if (view === "community") return "community_hub";
  return "hospital_hub";
}

function navClass(active: boolean): string {
  if (active) return "bg-[#8ed585] text-[#0f2f5f] border-[#7fcf75] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)]";
  return "text-[#374151] border-transparent hover:text-[#143b83] hover:bg-[#f3f5f8]";
}

export default function EmoryDemoHeader({ portalSlug }: EmoryDemoHeaderProps) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const queryParams = new URLSearchParams(searchParams?.toString() || "");

  const hospitalHubHref = buildPortalHref(portalSlug, queryParams, "feed");
  const communityHref = buildPortalHref(portalSlug, queryParams, "community");
  const hospitalsHref = buildHospitalsHref(portalSlug, queryParams);
  const conciergeHref = buildConciergeHref(portalSlug, queryParams);
  const programsHref = `/${portalSlug}/programs`;

  const activeNav = getActiveNav(pathname, queryParams, portalSlug);

  const navItems: NavItem[] = [
    { key: "hospital_hub", label: "Hospital Hub", href: hospitalHubHref },
    { key: "hospitals", label: "Hospitals", href: hospitalsHref },
    { key: "concierge", label: "Concierge", href: conciergeHref },
    { key: "community_hub", label: "Community Hub", href: communityHref },
    { key: "programs", label: "Programs", href: programsHref },
  ];

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

          <div className="flex items-center gap-1.5">
            <Link
              href={hospitalsHref}
              className="hidden sm:inline-flex items-center rounded-md border border-[#111111] bg-[#111111] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1f1f1f]"
            >
              Find Care
            </Link>
            <Link
              href={conciergeHref}
              className="hidden sm:inline-flex items-center rounded-md border border-[#111111] bg-[#111111] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1f1f1f]"
            >
              My Concierge
            </Link>
            <Link
              href={hospitalsHref}
              className="inline-flex items-center rounded-md border border-[#111111] bg-[#111111] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1f1f1f]"
            >
              Directions
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
