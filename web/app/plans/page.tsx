"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import { CalendarPlus, Plus, CaretRight } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";
import { usePlans } from "@/lib/hooks/usePlans";
import type { Plan } from "@/lib/hooks/usePlans";
import { PlatformHeader } from "@/components/headers";
import { PlanCreator } from "@/components/plans/PlanCreator";
import { useSearchParams } from "next/navigation";

const portalSlug = "atlanta";

function formatPlanDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";

  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function PlanCard({ plan }: { plan: Plan }) {
  const goingCount = plan.participants?.filter(
    (p) => p.status === "accepted"
  ).length ?? 0;
  const itemCount = plan.items?.length ?? 0;

  return (
    <Link
      href={`/plans/${plan.id}`}
      className="block p-4 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/40 hover:border-[var(--twilight)] transition-colors group"
    >
      <div className="flex items-start gap-3">
        {/* Creator avatar */}
        <div className="flex-shrink-0 w-9 h-9 rounded-lg overflow-hidden bg-[var(--twilight)]">
          {plan.creator.avatar_url ? (
            <SmartImage
              src={plan.creator.avatar_url}
              alt=""
              width={36}
              height={36}
              sizes="36px"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-xs font-bold text-[var(--muted)]">
              {(plan.creator.display_name || plan.creator.username || "?")[0].toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-[var(--cream)] truncate group-hover:text-[var(--coral)] transition-colors">
            {plan.title}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="inline-block px-2 py-0.5 rounded-md bg-[var(--gold)]/10 border border-[var(--gold)]/20 text-2xs font-mono font-bold text-[var(--gold)]">
              {formatPlanDate(plan.plan_date)}
            </span>
            {itemCount > 0 && (
              <span className="text-xs text-[var(--muted)]">
                {itemCount} {itemCount === 1 ? "stop" : "stops"}
              </span>
            )}
            {goingCount > 0 && (
              <>
                <span className="text-[var(--twilight)]">&middot;</span>
                <span className="text-xs text-[var(--coral)]">
                  {goingCount} going
                </span>
              </>
            )}
          </div>
          {plan.description && (
            <p className="text-sm text-[var(--soft)] mt-1 line-clamp-1">{plan.description}</p>
          )}
        </div>

        <CaretRight weight="bold" className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--cream)] transition-colors flex-shrink-0 mt-1" />
      </div>
    </Link>
  );
}

export default function PlansPage() {
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading } = usePlans();
  const searchParams = useSearchParams();
  const [showCreator, setShowCreator] = useState(false);

  // Auto-open creator if ?action=create
  useEffect(() => {
    if (searchParams.get("action") === "create" && user) {
      setShowCreator(true);
    }
  }, [searchParams, user]);

  const plans = data?.plans || [];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--void)]">
        <PlatformHeader />
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-32 bg-[var(--dusk)] rounded" />
            <div className="h-20 bg-[var(--dusk)] rounded-xl" />
            <div className="h-20 bg-[var(--dusk)] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--void)]">
        <PlatformHeader />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--coral)]/15 flex items-center justify-center">
            <CalendarPlus weight="duotone" className="w-7 h-7 text-[var(--coral)]" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--cream)] mb-2">Plan your next outing</h2>
          <p className="text-sm text-[var(--soft)] max-w-xs mx-auto mb-5">
            Build plans with friends from real events and venues across the city.
          </p>
          <Link
            href={`/auth/login?redirect=${encodeURIComponent("/plans")}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-all"
          >
            Sign In to Get Started
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--void)]">
      <PlatformHeader />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-28 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[var(--cream)]">Plans</h1>
          <button
            onClick={() => setShowCreator(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
          >
            <Plus weight="bold" className="w-4 h-4" />
            New Plan
          </button>
        </div>

        {/* Plans list */}
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-[var(--dusk)] rounded-xl" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)]">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--coral)]/10 flex items-center justify-center">
              <CalendarPlus weight="duotone" className="w-7 h-7 text-[var(--coral)]" />
            </div>
            <h2 className="text-base font-semibold text-[var(--cream)] mb-1">No plans yet</h2>
            <p className="text-sm text-[var(--soft)] max-w-xs mx-auto mb-4">
              Create a plan, add stops, and invite friends
            </p>
            <button
              onClick={() => setShowCreator(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--coral)]/10 border border-[var(--coral)]/25 text-[var(--coral)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--coral)]/15 transition-colors"
            >
              <Plus weight="bold" className="w-4 h-4" />
              Create your first plan
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        )}
      </main>

      {/* Creator modal */}
      {showCreator && (
        <PlanCreator
          portalSlug={portalSlug}
          onClose={() => setShowCreator(false)}
          onCreated={(id) => {
            setShowCreator(false);
            window.location.href = `/plans/${id}`;
          }}
        />
      )}
    </div>
  );
}
