"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
}

export default function PageHeader({
  cityName = "Atlanta",
  citySlug = "atlanta",
  showCollections = false,
  showEvents = true,
  showSpots = false,
  showSubmit = false,
  rightContent,
}: PageHeaderProps) {
  const pathname = usePathname();

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
    <header className="px-4 sm:px-6 py-4 flex justify-between items-center border-b border-[var(--twilight)]">
      <div className="flex items-baseline gap-3">
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
            href="/spots"
            className={`${linkBaseClass} ${isActive("/spots") ? activeClass : inactiveClass}`}
          >
            Spots
            {isActive("/spots") && (
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
  );
}
