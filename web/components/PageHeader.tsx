"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import UserMenu from "@/components/UserMenu";

interface PageHeaderProps {
  cityName?: string;
  citySlug?: string;
  showCollections?: boolean;
  showEvents?: boolean;
  showSpots?: boolean;
  showSubmit?: boolean;
  rightContent?: React.ReactNode;
  /** Show back button with contextual label */
  backLink?: {
    href: string;
    label: string;
  };
  /** Show simplified main navigation tabs */
  showNav?: boolean;
}

export default function PageHeader({
  cityName = "Atlanta",
  citySlug = "atlanta",
  showCollections = false,
  showEvents = true,
  showSpots = false,
  showSubmit = false,
  rightContent,
  backLink,
  showNav = false,
}: PageHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Helper to check if a path is active
  const isActive = (path: string) => {
    if (path === `/${citySlug}`) {
      // Events link: active on city root or /events paths
      return pathname === path || pathname.startsWith(`/${citySlug}/events`) || pathname.startsWith("/events/");
    }
    return pathname.startsWith(path);
  };

  const linkBaseClass = "font-mono text-[0.7rem] font-medium uppercase tracking-wide transition-colors relative";
  const activeClass = "text-[var(--neon-amber)]";
  const inactiveClass = "text-[var(--muted)] hover:text-[var(--cream)]";

  return (
    <>
      <header className="sticky top-0 z-40 px-4 sm:px-6 py-4 flex justify-between items-center border-b border-[var(--twilight)] bg-[var(--void)]/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {backLink && (
            <button
              onClick={() => router.push(backLink.href)}
              className="flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--cream)] transition-colors mr-2"
              aria-label={`Back to ${backLink.label}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-mono text-xs hidden sm:inline">{backLink.label}</span>
            </button>
          )}
          <Logo href={`/${citySlug}`} portal={citySlug} />
        </div>
        <nav className="flex items-center gap-4 sm:gap-6">
          {showEvents && (
            <Link
              href={`/${citySlug}`}
              className={`${linkBaseClass} ${isActive(`/${citySlug}`) ? activeClass : inactiveClass}`}
            >
              Events
              {isActive(`/${citySlug}`) && (
                <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[var(--neon-amber)] rounded-full" />
              )}
            </Link>
          )}
          {showSpots && (
            <Link
              href={`/${citySlug}?view=spots`}
              className={`${linkBaseClass} ${pathname.includes("view=spots") ? activeClass : inactiveClass}`}
            >
              Spots
              {pathname.includes("view=spots") && (
                <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[var(--neon-amber)] rounded-full" />
              )}
            </Link>
          )}
          {showCollections && (
            <Link
              href="/collections"
              className={`${linkBaseClass} ${isActive("/collections") ? activeClass : inactiveClass}`}
            >
              Collections
              {isActive("/collections") && (
                <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[var(--neon-amber)] rounded-full" />
              )}
            </Link>
          )}
          {showSubmit && (
            <a
              href="mailto:hello@lostcity.ai"
              className={`${linkBaseClass} ${inactiveClass} hidden sm:inline`}
            >
              Submit
            </a>
          )}
          {rightContent}
          <UserMenu />
        </nav>
      </header>
      {showNav && (
        <nav className="sticky top-14 z-30 bg-[var(--night)]/95 backdrop-blur-sm border-b border-[var(--twilight)]/50">
          <div className="max-w-3xl mx-auto px-4">
            <div className="flex gap-1 py-3 overflow-x-auto scrollbar-hide">
              <Link
                href={`/${citySlug}`}
                className={`nav-tab relative px-4 py-2 rounded-md font-mono text-sm whitespace-nowrap transition-all duration-300 ${
                  pathname === `/${citySlug}` || pathname.startsWith("/events/")
                    ? "nav-tab-active text-[var(--void)] font-medium"
                    : "text-[var(--muted)] hover:text-[var(--neon-amber)] border border-transparent"
                }`}
              >
                Events
              </Link>
              <Link
                href={`/${citySlug}?view=spots`}
                className={`nav-tab relative px-4 py-2 rounded-md font-mono text-sm whitespace-nowrap transition-all duration-300 ${
                  pathname.includes("view=spots") || pathname.startsWith("/spots/")
                    ? "nav-tab-active text-[var(--void)] font-medium"
                    : "text-[var(--muted)] hover:text-[var(--neon-amber)] border border-transparent"
                }`}
              >
                Places
              </Link>
              <Link
                href={`/${citySlug}?view=happening-now`}
                className={`nav-tab relative px-4 py-2 rounded-md font-mono text-sm whitespace-nowrap transition-all duration-300 text-[var(--muted)] hover:text-[var(--neon-amber)] border border-transparent`}
              >
                Stuff around You
              </Link>
            </div>
          </div>
        </nav>
      )}
    </>
  );
}
