import { getEventById } from "@/lib/supabase";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 60;

function formatTime(time: string | null): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function formatPrice(event: {
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  price_note: string | null;
}): string {
  if (event.is_free) return "Free";
  if (event.price_min === null) return "Price TBD";
  if (event.price_min === event.price_max || event.price_max === null) {
    return `$${event.price_min}`;
  }
  return `$${event.price_min} - $${event.price_max}`;
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEventById(parseInt(id, 10));

  if (!event) {
    notFound();
  }

  const dateObj = parseISO(event.start_date);
  const formattedDate = format(dateObj, "EEEE, MMMM d, yyyy");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            &larr; Back to events
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Event image */}
          {event.image_url && (
            <div className="aspect-video bg-gray-100">
              <img
                src={event.image_url}
                alt={event.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-6 sm:p-8">
            {/* Category badge */}
            {event.category && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 mb-4">
                {event.category}
              </span>
            )}

            {/* Title */}
            <h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>

            {/* Venue */}
            {event.venue && (
              <p className="mt-2 text-lg text-gray-600">
                {event.venue.name}
                {event.venue.neighborhood && (
                  <span className="text-gray-400">
                    {" "}
                    &middot; {event.venue.neighborhood}
                  </span>
                )}
              </p>
            )}

            {/* Date/Time/Price */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-500">Date</div>
                <div className="mt-1 text-lg font-semibold text-gray-900">
                  {formattedDate}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-500">Time</div>
                <div className="mt-1 text-lg font-semibold text-gray-900">
                  {event.start_time ? formatTime(event.start_time) : "TBD"}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-500">Price</div>
                <div className="mt-1 text-lg font-semibold text-gray-900">
                  {formatPrice(event)}
                </div>
              </div>
            </div>

            {/* Description */}
            {event.description && (
              <div className="mt-6">
                <h2 className="text-lg font-semibold text-gray-900">About</h2>
                <p className="mt-2 text-gray-600 whitespace-pre-wrap">
                  {event.description}
                </p>
              </div>
            )}

            {/* Tags */}
            {event.tags && event.tags.length > 0 && (
              <div className="mt-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Also featuring
                </h2>
                <div className="flex flex-wrap gap-2">
                  {event.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Venue details */}
            {event.venue && event.venue.address && (
              <div className="mt-6">
                <h2 className="text-lg font-semibold text-gray-900">Location</h2>
                <p className="mt-2 text-gray-600">
                  {event.venue.name}
                  <br />
                  {event.venue.address}
                  <br />
                  {event.venue.city}, {event.venue.state}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              {event.ticket_url && (
                <a
                  href={event.ticket_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Get Tickets
                </a>
              )}
              {event.source_url && (
                <a
                  href={event.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  View Original
                </a>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
