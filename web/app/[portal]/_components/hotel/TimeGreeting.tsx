"use client";

import { useSyncExternalStore } from "react";
import { format } from "date-fns";

/**
 * Time-aware greeting for hotel portal
 * Shows "Good Morning" / "Good Afternoon" / "Good Evening" based on current time
 */
interface TimeGreetingProps {
  subtitle?: string;
}

export default function TimeGreeting({ subtitle }: TimeGreetingProps = {}) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!mounted) {
    // Server-side fallback
    return (
      <div className="mb-16">
        <h1 className="font-display font-semibold text-4xl md:text-5xl text-[var(--hotel-charcoal)] tracking-tight leading-tight mb-3">
          Welcome
        </h1>
        <p className="font-body text-lg text-[var(--hotel-stone)]">
          {format(new Date(), "EEEE, MMMM d")}
        </p>
        {subtitle && (
          <p className="font-body text-base text-[var(--hotel-stone)] mt-2 italic">
            {subtitle}
          </p>
        )}
      </div>
    );
  }

  // Determine greeting based on time of day
  const hour = new Date().getHours();
  let greeting = "Good Evening";
  if (hour < 12) {
    greeting = "Good Morning";
  } else if (hour < 17) {
    greeting = "Good Afternoon";
  }

  return (
    <div className="mb-16 hotel-enter">
      <h1 className="font-display font-semibold text-4xl md:text-5xl text-[var(--hotel-charcoal)] tracking-tight leading-tight mb-3">
        {greeting}
      </h1>
      <p className="font-body text-lg text-[var(--hotel-stone)]">
        {format(new Date(), "EEEE, MMMM d")}
      </p>
      {subtitle && (
        <p className="font-body text-base text-[var(--hotel-stone)] mt-2 italic">
          {subtitle}
        </p>
      )}
    </div>
  );
}
