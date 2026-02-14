"use client";

import { useEffect, useState } from "react";
import type { MarketplacePersona } from "@/lib/marketplace-art";

interface MarketplaceTimeGreetingProps {
  persona: MarketplacePersona;
}

type DayPart = "morning" | "afternoon" | "evening" | "night";

function getDayPart(): DayPart {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

const GREETINGS: Record<DayPart, Record<MarketplacePersona, string>> = {
  morning: {
    visitor: "Good morning at Ponce City Market",
    resident: "Good morning, neighbor",
    employee: "Good morning — start your day right",
  },
  afternoon: {
    visitor: "Explore Ponce City Market",
    resident: "Good afternoon, neighbor",
    employee: "Afternoon at the Market",
  },
  evening: {
    visitor: "Tonight at Ponce City Market",
    resident: "Good evening, neighbor",
    employee: "Wind down at the Market",
  },
  night: {
    visitor: "Late night at Ponce City Market",
    resident: "Night at the Market",
    employee: "Night at the Market",
  },
};

export default function MarketplaceTimeGreeting({
  persona,
}: MarketplaceTimeGreetingProps) {
  const [dayPart, setDayPart] = useState<DayPart>("afternoon");

  useEffect(() => {
    setDayPart(getDayPart());
  }, []);

  const greeting = GREETINGS[dayPart][persona];

  return (
    <p className="font-display text-3xl sm:text-4xl md:text-5xl font-semibold text-white tracking-tight leading-tight">
      {greeting}
    </p>
  );
}
