"use client";

import { useCalendar } from "@/lib/calendar/CalendarProvider";
import { formatTimeSplit } from "@/lib/formats";
import type { CalendarEvent } from "@/lib/types/calendar";

interface ConflictSheetData {
  newEvent: CalendarEvent;
  conflicts: CalendarEvent[];
}

interface ConflictSheetProps {
  data: ConflictSheetData;
}

function EventTimeRow({ event }: { event: CalendarEvent }) {
  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
  const { time: endTime, period: endPeriod } = event.end_time
    ? formatTimeSplit(event.end_time, false)
    : { time: null, period: null };

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/40">
      <div className="flex-1 min-w-0">
        <p className="font-mono text-sm font-medium text-[var(--cream)] truncate">
          {event.title}
        </p>
        <p className="font-mono text-xs text-[var(--muted)] mt-0.5">
          {event.is_all_day ? (
            "All day"
          ) : (
            <>
              {time}
              {period && <span> {period}</span>}
              {endTime && (
                <>
                  {" – "}
                  {endTime}
                  {endPeriod && <span> {endPeriod}</span>}
                </>
              )}
            </>
          )}
          {event.venue && (
            <span className="text-[var(--muted)]">
              {" · "}
              {event.venue.name}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

export function ConflictSheet({ data }: ConflictSheetProps) {
  const { closeSheet, openSheet } = useCalendar();
  const { newEvent, conflicts } = data;

  const handleKeepBoth = () => {
    closeSheet();
  };

  const handleChangeRsvp = () => {
    openSheet({ sheet: "change-rsvp", data: newEvent });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Warning header */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--gold)]/10 border border-[var(--gold)]/30">
          <svg
            className="w-5 h-5 text-[var(--gold)] flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <p className="font-mono text-sm font-medium text-[var(--gold)]">
              Time Conflict
            </p>
            <p className="font-mono text-xs text-[var(--soft)] mt-0.5">
              This event overlaps with{" "}
              {conflicts.length === 1
                ? "another event"
                : `${conflicts.length} other events`}{" "}
              on your calendar.
            </p>
          </div>
        </div>

        {/* New event */}
        <div>
          <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
            New Event
          </p>
          <EventTimeRow event={newEvent} />
        </div>

        {/* Conflicting events */}
        <div>
          <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
            {conflicts.length === 1 ? "Conflicts With" : "Conflicts With"}
          </p>
          <div className="space-y-2">
            {conflicts.map((conflict) => (
              <EventTimeRow key={conflict.id} event={conflict} />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-[var(--twilight)] bg-[var(--void)] px-4 py-3 flex gap-3">
        <button
          onClick={handleChangeRsvp}
          className="flex-1 min-h-[44px] bg-[var(--twilight)] text-[var(--cream)] font-mono text-sm rounded-lg hover:bg-[var(--dusk)] transition-colors"
        >
          Change RSVP
        </button>
        <button
          onClick={handleKeepBoth}
          className="flex-1 min-h-[44px] bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          Keep Both
        </button>
      </div>
    </div>
  );
}
