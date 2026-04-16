"use client";

import { CalendarProvider } from "@/lib/calendar/CalendarProvider";
import { PlansHeader } from "@/components/plans/PlansHeader";
import { PlansAgenda } from "@/components/plans/PlansAgenda";

interface PlansPageClientProps {
  portalSlug: string;
  isAuthenticated: boolean;
}

export function PlansPageClient({
  portalSlug,
  isAuthenticated,
}: PlansPageClientProps) {
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <p className="text-base font-semibold text-[var(--cream)]">
          Sign in to see your plans
        </p>
        <a
          href="/auth/signin"
          className="mt-4 text-sm text-[var(--coral)] hover:underline"
        >
          Sign in →
        </a>
      </div>
    );
  }

  return (
    <CalendarProvider>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <PlansHeader portalSlug={portalSlug} />
        <PlansAgenda portalSlug={portalSlug} />
      </div>
    </CalendarProvider>
  );
}
