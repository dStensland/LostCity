import { getFilteredEventsWithSearch, enrichEventsWithSocialProof, PRICE_FILTERS, type SearchFilters } from "@/lib/search";
import SearchBar from "@/components/SearchBar";
import FilterBar from "@/components/FilterBar";
import EventList from "@/components/EventList";
import ModeToggle from "@/components/ModeToggle";
import Logo from "@/components/Logo";
import UserMenu from "@/components/UserMenu";
import Link from "next/link";
import { Suspense } from "react";

export const revalidate = 60;

const PAGE_SIZE = 20;

type Props = {
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

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;

  // Parse price filter
  const priceFilter = PRICE_FILTERS.find(p => p.value === params.price);
  const isFree = params.price === "free";
  const priceMax = priceFilter?.max || undefined;

  const filters: SearchFilters = {
    search: params.search || undefined,
    categories: params.categories?.split(",").filter(Boolean) || undefined,
    subcategories: params.subcategories?.split(",").filter(Boolean) || undefined,
    tags: params.tags?.split(",").filter(Boolean) || undefined,
    vibes: params.vibes?.split(",").filter(Boolean) || undefined,
    neighborhoods: params.neighborhoods?.split(",").filter(Boolean) || undefined,
    is_free: isFree || undefined,
    price_max: priceMax,
    date_filter: (params.date as "today" | "weekend" | "week") || undefined,
  };

  // Always fetch page 1 on server for initial SSR
  const { events: rawEvents, total } = await getFilteredEventsWithSearch(filters, 1, PAGE_SIZE);

  // Enrich with social proof counts (RSVPs, recommendations)
  const events = await enrichEventsWithSocialProof(rawEvents);

  const hasActiveFilters = !!(params.search || params.categories || params.subcategories || params.tags || params.vibes || params.neighborhoods || params.price || params.date);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 flex justify-between items-center border-b border-[var(--twilight)]">
        <div className="flex items-baseline gap-3">
          <Logo />
          <span className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest hidden sm:inline">
            Atlanta
          </span>
        </div>
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link href="/?view=map" className="font-mono text-[0.7rem] font-medium text-[var(--muted)] uppercase tracking-wide hover:text-[var(--cream)] transition-colors">
            Map
          </Link>
          <a href="mailto:hello@lostcity.ai" className="font-mono text-[0.7rem] font-medium text-[var(--muted)] uppercase tracking-wide hover:text-[var(--cream)] transition-colors">
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

      {/* Event count */}
      <div className="max-w-3xl mx-auto px-4 border-b border-[var(--twilight)]">
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
          <Logo size="md" href={undefined} />
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
