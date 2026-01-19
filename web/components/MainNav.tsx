"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface Props {
  portalSlug?: string;
}

const TABS = [
  { label: "Feed", href: "feed", isView: true },
  { label: "Events", href: "events", isView: true },
  { label: "Spots", href: "/spots", isView: false },
  { label: "Happening Now", href: "/happening-now", isView: false },
] as const;

export default function MainNav({ portalSlug = "atlanta" }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") || "events";

  const getHref = (tab: typeof TABS[number]) => {
    if (tab.isView) {
      return `/${portalSlug}?view=${tab.href}`;
    }
    return tab.href;
  };

  const isActive = (tab: typeof TABS[number]) => {
    if (tab.isView) {
      // Check if we're on the portal page with this view
      const isPortalPage = pathname === `/${portalSlug}` || pathname === "/atlanta";
      return isPortalPage && currentView === tab.href;
    }
    // For non-view tabs, check pathname
    return pathname === tab.href || pathname.startsWith(tab.href + "/");
  };

  return (
    <nav className="sticky top-14 z-30 bg-[var(--night)]/95 backdrop-blur-sm border-b border-[var(--twilight)]/50">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex gap-1 py-2">
          {TABS.map((tab) => {
            const active = isActive(tab);
            return (
              <Link
                key={tab.label}
                href={getHref(tab)}
                className={`px-3 py-1.5 rounded-md font-mono text-sm transition-colors ${
                  active
                    ? "bg-[var(--coral)] text-[var(--void)] font-medium"
                    : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
