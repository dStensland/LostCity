"use client";

import { useState } from "react";
import { usePlans } from "@/lib/hooks/usePlans";
import { PlanCard } from "./PlanCard";
import { PlanCreator } from "./PlanCreator";
import { PlanDetailView } from "./PlanDetailView";

export function PlansSection() {
  const { data, isLoading } = usePlans();
  const [showCreator, setShowCreator] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  if (selectedPlanId) {
    return (
      <PlanDetailView
        planId={selectedPlanId}
        onBack={() => setSelectedPlanId(null)}
      />
    );
  }

  const plans = data?.plans || [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-[var(--neon-magenta)]" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--neon-magenta)]">
            Plans
          </h3>
          {plans.length > 0 && (
            <span className="font-mono text-[0.65rem] px-1.5 py-0.5 rounded-full bg-[var(--neon-magenta)]/15 text-[var(--neon-magenta)]">
              {plans.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCreator(true)}
          className="font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] transition-colors flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          New plan
        </button>
      </div>

      {/* Plans list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="p-4 glass border border-[var(--twilight)] rounded-xl">
              <div className="h-4 w-32 skeleton-shimmer rounded" />
              <div className="h-3 w-24 skeleton-shimmer rounded mt-2" />
            </div>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-6 glass border border-[var(--twilight)] rounded-xl">
          <p className="font-mono text-sm text-[var(--muted)] mb-2">No plans yet</p>
          <button
            onClick={() => setShowCreator(true)}
            className="font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] transition-colors"
          >
            Create your first plan
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onClick={() => setSelectedPlanId(plan.id)}
            />
          ))}
        </div>
      )}

      {showCreator && (
        <PlanCreator
          onClose={() => setShowCreator(false)}
          onCreated={(id) => {
            setShowCreator(false);
            setSelectedPlanId(id);
          }}
        />
      )}
    </div>
  );
}
