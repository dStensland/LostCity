"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarProvider } from "@/lib/calendar/CalendarProvider";
import { PlansHeader } from "@/components/plans/PlansHeader";
import { PlansAgenda } from "@/components/plans/PlansAgenda";
import { MonthMinimap } from "@/components/plans/MonthMinimap";

interface PlansPageClientProps {
  portalSlug: string;
  isAuthenticated: boolean;
}

export function PlansPageClient({
  portalSlug,
  isAuthenticated,
}: PlansPageClientProps) {
  const [view, setView] = useState<"agenda" | "month">("agenda");

  const handleSelectDate = (date: Date) => {
    setView("agenda");
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const dateKey = `${y}-${m}-${d}`;
    setTimeout(() => {
      document.getElementById(`day-${dateKey}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <p className="text-base font-semibold text-[var(--cream)]">
          Sign in to see your plans
        </p>
        <Link
          href="/auth/signin"
          className="mt-4 text-sm text-[var(--coral)] hover:underline"
        >
          Sign in →
        </Link>
      </div>
    );
  }

  return (
    <CalendarProvider>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <PlansHeader
          portalSlug={portalSlug}
          view={view}
          onToggleView={() => setView(view === "agenda" ? "month" : "agenda")}
        />
        {view === "month" && <MonthMinimap onSelectDate={handleSelectDate} />}
        <PlansAgenda portalSlug={portalSlug} />
      </div>
    </CalendarProvider>
  );
}
