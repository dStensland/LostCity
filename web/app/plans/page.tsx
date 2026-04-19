"use client";

import { useMyPlans } from "@/lib/hooks/useUserPlans";
import Link from "next/link";

export default function PlansPage() {
  const { data, isLoading, error } = useMyPlans({ scope: "mine", status: "upcoming" });

  if (isLoading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-semibold text-[var(--cream)]">My Plans</h1>
        <p className="text-sm text-[var(--muted)] mt-4">Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-semibold text-[var(--cream)]">My Plans</h1>
        <p className="text-sm text-[var(--coral)] mt-4">Something went wrong. Try refreshing.</p>
      </main>
    );
  }

  const plans = data?.plans ?? [];

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold text-[var(--cream)]">My Plans</h1>
      {plans.length === 0 ? (
        <p className="text-sm text-[var(--soft)] mt-4">
          No upcoming plans yet. RSVP to an event or start a plan from a place you love.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {plans.map((plan) => (
            <li key={plan.id}>
              <Link
                href={`/plans/${plan.id}`}
                className="block rounded-xl border border-[var(--twilight)] bg-[var(--night)] px-4 py-3 hover:border-[var(--twilight)]/80 transition-colors"
              >
                <p className="text-base font-semibold text-[var(--cream)]">
                  {plan.title ?? "Untitled plan"}
                </p>
                <p className="text-xs text-[var(--muted)] mt-1 font-mono">
                  {new Date(plan.starts_at).toLocaleString()} · {plan.status}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
