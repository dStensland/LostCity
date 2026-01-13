import { notFound } from "next/navigation";
import Link from "next/link";
import { format, parseISO, isToday, isTomorrow, isThisWeek } from "date-fns";
import { getPortalBySlug, getPortalCustomEvents } from "@/lib/portals";
import { getFilteredEvents } from "@/lib/filters";
import EventCard from "@/components/EventCard";
import type { Event } from "@/lib/supabase";

export const revalidate = 60;

const PAGE_SIZE = 20;

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function PortalPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { page } = await searchParams;

  const portal = await getPortalBySlug(slug);

  if (!portal) {
    notFound();
  }

  const currentPage = Math.max(1, parseInt(page || "1", 10));

  // Fetch events based on portal filters
  const { events, total } = await getFilteredEvents(
    portal.filters,
    currentPage,
    PAGE_SIZE
  );

  // Fetch custom events for this portal
  const customEventsRaw = await getPortalCustomEvents(portal.id);

  // Transform custom events to match event shape
  const customEvents: Event[] = customEventsRaw.map((ce) => ({
    id: parseInt(ce.id.slice(0, 8), 16), // Convert UUID to number for compatibility
    title: ce.content?.title || "Untitled Event",
    description: ce.content?.description || null,
    start_date: ce.content?.start_date || "",
    start_time: ce.content?.start_time || null,
    end_date: ce.content?.end_date || null,
    end_time: ce.content?.end_time || null,
    is_all_day: !ce.content?.start_time,
    category: ce.content?.category || null,
    subcategory: null,
    category_id: ce.content?.category || null,
    subcategory_id: null,
    tags: null,
    price_min: null,
    price_max: null,
    price_note: null,
    is_free: false,
    source_url: "",
    ticket_url: ce.content?.ticket_url || null,
    image_url: ce.content?.image_url || null,
    venue: ce.content?.venue_name
      ? {
          id: 0,
          name: ce.content.venue_name,
          slug: "",
          address: ce.content.venue_address || null,
          neighborhood: null,
          city: "Atlanta",
          state: "GA",
        }
      : null,
  }));

  // Merge custom events with regular events (custom first if pinned)
  const pinnedCustom = customEventsRaw.filter((ce) => ce.is_pinned);
  const unpinnedCustom = customEventsRaw.filter((ce) => !ce.is_pinned);

  // Only show custom events on first page
  const allEvents =
    currentPage === 1
      ? [...customEvents, ...events]
      : events;

  // Group events by date
  const eventsByDate = allEvents.reduce(
    (acc, event) => {
      const date = event.start_date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(event);
      return acc;
    },
    {} as Record<string, Event[]>
  );

  const dates = Object.keys(eventsByDate).sort();
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function getDateLabel(dateStr: string): string {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    if (isThisWeek(date)) return format(date, "EEEE");
    return format(date, "EEEE, MMMM d");
  }

  return (
    <>
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {portal.branding.logo_url ? (
            <img
              src={portal.branding.logo_url}
              alt={portal.name}
              className="h-10"
            />
          ) : (
            <>
              <h1
                className="text-3xl font-bold"
                style={{ color: "var(--portal-secondary)" }}
              >
                {portal.name}
              </h1>
              {portal.tagline && (
                <p className="mt-1 text-gray-500">{portal.tagline}</p>
              )}
            </>
          )}
        </div>
      </header>

      {/* Stats bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{total}</span>{" "}
            upcoming events
          </p>
        </div>
      </div>

      {/* Events list */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {dates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No upcoming events found.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {dates.map((date) => (
              <section key={date}>
                <h2
                  className="text-lg font-semibold text-gray-900 mb-4 sticky top-0 py-2"
                  style={{ backgroundColor: "var(--portal-bg)" }}
                >
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
                  href={`?page=${currentPage - 1}`}
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
                    href={`?page=${pageNum}`}
                    className={`px-3 py-2 text-sm font-medium rounded-md ${
                      pageNum === currentPage
                        ? "text-white"
                        : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
                    }`}
                    style={
                      pageNum === currentPage
                        ? { backgroundColor: "var(--portal-primary)" }
                        : undefined
                    }
                  >
                    {pageNum}
                  </Link>
                )
              )}
            </div>
            <div className="flex-1 flex justify-end">
              {currentPage < totalPages && (
                <Link
                  href={`?page=${currentPage + 1}`}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Next
                </Link>
              )}
            </div>
          </nav>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
          <p>
            Powered by{" "}
            <a
              href="https://lostcity.ai"
              className="hover:underline"
              style={{ color: "var(--portal-primary)" }}
            >
              Lost City
            </a>
          </p>
        </div>
      </footer>
    </>
  );
}

function generatePageNumbers(
  current: number,
  total: number
): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];

  pages.push(1);

  if (current > 3) {
    pages.push("...");
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push("...");
  }

  if (total > 1) {
    pages.push(total);
  }

  return pages;
}
