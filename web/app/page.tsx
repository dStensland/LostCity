import { getFilteredEventsWithSearch, getEventsForMap, type SearchFilters } from "@/lib/search";
import EventCard from "@/components/EventCard";
import SearchBar from "@/components/SearchBar";
import FilterBar from "@/components/FilterBar";
import ViewToggle from "@/components/ViewToggle";
import MapViewWrapper from "@/components/MapViewWrapper";
import AtlantaSkyline from "@/components/AtlantaSkyline";
import Link from "next/link";
import { format, parseISO, isToday, isTomorrow, isThisWeek } from "date-fns";
import { Suspense } from "react";

export const revalidate = 60;

const PAGE_SIZE = 20;

type Props = {
  searchParams: Promise<{
    page?: string;
    search?: string;
    categories?: string;
    free?: string;
    date?: string;
    venue?: string;
    view?: string;
  }>;
};

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || "1", 10));
  const currentView = (params.view === "map" ? "map" : "list") as "list" | "map";

  const filters: SearchFilters = {
    search: params.search || undefined,
    categories: params.categories?.split(",").filter(Boolean) || undefined,
    is_free: params.free === "true" || undefined,
    date_filter: (params.date as "today" | "weekend" | "week") || undefined,
    venue_id: params.venue ? parseInt(params.venue, 10) : undefined,
  };

  const { events, total } = await getFilteredEventsWithSearch(filters, currentPage, PAGE_SIZE);
  const mapEvents = currentView === "map" ? await getEventsForMap(filters) : [];
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const eventsByDate = events.reduce(
    (acc, event) => {
      const date = event.start_date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(event);
      return acc;
    },
    {} as Record<string, typeof events>
  );

  const dates = Object.keys(eventsByDate).sort();

  function getDateLabel(dateStr: string): string {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    if (isThisWeek(date)) return format(date, "EEEE");
    return format(date, "EEEE, MMMM d");
  }

  function buildPageUrl(page: number): string {
    const urlParams = new URLSearchParams();
    urlParams.set("page", page.toString());
    if (params.search) urlParams.set("search", params.search);
    if (params.categories) urlParams.set("categories", params.categories);
    if (params.free) urlParams.set("free", params.free);
    if (params.date) urlParams.set("date", params.date);
    if (params.venue) urlParams.set("venue", params.venue);
    if (params.view) urlParams.set("view", params.view);
    return `/?${urlParams.toString()}`;
  }

  const hasActiveFilters = !!(params.search || params.categories || params.free || params.date || params.venue);

  return (
    <div className="min-h-screen relative">
      {/* Hero with Skyline */}
      <div className="relative h-[320px] md:h-[380px]">
        <AtlantaSkyline />

        {/* Hero Content */}
        <div className="relative z-10 h-full flex flex-col justify-center items-center px-4 pt-8">
          <h1 className="font-[family-name:var(--font-righteous)] text-5xl md:text-7xl text-white text-glow tracking-wide">
            LOST CITY
          </h1>
          <p className="mt-2 text-lg md:text-xl text-orange-100/90 font-medium">
            Discover Atlanta
          </p>

          {/* Search Bar in Hero */}
          <div className="mt-6 w-full max-w-xl">
            <Suspense fallback={<div className="h-12 bg-white/10 rounded-full animate-pulse" />}>
              <SearchBar />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="sticky top-0 z-30 bg-[#1E1B4B]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <Suspense fallback={<div className="h-10 flex-1 bg-white/5 rounded animate-pulse" />}>
              <FilterBar />
            </Suspense>
            <Suspense fallback={<div className="w-28 h-10 bg-white/5 rounded animate-pulse" />}>
              <ViewToggle currentView={currentView} />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-[#1E1B4B] border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <p className="text-sm text-orange-100/70">
            <span className="font-semibold text-orange-200">{total}</span>{" "}
            {hasActiveFilters ? "matching events" : "upcoming events"}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {currentView === "map" ? (
          <div className="rounded-xl overflow-hidden border border-white/10">
            <MapViewWrapper events={mapEvents} />
          </div>
        ) : (
          <>
            {dates.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-orange-100/60 text-lg">
                  {hasActiveFilters ? "No events match your filters." : "No upcoming events found."}
                </p>
                {hasActiveFilters && (
                  <Link href="/" className="mt-4 inline-block text-orange-400 hover:text-orange-300 transition-colors">
                    Clear all filters
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-10">
                {dates.map((date) => (
                  <section key={date}>
                    <h2 className="font-[family-name:var(--font-righteous)] text-xl text-orange-300 mb-4 sticky top-[72px] bg-[#1E1B4B] py-2 z-20">
                      {getDateLabel(date)}
                    </h2>
                    <div className="space-y-3">
                      {eventsByDate[date].map((event) => (
                        <EventCard key={event.id} event={event} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="mt-12 flex items-center justify-between border-t border-white/10 pt-6">
                <div className="flex-1 flex justify-start">
                  {currentPage > 1 && (
                    <Link
                      href={buildPageUrl(currentPage - 1)}
                      className="chip hover:bg-white/15"
                    >
                      Previous
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {generatePageNumbers(currentPage, totalPages).map((pageNum, idx) =>
                    pageNum === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-orange-100/50">...</span>
                    ) : (
                      <Link
                        key={pageNum}
                        href={buildPageUrl(pageNum as number)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
                          pageNum === currentPage
                            ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white"
                            : "chip"
                        }`}
                      >
                        {pageNum}
                      </Link>
                    )
                  )}
                </div>
                <div className="flex-1 flex justify-end">
                  {currentPage < totalPages && (
                    <Link
                      href={buildPageUrl(currentPage + 1)}
                      className="chip hover:bg-white/15"
                    >
                      Next
                    </Link>
                  )}
                </div>
              </nav>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-12">
        <div className="max-w-5xl mx-auto px-4 py-8 text-center">
          <p className="font-[family-name:var(--font-righteous)] text-2xl text-orange-400/80 mb-2">
            LOST CITY
          </p>
          <p className="text-sm text-orange-100/50">
            AI-powered event discovery for Atlanta
          </p>
        </div>
      </footer>
    </div>
  );
}

function generatePageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("...");
  if (total > 1) pages.push(total);

  return pages;
}
