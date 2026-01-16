import Link from "next/link";
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
  return (
    <header className="px-4 sm:px-6 py-4 flex justify-between items-center border-b border-[var(--twilight)]">
      <div className="flex items-baseline gap-3">
        <Logo href={`/${citySlug}`} />
        <span className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest hidden sm:inline">
          {cityName}
        </span>
      </div>
      <nav className="flex items-center gap-4 sm:gap-6">
        {showEvents && (
          <Link
            href={`/${citySlug}`}
            className="font-mono text-[0.7rem] font-medium text-[var(--muted)] uppercase tracking-wide hover:text-[var(--cream)] transition-colors"
          >
            Events
          </Link>
        )}
        {showSpots && (
          <Link
            href="/spots"
            className="font-mono text-[0.7rem] font-medium text-[var(--muted)] uppercase tracking-wide hover:text-[var(--cream)] transition-colors"
          >
            Spots
          </Link>
        )}
        {showCollections && (
          <Link
            href="/collections"
            className="font-mono text-[0.7rem] font-medium text-[var(--muted)] uppercase tracking-wide hover:text-[var(--cream)] transition-colors"
          >
            Collections
          </Link>
        )}
        {showSubmit && (
          <a
            href="mailto:hello@lostcity.ai"
            className="font-mono text-[0.7rem] font-medium text-[var(--muted)] uppercase tracking-wide hover:text-[var(--cream)] transition-colors hidden sm:inline"
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
