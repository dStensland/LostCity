"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { addDays, format, isToday, isTomorrow } from "date-fns";

function getDayLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tmrw";
  return format(date, "EEE d");
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
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 py-0.5">
      {days.map((day) => {
        const isActive = activeDateParam === day.value;
        return (
          <button
            key={day.value}
            onClick={() => handleDateClick(day.value)}
            className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-[11px] whitespace-nowrap transition-all ${
              isActive
                ? "bg-[var(--gold)] text-[var(--void)] font-semibold"
                : "bg-[var(--twilight)]/60 text-[var(--soft)] hover:bg-[var(--twilight)] hover:text-[var(--cream)]"
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
