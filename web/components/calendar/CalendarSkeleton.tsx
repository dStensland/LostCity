"use client";

export function CalendarSkeleton() {
  const accentColors = [
    "border-l-[var(--coral)]",
    "border-l-[var(--gold)]",
    "border-l-[var(--neon-cyan)]",
  ] as const;

  const delays = ["0s", "0.1s", "0.2s"] as const;

  return (
    <div className="max-w-6xl mx-auto px-4 py-5 space-y-4">
      {/* Header skeleton — matches CalendarHeader rounded-2xl card */}
      <div className="rounded-2xl border border-[var(--twilight)]/85 bg-gradient-to-b from-[var(--night)]/94 to-[var(--void)]/86 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-2">
            <div
              className="h-8 w-48 rounded-lg bg-[var(--twilight)]/40 animate-pulse"
              style={{ animationDelay: "0s" }}
            />
            <div
              className="h-4 w-72 rounded bg-[var(--twilight)]/30 animate-pulse"
              style={{ animationDelay: "0.05s" }}
            />
          </div>
          {/* Summary pills */}
          <div className="flex gap-2">
            {([0, 1, 2, 3] as const).map((i) => (
              <div
                key={i}
                className="h-7 w-20 rounded-full bg-[var(--twilight)]/40 animate-pulse"
                style={{ animationDelay: `${i * 0.05}s` }}
              />
            ))}
          </div>
        </div>
        {/* Controls row */}
        <div className="pt-3.5 border-t border-[var(--twilight)]/65 flex items-center gap-2">
          <div
            className="h-9 w-28 rounded-full bg-[var(--twilight)]/40 animate-pulse"
            style={{ animationDelay: "0.1s" }}
          />
          <div
            className="h-9 w-56 rounded-full bg-[var(--twilight)]/30 animate-pulse"
            style={{ animationDelay: "0.15s" }}
          />
        </div>
      </div>

      {/* Event card skeletons */}
      <div className="space-y-3">
        {([0, 1, 2] as const).map((i) => (
          <div
            key={i}
            className={`rounded-xl border border-[var(--twilight)]/60 border-l-[3px] ${accentColors[i]} p-4`}
          >
            {/* Time line */}
            <div
              className="h-3 w-16 bg-[var(--twilight)]/40 rounded animate-pulse"
              style={{ animationDelay: delays[i] }}
            />
            {/* Title line */}
            <div
              className="h-4 w-3/4 bg-[var(--twilight)]/40 rounded mt-2 animate-pulse"
              style={{ animationDelay: delays[i] }}
            />
            {/* Venue line */}
            <div
              className="h-3 w-1/3 bg-[var(--twilight)]/40 rounded mt-2 animate-pulse"
              style={{ animationDelay: delays[i] }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
