import Link from "next/link";
import { format, parseISO } from "date-fns";
import type { Event } from "@/lib/supabase";

function formatTime(time: string | null): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function formatPrice(event: Event): string {
  if (event.is_free) return "Free";
  if (event.price_min === null) return "TBD";
  if (event.price_min === event.price_max || event.price_max === null) {
    return `$${event.price_min}`;
  }
  return `$${event.price_min} - $${event.price_max}`;
}

export default function EventCard({ event }: { event: Event }) {
  const dateObj = parseISO(event.start_date);
  const dayOfWeek = format(dateObj, "EEE");
  const month = format(dateObj, "MMM");
  const day = format(dateObj, "d");

  return (
    <Link
      href={`/events/${event.id}`}
      className="group block bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
    >
      <div className="flex">
        {/* Date column */}
        <div className="flex-shrink-0 w-20 bg-gray-50 p-4 text-center border-r border-gray-200">
          <div className="text-xs font-medium text-gray-500 uppercase">
            {dayOfWeek}
          </div>
          <div className="text-2xl font-bold text-gray-900">{day}</div>
          <div className="text-xs font-medium text-gray-500 uppercase">
            {month}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 truncate">
                {event.title}
              </h3>
              {event.venue && (
                <p className="text-sm text-gray-600 mt-1">
                  {event.venue.name}
                  {event.venue.neighborhood && (
                    <span className="text-gray-400">
                      {" "}
                      &middot; {event.venue.neighborhood}
                    </span>
                  )}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                {event.start_time && <span>{formatTime(event.start_time)}</span>}
                <span className="font-medium text-gray-700">
                  {formatPrice(event)}
                </span>
              </div>
            </div>

            {/* Category badge */}
            {event.category && (
              <span className="flex-shrink-0 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {event.category}
              </span>
            )}
          </div>

          {/* Description preview */}
          {event.description && (
            <p className="mt-2 text-sm text-gray-500 line-clamp-2">
              {event.description}
            </p>
          )}
        </div>

        {/* Image */}
        {event.image_url && (
          <div className="hidden sm:block flex-shrink-0 w-32 h-32">
            <img
              src={event.image_url}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>
    </Link>
  );
}
