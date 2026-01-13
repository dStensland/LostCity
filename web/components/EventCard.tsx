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

const CATEGORY_COLORS: Record<string, string> = {
  music: "from-pink-500 to-rose-500",
  comedy: "from-yellow-400 to-orange-400",
  film: "from-purple-500 to-violet-500",
  theater: "from-pink-400 to-fuchsia-500",
  art: "from-emerald-400 to-teal-500",
  sports: "from-orange-400 to-red-500",
  food_drink: "from-amber-400 to-orange-500",
  nightlife: "from-indigo-500 to-purple-500",
  community: "from-sky-400 to-blue-500",
  fitness: "from-lime-400 to-green-500",
  family: "from-violet-400 to-purple-400",
  other: "from-gray-400 to-slate-500",
};

export default function EventCard({ event }: { event: Event }) {
  const dateObj = parseISO(event.start_date);
  const dayOfWeek = format(dateObj, "EEE");
  const month = format(dateObj, "MMM");
  const day = format(dateObj, "d");

  const categoryGradient = CATEGORY_COLORS[event.category || "other"] || CATEGORY_COLORS.other;

  return (
    <Link
      href={`/events/${event.id}`}
      className="group block glass-card rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:shadow-orange-500/10"
    >
      <div className="flex">
        {/* Date column with gradient accent */}
        <div className="flex-shrink-0 w-20 relative">
          <div className={`absolute inset-0 bg-gradient-to-br ${categoryGradient} opacity-20`} />
          <div className="relative p-4 text-center">
            <div className="text-xs font-medium text-orange-200/70 uppercase tracking-wider">
              {dayOfWeek}
            </div>
            <div className="text-3xl font-bold text-white mt-0.5">{day}</div>
            <div className="text-xs font-medium text-orange-200/70 uppercase tracking-wider">
              {month}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-white/10" />

        {/* Content */}
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-white group-hover:text-orange-300 truncate transition-colors">
                {event.title}
              </h3>
              {event.venue && (
                <p className="text-sm text-orange-100/60 mt-1">
                  {event.venue.name}
                  {event.venue.neighborhood && (
                    <span className="text-orange-100/40">
                      {" "}
                      &middot; {event.venue.neighborhood}
                    </span>
                  )}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2 text-sm">
                {event.start_time && (
                  <span className="text-orange-100/50">{formatTime(event.start_time)}</span>
                )}
                <span className={`font-medium ${event.is_free ? "text-emerald-400" : "text-orange-300"}`}>
                  {formatPrice(event)}
                </span>
              </div>
            </div>

            {/* Category badge */}
            {event.category && (
              <span className={`flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${categoryGradient} text-white shadow-lg`}>
                {event.category}
              </span>
            )}
          </div>

          {/* Description preview */}
          {event.description && (
            <p className="mt-2 text-sm text-orange-100/40 line-clamp-2">
              {event.description}
            </p>
          )}
        </div>

        {/* Image */}
        {event.image_url && (
          <div className="hidden sm:block flex-shrink-0 w-32 h-32 relative">
            <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/20" />
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
