"use client";

import type { CountdownLabel } from "@/lib/moments-utils";
import { getUrgencyColor } from "@/lib/moments-utils";

interface CountdownBadgeProps {
  countdown: CountdownLabel;
  size?: "sm" | "md" | "lg";
}

/** Clock icon for days-away / next-week */
function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Calendar icon for weeks-away */
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 6.5h12" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const SIZE_STYLES = {
  sm: { badge: "px-2 py-0.5 text-[0.6rem] gap-1", icon: "w-3 h-3", dot: "w-1.5 h-1.5" },
  md: { badge: "px-2.5 py-1 text-[0.7rem] gap-1.5", icon: "w-3.5 h-3.5", dot: "w-2 h-2" },
  lg: { badge: "px-3 py-1.5 text-xs gap-2", icon: "w-4 h-4", dot: "w-2.5 h-2.5" },
} as const;

export default function CountdownBadge({ countdown, size = "sm" }: CountdownBadgeProps) {
  const color = getUrgencyColor(countdown.urgency);
  const s = SIZE_STYLES[size];

  const hasPulse =
    countdown.urgency === "happening-now" ||
    countdown.urgency === "starts-tomorrow";

  const icon = (() => {
    if (hasPulse) {
      return (
        <span className="relative flex items-center justify-center" style={{ width: 12, height: 12 }}>
          {countdown.urgency === "happening-now" && (
            <span
              className="absolute inset-0 rounded-full animate-ping opacity-40"
              style={{ backgroundColor: color }}
            />
          )}
          <span
            className={`relative rounded-full ${s.dot}`}
            style={{
              backgroundColor: color,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
        </span>
      );
    }
    if (countdown.urgency === "days-away" || countdown.urgency === "next-week") {
      return <ClockIcon className={s.icon} />;
    }
    if (countdown.urgency === "weeks-away") {
      return <CalendarIcon className={s.icon} />;
    }
    return null;
  })();

  return (
    <span
      className={`inline-flex items-center rounded-full font-mono font-medium uppercase tracking-wider backdrop-blur-sm ${s.badge}`}
      style={{
        color: color,
        backgroundColor: `color-mix(in srgb, ${color} 25%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
        borderWidth: 1,
        borderStyle: "solid",
        boxShadow: `0 0 12px color-mix(in srgb, ${color} 20%, transparent)`,
      }}
    >
      {icon}
      {countdown.text}
    </span>
  );
}
