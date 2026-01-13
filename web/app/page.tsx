import { getFilteredEventsWithSearch, getEventsForMap, getVenuesWithEvents, type SearchFilters, type EventWithLocation } from "@/lib/search";
import EventCard from "@/components/EventCard";
import EventGroup from "@/components/EventGroup";
import SearchBar from "@/components/SearchBar";
import FilterBar from "@/components/FilterBar";
import ViewToggle from "@/components/ViewToggle";
import MapViewWrapper from "@/components/MapViewWrapper";
import Link from "next/link";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { Suspense } from "react";

// Rollup thresholds
const VENUE_ROLLUP_THRESHOLD = 4; // Collapse if venue has 4+ events
const CATEGORY_ROLLUP_THRESHOLD = 5; // Collapse if category has 5+ events
const ROLLUP_CATEGORIES = ["community"]; // Categories that get rolled up

type DisplayItem =
  | { type: "event"; event: EventWithLocation }
  | { type: "venue-group"; venueId: number; venueName: string; neighborhood: string | null; events: EventWithLocation[] }
  | { type: "category-group"; categoryId: string; categoryName: string; events: EventWithLocation[] };

function groupEventsForDisplay(events: EventWithLocation[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  const usedEventIds = new Set<number>();

  // First pass: Find venue clusters
  const venueGroups = new Map<number, EventWithLocation[]>();
  for (const event of events) {
    if (event.venue?.id) {
      const existing = venueGroups.get(event.venue.id) || [];
      existing.push(event);
      venueGroups.set(event.venue.id, existing);
    }
  }

  // Create venue groups for venues with enough events
  for (const [venueId, venueEvents] of venueGroups) {
    if (venueEvents.length >= VENUE_ROLLUP_THRESHOLD) {
      const venue = venueEvents[0].venue!;
      items.push({
        type: "venue-group",
        venueId,
        venueName: venue.name,
        neighborhood: venue.neighborhood,
        events: venueEvents.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")),
      });
      venueEvents.forEach((e) => usedEventIds.add(e.id));
    }
  }

  // Second pass: Find category clusters (only for specific categories)
  const categoryGroups = new Map<string, EventWithLocation[]>();
  for (const event of events) {
    if (usedEventIds.has(event.id)) continue;
    if (event.category_id && ROLLUP_CATEGORIES.includes(event.category_id)) {
      const existing = categoryGroups.get(event.category_id) || [];
      existing.push(event);
      categoryGroups.set(event.category_id, existing);
    }
  }

  // Create category groups
  for (const [categoryId, catEvents] of categoryGroups) {
    if (catEvents.length >= CATEGORY_ROLLUP_THRESHOLD) {
      const categoryNames: Record<string, string> = {
        community: "Volunteer & Community",
      };
      items.push({
        type: "category-group",
        categoryId,
        categoryName: categoryNames[categoryId] || categoryId,
        events: catEvents.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")),
      });
      catEvents.forEach((e) => usedEventIds.add(e.id));
    }
  }

  // Third pass: Add remaining events as individual items
  for (const event of events) {
    if (!usedEventIds.has(event.id)) {
      items.push({ type: "event", event });
    }
  }

  // Sort: groups first (by earliest event time), then individual events by time
  items.sort((a, b) => {
    const getFirstTime = (item: DisplayItem): string => {
      if (item.type === "event") return item.event.start_time || "99:99";
      return item.events[0]?.start_time || "99:99";
    };
    // Groups go to the end of their time slot
    const aIsGroup = a.type !== "event";
    const bIsGroup = b.type !== "event";
    if (aIsGroup && !bIsGroup) return 1;
    if (!aIsGroup && bIsGroup) return -1;
    return getFirstTime(a).localeCompare(getFirstTime(b));
  });

  return items;
}

export const revalidate = 60;

const PAGE_SIZE = 20;

type Props = {
  searchParams: Promise<{
    page?: string;
    search?: string;
    categories?: string;
    subcategories?: string;
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
    subcategories: params.subcategories?.split(",").filter(Boolean) || undefined,
    is_free: params.free === "true" || undefined,
    date_filter: (params.date as "today" | "weekend" | "week") || undefined,
    venue_id: params.venue ? parseInt(params.venue, 10) : undefined,
  };

  const [{ events, total }, venues] = await Promise.all([
    getFilteredEventsWithSearch(filters, currentPage, PAGE_SIZE),
    getVenuesWithEvents(),
  ]);
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
    return format(date, "EEEE, MMM d");
  }

  function buildPageUrl(page: number): string {
    const urlParams = new URLSearchParams();
    urlParams.set("page", page.toString());
    if (params.search) urlParams.set("search", params.search);
    if (params.categories) urlParams.set("categories", params.categories);
    if (params.subcategories) urlParams.set("subcategories", params.subcategories);
    if (params.free) urlParams.set("free", params.free);
    if (params.date) urlParams.set("date", params.date);
    if (params.venue) urlParams.set("venue", params.venue);
    if (params.view) urlParams.set("view", params.view);
    return `/?${urlParams.toString()}`;
  }

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

      {/* Hero */}
      <section className="py-8 sm:py-12 text-center border-b border-[var(--twilight)]">
        <p className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-[0.2em] mb-3">
          Discover Atlanta
        </p>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[var(--cream)]">
          Lost City
        </h1>
        <p className="font-serif text-lg sm:text-xl text-[var(--soft)] mt-2">
          Every show, every gathering, every hidden gem
        </p>

        {/* Stats */}
        <div className="flex justify-center gap-8 sm:gap-12 mt-6 sm:mt-8">
          <div className="text-center">
            <div className="font-mono text-xl sm:text-2xl font-semibold gradient-text-stats">{total.toLocaleString()}</div>
            <div className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-widest mt-1">Events</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-xl sm:text-2xl font-semibold gradient-text-stats">{venues.length}</div>
            <div className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-widest mt-1">Venues</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-xl sm:text-2xl font-semibold gradient-text-stats">20+</div>
            <div className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-widest mt-1">Sources</div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-6 sm:mt-8 max-w-xl mx-auto px-4">
          <Suspense fallback={<div className="h-11 bg-[var(--night)] rounded-lg animate-pulse" />}>
            <SearchBar />
          </Suspense>
        </div>
      </section>

      {/* Filters */}
      <section className="sticky top-0 z-30 bg-[var(--night)] border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Suspense fallback={<div className="h-10 flex-1 bg-[var(--twilight)] rounded animate-pulse" />}>
              <FilterBar venues={venues} />
            </Suspense>
            <Suspense fallback={<div className="w-full sm:w-28 h-9 bg-[var(--twilight)] rounded animate-pulse" />}>
              <ViewToggle currentView={currentView} />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Event count */}
      <div className="max-w-3xl mx-auto px-4 py-3 border-b border-[var(--twilight)]">
        <p className="font-mono text-xs text-[var(--muted)]">
          <span className="text-[var(--soft)]">{total}</span>{" "}
          {hasActiveFilters ? "matching events" : "upcoming events"}
        </p>
      </div>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 pb-12">
        {currentView === "map" ? (
          <div className="mt-4 rounded-lg overflow-hidden border border-[var(--twilight)] h-[60vh] sm:h-[70vh]">
            <MapViewWrapper events={mapEvents} />
          </div>
        ) : (
          <>
            {dates.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-[var(--muted)] text-lg">
                  {hasActiveFilters ? "No events match your filters." : "No upcoming events found."}
                </p>
                {hasActiveFilters && (
                  <Link href="/" className="mt-4 inline-block text-[var(--coral)] hover:text-[var(--rose)] transition-colors font-mono text-sm">
                    Clear all filters
                  </Link>
                )}
              </div>
            ) : (
              <div>
                {dates.map((date) => (
                  <section key={date}>
                    {/* Date header - classified style */}
                    <div className="flex items-center gap-4 py-4 sticky top-[60px] sm:top-[52px] bg-[var(--void)] z-20">
                      <span className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest whitespace-nowrap">
                        {getDateLabel(date)}
                      </span>
                      <div className="flex-1 h-px bg-[var(--twilight)]" />
                    </div>

                    {/* Events */}
                    <div>
                      {groupEventsForDisplay(eventsByDate[date]).map((item, idx) => {
                        if (item.type === "venue-group") {
                          return (
                            <EventGroup
                              key={`venue-${item.venueId}`}
                              type="venue"
                              title={item.venueName}
                              subtitle={item.neighborhood || undefined}
                              events={item.events}
                            />
                          );
                        }
                        if (item.type === "category-group") {
                          return (
                            <EventGroup
                              key={`cat-${item.categoryId}`}
                              type="category"
                              title={item.categoryName}
                              events={item.events}
                            />
                          );
                        }
                        return <EventCard key={item.event.id} event={item.event} index={idx} />;
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="mt-12 flex items-center justify-between border-t border-[var(--twilight)] pt-6 gap-2">
                <div className="flex-shrink-0">
                  {currentPage > 1 && (
                    <Link
                      href={buildPageUrl(currentPage - 1)}
                      className="filter-btn text-xs"
                    >
                      Previous
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
                  {generatePageNumbers(currentPage, totalPages).map((pageNum, idx) =>
                    pageNum === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-[var(--muted)] text-sm">...</span>
                    ) : (
                      <Link
                        key={pageNum}
                        href={buildPageUrl(pageNum as number)}
                        className={`filter-btn text-xs ${pageNum === currentPage ? "active" : ""}`}
                      >
                        {pageNum}
                      </Link>
                    )
                  )}
                </div>
                <div className="flex-shrink-0">
                  {currentPage < totalPages && (
                    <Link
                      href={buildPageUrl(currentPage + 1)}
                      className="filter-btn text-xs"
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

function generatePageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("...");
  if (total > 1) pages.push(total);

  return pages;
}
