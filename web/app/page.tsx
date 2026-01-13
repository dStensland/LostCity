import { getFilteredEventsWithSearch, getVenuesWithEvents, type SearchFilters } from "@/lib/search";
import SearchBar from "@/components/SearchBar";
import FilterBar from "@/components/FilterBar";
import ActiveFilters from "@/components/ActiveFilters";
import EventList from "@/components/EventList";
import Link from "next/link";
import { Suspense } from "react";

export const revalidate = 60;

const PAGE_SIZE = 20;

type Props = {
  searchParams: Promise<{
    search?: string;
    categories?: string;
    subcategories?: string;
    free?: string;
    date?: string;
    venue?: string;
  }>;
};

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;

  const filters: SearchFilters = {
    search: params.search || undefined,
    categories: params.categories?.split(",").filter(Boolean) || undefined,
    subcategories: params.subcategories?.split(",").filter(Boolean) || undefined,
    is_free: params.free === "true" || undefined,
    date_filter: (params.date as "today" | "weekend" | "week") || undefined,
    venue_id: params.venue ? parseInt(params.venue, 10) : undefined,
  };

  // Always fetch page 1 on server for initial SSR
  const [{ events, total }, venues] = await Promise.all([
    getFilteredEventsWithSearch(filters, 1, PAGE_SIZE),
    getVenuesWithEvents(),
  ]);

  const hasActiveFilters = !!(params.search || params.categories || params.subcategories || params.free || params.date || params.venue);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 flex justify-between items-center border-b border-[var(--twilight)]">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="gradient-text text-xl font-bold tracking-tight">
            Lost City
          </Link>
          <span className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest hidden sm:inline">
            Atlanta
          </span>
        </div>
        <nav className="flex gap-4 sm:gap-6">
          <Link href="/?view=map" className="font-mono text-[0.7rem] font-medium text-[var(--muted)] uppercase tracking-wide hover:text-[var(--cream)] transition-colors">
            Map
          </Link>
          <a href="mailto:hello@lostcity.ai" className="font-mono text-[0.7rem] font-medium text-[var(--muted)] uppercase tracking-wide hover:text-[var(--cream)] transition-colors">
            Submit
          </a>
        </nav>
      </header>

      {/* Compact Hero with Search */}
      <section className="py-4 sm:py-6 border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Tagline - hidden on mobile for compactness */}
            <p className="hidden sm:block font-serif text-[var(--soft)] whitespace-nowrap">
              Every show, every gathering, every hidden gem
            </p>
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
      <section className="sticky top-0 z-30 bg-[var(--night)] border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <Suspense fallback={<div className="h-10 flex-1 bg-[var(--twilight)] rounded animate-pulse" />}>
            <FilterBar venues={venues} />
          </Suspense>
        </div>
      </section>

      {/* Active filters + Event count */}
      <div className="max-w-3xl mx-auto px-4 border-b border-[var(--twilight)]">
        <Suspense fallback={null}>
          <ActiveFilters />
        </Suspense>
        <p className="font-mono text-xs text-[var(--muted)] py-3">
          <span className="text-[var(--soft)]">{total}</span>{" "}
          {hasActiveFilters ? "matching events" : "upcoming events"}
        </p>
      </div>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 pb-12">
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
          <div className="gradient-text text-lg font-bold">Lost City</div>
          <p className="font-serif text-[var(--muted)] mt-1">
            The real Atlanta, found
          </p>
          <p className="font-mono text-[0.6rem] text-[var(--muted)] mt-4 opacity-60">
            AI-powered · Updated continuously
          </p>
        </div>
      </footer>
    </div>
  );
}
