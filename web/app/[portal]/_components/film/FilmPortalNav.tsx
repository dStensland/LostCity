"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";

type FilmPortalNavProps = {
  portalSlug: string;
};

const NAV_ITEMS = [
  { key: "home", label: "Home", path: "" },
  { key: "showtimes", label: "Showtimes", path: "/showtimes" },
  { key: "festivals", label: "Festivals", path: "/festivals" },
  { key: "programs", label: "Programs", path: "/programs" },
  { key: "calendar", label: "Calendar", path: "/calendar" },
  { key: "venues", label: "Venues", path: "/venues" },
  { key: "community", label: "Community", path: "/community-hub" },
  { key: "explore", label: "Explore", path: "?view=feed&tab=explore" },
];

function isActive(pathname: string, href: string): boolean {
  const basePathSegments = href.split("/").filter(Boolean);
  if (basePathSegments.length === 1) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function FilmPortalNav({ portalSlug }: FilmPortalNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        router.push(`/${portalSlug}?view=find&type=events&categories=film`);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [portalSlug, router]);

  return (
    <nav className="overflow-x-auto rounded-2xl border border-[#2d3650] bg-[#0b1120]/90 p-2">
      <div className="flex items-center gap-1.5">
        <ul className="flex min-w-max gap-1.5">
          {NAV_ITEMS.map((item) => {
            const isQueryPath = item.path.startsWith("?");
            const href = isQueryPath
              ? `/${portalSlug}${item.path}`
              : `/${portalSlug}${item.path}`;
            const active = isQueryPath ? false : isActive(pathname, href);
            return (
              <li key={item.key}>
                <Link
                  href={href}
                  className={`inline-flex rounded-xl px-3 py-2 text-xs uppercase tracking-[0.13em] transition-colors ${
                    active
                      ? "border border-[#8da8ea66] bg-[#8da8ea1f] text-[#d9e4ff]"
                      : "border border-transparent bg-[#10182b] text-[#a4b5d3] hover:border-[#33405f] hover:text-[#d8e2f5]"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() =>
            router.push(`/${portalSlug}?view=find&type=events&categories=film`)
          }
          className="ml-auto flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-[#10182b] p-2 text-[#a4b5d3] transition-colors hover:border-[#33405f] hover:text-[#d8e2f5]"
          aria-label="Search films (⌘K)"
        >
          <MagnifyingGlass size={16} />
        </button>
      </div>
    </nav>
  );
}
