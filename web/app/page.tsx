import Link from "next/link";
import Logo from "@/components/Logo";
import CategoryIcon from "@/components/CategoryIcon";
import { getPlatformStats } from "@/lib/supabase";
import { DEFAULT_PORTAL_SLUG, DEFAULT_PORTAL_NAME } from "@/lib/constants";

// Disable caching for this page
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Top categories to showcase
const FEATURED_CATEGORIES = [
  { type: "music", label: "Live Music" },
  { type: "comedy", label: "Comedy" },
  { type: "art", label: "Art & Culture" },
  { type: "nightlife", label: "Nightlife" },
  { type: "food_drink", label: "Food & Drink" },
  { type: "community", label: "Community" },
];

export default async function Home() {
  const stats = await getPlatformStats();

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center p-4 pt-24 pb-16 relative">
        {/* Coral glow effect */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "-50px",
            width: "500px",
            height: "300px",
            background: "radial-gradient(ellipse, rgba(255, 107, 122, 0.2) 0%, transparent 70%)",
            animation: "pulse-glow 4s ease-in-out infinite",
          }}
          aria-hidden="true"
        />

        <Logo size="lg" href={undefined} />
        <p className="font-serif text-[var(--muted)] mt-4 mb-8 text-lg text-center max-w-md">
          what the hell is going on?
        </p>
        <Link
          href={`/${DEFAULT_PORTAL_SLUG}`}
          className="px-8 py-4 bg-[var(--coral)]/90 text-[var(--cream)] rounded-lg font-medium transition-all text-lg hover:bg-[var(--coral)] hover:shadow-[0_0_30px_rgba(255,107,122,0.5)] hover:scale-[1.02] active:scale-[0.98]"
        >
          Explore {DEFAULT_PORTAL_NAME}
        </Link>
      </div>

      {/* Stats Row */}
      <div className="px-4 py-8">
        <div className="max-w-2xl mx-auto grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg border border-[var(--twilight)]" style={{ backgroundColor: "var(--card-bg)" }}>
            <div className="font-mono text-2xl sm:text-3xl font-bold gradient-text-stats">
              {stats.eventCount.toLocaleString()}+
            </div>
            <div className="font-mono text-[0.65rem] text-[var(--muted)] uppercase tracking-wider mt-1">
              Upcoming Events
            </div>
          </div>
          <div className="text-center p-4 rounded-lg border border-[var(--twilight)]" style={{ backgroundColor: "var(--card-bg)" }}>
            <div className="font-mono text-2xl sm:text-3xl font-bold gradient-text-stats">
              {stats.venueCount.toLocaleString()}+
            </div>
            <div className="font-mono text-[0.65rem] text-[var(--muted)] uppercase tracking-wider mt-1">
              Venues
            </div>
          </div>
          <div className="text-center p-4 rounded-lg border border-[var(--twilight)]" style={{ backgroundColor: "var(--card-bg)" }}>
            <div className="font-mono text-2xl sm:text-3xl font-bold gradient-text-stats">
              {stats.sourceCount}+
            </div>
            <div className="font-mono text-[0.65rem] text-[var(--muted)] uppercase tracking-wider mt-1">
              Sources
            </div>
          </div>
        </div>
      </div>

      {/* Value Props */}
      <div className="px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-mono text-[0.65rem] text-[var(--muted)] uppercase tracking-widest text-center mb-6">
            Why Lost City
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-lg border border-[var(--twilight)] card-interactive">
              <div className="w-10 h-10 rounded-lg bg-[var(--neon-magenta)]/15 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-[var(--neon-magenta)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-[var(--cream)] font-medium mb-1">
                {stats.sourceCount}+ Sources, One Feed
              </h3>
              <p className="text-sm text-[var(--muted)]">
                AI aggregates events from venues, promoters, and ticketing sites into one discovery feed.
              </p>
            </div>

            <div className="p-5 rounded-lg border border-[var(--twilight)] card-interactive">
              <div className="w-10 h-10 rounded-lg bg-[var(--neon-cyan)]/15 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-[var(--neon-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-[var(--cream)] font-medium mb-1">
                Real-Time Updates
              </h3>
              <p className="text-sm text-[var(--muted)]">
                Live events happening now. New shows added daily from Atlanta&apos;s best venues.
              </p>
            </div>

            <div className="p-5 rounded-lg border border-[var(--twilight)] card-interactive">
              <div className="w-10 h-10 rounded-lg bg-[var(--neon-green)]/15 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-[var(--neon-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-[var(--cream)] font-medium mb-1">
                See Who&apos;s Going
              </h3>
              <p className="text-sm text-[var(--muted)]">
                Connect with friends, RSVP to events, and discover what your community is into.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Category Preview */}
      <div className="px-4 py-8 pb-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-mono text-[0.65rem] text-[var(--muted)] uppercase tracking-widest text-center mb-6">
            Explore by Category
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {FEATURED_CATEGORIES.map((category) => (
              <Link
                key={category.type}
                href={`/${DEFAULT_PORTAL_SLUG}?category=${category.type}`}
                className="flex flex-col items-center p-4 rounded-lg border border-[var(--twilight)] transition-all hover:border-[var(--coral)]/40 hover:-translate-y-0.5 group"
                style={{ backgroundColor: "var(--card-bg)" }}
              >
                <CategoryIcon
                  type={category.type}
                  size={28}
                  glow="subtle"
                  className="mb-2 group-hover:scale-110 transition-transform"
                />
                <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider text-center group-hover:text-[var(--cream)] transition-colors">
                  {category.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto px-4 py-6 text-center border-t border-[var(--twilight)]">
        <p className="font-mono text-[0.55rem] text-[var(--muted)] opacity-60 mb-2">
          AI-powered event discovery for {DEFAULT_PORTAL_NAME}
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/privacy"
            className="font-mono text-[0.55rem] text-[var(--muted)] opacity-60 hover:opacity-100 hover:text-[var(--coral)] transition-all"
          >
            Privacy Policy
          </Link>
          <span className="font-mono text-[0.55rem] text-[var(--muted)] opacity-40">|</span>
          <Link
            href="/terms"
            className="font-mono text-[0.55rem] text-[var(--muted)] opacity-60 hover:opacity-100 hover:text-[var(--coral)] transition-all"
          >
            Terms of Use
          </Link>
        </div>
      </div>
    </div>
  );
}
