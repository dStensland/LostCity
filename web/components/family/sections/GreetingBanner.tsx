"use client";

import { FAMILY_TOKENS } from "@/lib/family-design-tokens";

const AMBER = FAMILY_TOKENS.amber;
const TEXT = FAMILY_TOKENS.text;
const MUTED = FAMILY_TOKENS.textSecondary;

// ---- WeatherPill -----------------------------------------------------------

export function WeatherPill({
  temp,
  condition,
  emoji,
}: {
  temp: number;
  condition: string;
  emoji: string;
}) {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
      style={{
        backgroundColor: `${AMBER}18`,
        border: `1px solid ${AMBER}30`,
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1 }}>{emoji}</span>
      <span
        style={{
          fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
          fontSize: 12,
          fontWeight: 600,
          color: AMBER,
        }}
      >
        {temp}°F · {condition}
      </span>
    </div>
  );
}

// ---- GreetingHeadline ------------------------------------------------------

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning!";
  if (hour < 17) return "Good afternoon!";
  return "Good evening!";
}

export function GreetingHeadline({
  todayEventCount,
}: {
  todayEventCount: number | null;
}) {
  const greeting = getGreeting();
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const subtitle =
    todayEventCount === null
      ? "Loading…"
      : todayEventCount > 0
      ? `${todayEventCount} thing${todayEventCount !== 1 ? "s" : ""} happening today`
      : "Explore what's on this week";

  return (
    <div>
      <h1
        style={{
          fontFamily: "var(--font-plus-jakarta-sans, system-ui, sans-serif)",
          fontSize: 32,
          fontWeight: 800,
          color: TEXT,
          lineHeight: 1.1,
          margin: 0,
        }}
      >
        {greeting}
      </h1>
      <p
        style={{
          fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
          fontSize: 13,
          color: MUTED,
          marginTop: 6,
        }}
      >
        {dateStr} · {subtitle}
      </p>
    </div>
  );
}
