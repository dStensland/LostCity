"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { hospitalBodyFont, hospitalDisplayFont } from "@/lib/hospital-art";

type EmoryDemoHeaderProps = {
  portalSlug: string;
};

type NavKey = "feed" | "find" | "community" | "hospitals";

type NavItem = {
  key: NavKey;
  label: string;
  href: string;
};

const SEARCH_KEYS_TO_CLEAR = ["event", "spot", "series", "festival", "org"] as const;

function getBaseQuery(searchParams: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(searchParams.toString());
  SEARCH_KEYS_TO_CLEAR.forEach((key) => params.delete(key));
  return params;
}

function buildPortalHref(portalSlug: string, currentParams: URLSearchParams, view: "feed" | "find" | "community"): string {
  const params = getBaseQuery(currentParams);

  if (view === "feed") {
    params.delete("view");
    params.delete("type");
    params.delete("display");
    params.delete("tab");
  } else if (view === "find") {
    params.set("view", "find");
    params.set("type", "events");
    params.delete("tab");
  } else {
    params.set("view", "community");
    params.delete("type");
    params.delete("display");
    params.set("tab", "people");
  }

  const query = params.toString();
  return query ? `/${portalSlug}?${query}` : `/${portalSlug}`;
}

function getActiveNav(pathname: string, searchParams: URLSearchParams, portalSlug: string): NavKey {
  if (pathname.startsWith(`/${portalSlug}/hospitals`)) {
    return "hospitals";
  }

  const view = searchParams.get("view");
  if (view === "find" || view === "events" || view === "spots" || view === "map" || view === "calendar") {
    return "find";
  }
  if (view === "community") {
    return "community";
  }
  return "feed";
}

function navClass(active: boolean): string {
  if (active) {
    return "bg-[#edf3fb] text-[#002f6c] border-[#245ebc]/30 shadow-[inset_0_-2px_0_#245ebc]";
  }
  return "text-[#2d3d54] border-transparent hover:text-[#002f6c] hover:border-[#245ebc]/25 hover:bg-[#f7fafc]";
}

export default function EmoryDemoHeader({ portalSlug }: EmoryDemoHeaderProps) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const queryParams = new URLSearchParams(searchParams?.toString() || "");
  const activeNav = getActiveNav(pathname, queryParams, portalSlug);
  const mode = queryParams.get("mode");
  const persona = queryParams.get("persona");
  const directoryParams = new URLSearchParams();
  if (mode) directoryParams.set("mode", mode);
  if (persona) directoryParams.set("persona", persona);
  const directoryHref = directoryParams.toString()
    ? `/${portalSlug}/hospitals?${directoryParams.toString()}`
    : `/${portalSlug}/hospitals`;

  const navItems: NavItem[] = [
    { key: "feed", label: "Feed", href: buildPortalHref(portalSlug, queryParams, "feed") },
    { key: "find", label: "Find", href: buildPortalHref(portalSlug, queryParams, "find") },
    { key: "community", label: "Community", href: buildPortalHref(portalSlug, queryParams, "community") },
    { key: "hospitals", label: "Hospitals", href: directoryHref },
  ];

  return (
    <header className="sticky top-0 z-[130] shadow-[0_1px_0_rgba(0,0,0,0.08)]">
      <div className="border-b border-white/15 bg-black text-white">
        <div className="mx-auto flex h-10 max-w-6xl items-center justify-between px-4">
          <div className="hidden items-center gap-4 text-[11px] uppercase tracking-[0.07em] text-white/85 md:flex">
            <span>Medical Records</span>
            <span>Appointments</span>
            <span>Refer a Patient</span>
            <span>Contact Us</span>
          </div>
          <div className="text-[11px] uppercase tracking-[0.08em] text-white/85 md:hidden">Emory Healthcare</div>
          <button
            type="button"
            aria-label="Search"
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-white/25 text-white/85"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.4-4.4m1.4-5.1a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
            </svg>
          </button>
        </div>
      </div>

      <div className={`${hospitalBodyFont.className} border-b border-[#d6dfeb] bg-white`}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <Link href={`/${portalSlug}`} className="leading-none">
            <p className={`${hospitalDisplayFont.className} font-serif text-[46px] leading-[0.82] tracking-[-0.02em] text-[#111820]`}>EMORY</p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#111820]">Healthcare</p>
          </Link>
          <Link
            href={directoryHref}
            className="inline-flex items-center rounded-lg border border-[#7dcf74] bg-[#8ed585] px-4 py-2 text-sm font-semibold text-[#0d325d] shadow-[0_4px_14px_rgba(115,199,106,0.35)] transition-colors hover:bg-[#7dcf74]"
          >
            Hospital Directory
          </Link>
        </div>

        <nav className="mx-auto flex max-w-6xl items-center gap-1 px-4 pb-3" aria-label="Portal sections">
          {navItems.map((item) => {
            const isActive = item.key === activeNav;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`inline-flex rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.11em] transition-colors ${navClass(isActive)}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
