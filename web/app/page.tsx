import { getFilteredEventsWithSearch, getEventsForMap, type SearchFilters } from "@/lib/search";
import EventCard from "@/components/EventCard";
import SearchBar from "@/components/SearchBar";
import FilterBar from "@/components/FilterBar";
import ViewToggle from "@/components/ViewToggle";
import MapViewWrapper from "@/components/MapViewWrapper";
import Link from "next/link";
import { format, parseISO, isToday, isTomorrow, isThisWeek } from "date-fns";
import { Suspense } from "react";

export const revalidate = 60; // Revalidate every 60 seconds

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

  // Parse filter params
  const filters: SearchFilters = {
    search: params.search || undefined,
    categories: params.categories?.split(",").filter(Boolean) || undefined,
    is_free: params.free === "true" || undefined,
    date_filter: (params.date as "today" | "weekend" | "week") || undefined,
    venue_id: params.venue ? parseInt(params.venue, 10) : undefined,
  };

  // Fetch events
  const { events, total } = await getFilteredEventsWithSearch(
    filters,
    currentPage,
    PAGE_SIZE
  );

  // Fetch events for map if in map view
  const mapEvents = currentView === "map" ? await getEventsForMap(filters) : [];

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Group events by date (for list view)
  const eventsByDate = events.reduce(
    (acc, event) => {
      const date = event.start_date;
      if (!acc[date]) {
        acc[date] = [];
      }
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

  // Build pagination URL with current filters
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

  // Check if any filters are active
  const hasActiveFilters = !!(
    params.search ||
    params.categories ||
    params.free ||
    params.date ||
    params.venue
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold text-gray-900">Lost City</h1>
            </div>
            <Suspense fallback={<div className="flex-1 max-w-md h-10 bg-gray-100 rounded-lg animate-pulse" />}>
              <SearchBar />
            </Suspense>
            <Suspense fallback={<div className="w-32 h-10 bg-gray-100 rounded-lg animate-pulse" />}>
              <ViewToggle currentView={currentView} />
            </Suspense>
          </div>
        </div>
      </header>

      {/* Filter bar */}
      <Suspense fallback={<div className="bg-white border-b border-gray-200 h-24" />}>
        <FilterBar />
      </Suspense>

      {/* Stats bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{total}</span>{" "}
            {hasActiveFilters ? "matching events" : "upcoming events"}
          </p>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {currentView === "map" ? (
          /* Map view */
          <MapViewWrapper events={mapEvents} />
        ) : (
          /* List view */
          <>
            {dates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  {hasActiveFilters
                    ? "No events match your filters."
                    : "No upcoming events found."}
                </p>
                {hasActiveFilters && (
                  <Link
                    href="/"
                    className="mt-4 inline-block text-blue-600 hover:underline"
                  >
                    Clear all filters
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {dates.map((date) => (
                  <section key={date}>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 sticky top-0 bg-gray-50 py-2">
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
              <nav className="mt-12 flex items-center justify-between border-t border-gray-200 pt-6">
                <div className="flex-1 flex justify-start">
                  {currentPage > 1 && (
                    <Link
                      href={buildPageUrl(currentPage - 1)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Previous
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {generatePageNumbers(currentPage, totalPages).map((pageNum, idx) =>
                    pageNum === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-gray-500">
                        ...
                      </span>
                    ) : (
                      <Link
                        key={pageNum}
                        href={buildPageUrl(pageNum as number)}
                        className={`px-3 py-2 text-sm font-medium rounded-md ${
                          pageNum === currentPage
                            ? "bg-gray-900 text-white"
                            : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
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
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
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
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
          <p>Lost City &middot; AI-powered event discovery for Atlanta</p>
        </div>
      </footer>
    </div>
  );
}

function generatePageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];

  // Always show first page
  pages.push(1);

  if (current > 3) {
    pages.push("...");
  }

  // Show pages around current
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push("...");
  }

  // Always show last page
  if (total > 1) {
    pages.push(total);
  }

  return pages;
}
