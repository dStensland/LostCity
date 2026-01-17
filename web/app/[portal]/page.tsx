import { getFilteredEventsWithSearch, enrichEventsWithSocialProof, PRICE_FILTERS, type SearchFilters } from "@/lib/search";
import { getPortalBySlug, DEFAULT_PORTAL } from "@/lib/portal";
import SearchBar from "@/components/SearchBar";
import FilterBar from "@/components/FilterBar";
import EventList from "@/components/EventList";
import ModeToggle from "@/components/ModeToggle";
import Logo from "@/components/Logo";
import UserMenu from "@/components/UserMenu";
import HomeFriendsActivity from "@/components/HomeFriendsActivity";
import PopularThisWeek from "@/components/PopularThisWeek";
import HeaderSearchButton from "@/components/HeaderSearchButton";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const revalidate = 60;

const PAGE_SIZE = 20;

type Props = {
  params: Promise<{ portal: string }>;
  searchParams: Promise<{
    search?: string;
    categories?: string;
    subcategories?: string;
    tags?: string;
    vibes?: string;
    neighborhoods?: string;
    price?: string;
    date?: string;
  }>;
};

export default async function PortalPage({ params, searchParams }: Props) {
  const { portal: slug } = await params;
  const searchParamsData = await searchParams;

  // Get portal data
  let portal = await getPortalBySlug(slug);

  // Fallback for Atlanta if not in database
  if (!portal && slug === "atlanta") {
    portal = DEFAULT_PORTAL;
  }

  if (!portal) {
    notFound();
  }

  // Parse price filter
  const priceFilter = PRICE_FILTERS.find(p => p.value === searchParamsData.price);
  const isFree = searchParamsData.price === "free";
  const priceMax = priceFilter?.max || undefined;

  // Build filters, incorporating portal-specific filters
  const filters: SearchFilters = {
    search: searchParamsData.search || undefined,
    categories: searchParamsData.categories?.split(",").filter(Boolean) || portal.filters.categories || undefined,
    subcategories: searchParamsData.subcategories?.split(",").filter(Boolean) || undefined,
    tags: searchParamsData.tags?.split(",").filter(Boolean) || undefined,
    vibes: searchParamsData.vibes?.split(",").filter(Boolean) || undefined,
    neighborhoods: searchParamsData.neighborhoods?.split(",").filter(Boolean) || undefined,
    is_free: isFree || undefined,
    price_max: priceMax,
    date_filter: (searchParamsData.date as "today" | "weekend" | "week") || undefined,
    // Apply portal city filter
    city: portal.filters.city || undefined,
  };

  // Always fetch page 1 on server for initial SSR
  const { events: rawEvents, total } = await getFilteredEventsWithSearch(filters, 1, PAGE_SIZE);

  // Enrich with social proof counts (RSVPs, recommendations)
  const events = await enrichEventsWithSocialProof(rawEvents);

  const hasActiveFilters = !!(searchParamsData.search || searchParamsData.categories || searchParamsData.subcategories || searchParamsData.tags || searchParamsData.vibes || searchParamsData.neighborhoods || searchParamsData.price || searchParamsData.date);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 flex justify-between items-center border-b border-[var(--twilight)]">
        <div className="flex items-baseline gap-3">
          <Logo href={`/${portal.slug}`} />
          <span className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest hidden sm:inline">
            {portal.name}
          </span>
        </div>
        <nav className="flex items-center gap-3 sm:gap-4">
          <HeaderSearchButton />
          <Link href="/collections" className="font-mono text-[0.7rem] font-medium text-[var(--muted)] uppercase tracking-wide hover:text-[var(--cream)] transition-colors hidden sm:inline">
            Collections
          </Link>
          <a href="mailto:hello@lostcity.ai" className="font-mono text-[0.7rem] font-medium text-[var(--muted)] uppercase tracking-wide hover:text-[var(--cream)] transition-colors hidden sm:inline">
            Submit
          </a>
          <UserMenu />
        </nav>
      </header>

      {/* Mode Toggle + Search */}
      <section className="py-4 sm:py-6 border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <ModeToggle />
            {/* Search Bar */}
            <div className="flex-1 max-w-md">
              <Suspense fallback={<div className="h-10 bg-[var(--night)] rounded-lg animate-pulse" />}>
                <SearchBar />
              </Suspense>
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <Suspense fallback={<div className="h-24 bg-[var(--night)]" />}>
        <FilterBar />
      </Suspense>

      {/* Popular This Week - only shows if events have engagement */}
      <Suspense fallback={null}>
        <PopularThisWeek />
      </Suspense>

      {/* Event count */}
      <div className="max-w-3xl mx-auto px-4 border-b border-[var(--twilight)]">
        <p className="font-mono text-xs text-[var(--muted)] py-3">
          <span className="text-[var(--soft)]">{total}</span>{" "}
          {hasActiveFilters ? "matching events" : "upcoming events"}
        </p>
      </div>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 pb-12">
        {/* Friends Activity - only shows for logged-in users with friends */}
        <div className="pt-4">
          <HomeFriendsActivity />
        </div>

        <Suspense fallback={<div className="py-16 text-center text-[var(--muted)]">Loading events...</div>}>
          <EventList
            initialEvents={events}
            initialTotal={total}
            hasActiveFilters={hasActiveFilters}
          />
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--twilight)] bg-[var(--night)]">
        <div className="max-w-3xl mx-auto px-4 py-8 text-center">
          <Logo size="md" href={undefined} />
          <p className="font-serif text-[var(--muted)] mt-1">
            {portal.tagline || `The real ${portal.name}, found`}
          </p>
          <p className="font-mono text-[0.6rem] text-[var(--muted)] mt-4 opacity-60">
            AI-powered · Updated continuously
          </p>
        </div>
      </footer>
    </div>
  );
}
