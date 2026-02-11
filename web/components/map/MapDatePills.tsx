"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { addDays, format } from "date-fns";

function getDayLabel(date: Date): string {
  return format(date, "MMM d");
}

export default function MapDatePills() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeDateParam = searchParams.get("date") || "";

  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i);
      return {
        label: getDayLabel(d),
        value: format(d, "yyyy-MM-dd"),
      };
    });
  }, []);

  const handleDateClick = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (activeDateParam === value) {
      params.delete("date");
    } else {
      params.set("date", value);
    }
    params.delete("page");
    const url = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.push(url, { scroll: false });
  };

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 py-0.5">
      {days.map((day) => {
        const isActive = activeDateParam === day.value;
        return (
          <button
            key={day.value}
            onClick={() => handleDateClick(day.value)}
            className={`flex-shrink-0 h-9 min-w-[64px] flex items-center justify-center gap-1.5 px-3 rounded-full font-mono text-[11px] whitespace-nowrap transition-all duration-200 border ${
              isActive
                ? "bg-gradient-to-br from-[var(--gold)] to-[var(--coral)] text-[var(--void)] font-semibold border-[var(--gold)]/45 shadow-[0_7px_18px_rgba(0,0,0,0.3)]"
                : "bg-[var(--twilight)]/45 text-[var(--soft)] border-[var(--twilight)]/80 hover:bg-[var(--twilight)]/70 hover:text-[var(--cream)] hover:border-[var(--soft)]/45"
            }`}
          >
            {day.label}
            {isActive && (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}
