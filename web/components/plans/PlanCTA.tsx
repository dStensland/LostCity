"use client";

import { memo, useState } from "react";
import { MapPin } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { triggerHaptic } from "@/lib/haptics";
import { usePortalSlug } from "@/lib/portal-context";
import { useMyPlans } from "@/lib/hooks/useUserPlans";
import { PlanSheet } from "./PlanSheet";

// Renamed from HangButton → PlanCTA
// Context-aware: "Going" on event, "Plan visit" on place
// HangShareFlow removed — share flow is handled separately in Phase 4
// useMyHangs → useMyPlans

interface PlanCTAProps {
  place: {
    id: number;
    name: string;
    slug: string | null;
    image_url: string | null;
    neighborhood: string | null;
  };
  event?: {
    id: number;
    title: string;
  } | null;
  /** Compact mode for icon-only use in cards */
  compact?: boolean;
  /** Border radius variant */
  rounded?: "lg" | "xl";
  className?: string;
  /** Override: explicitly set plan state (auto-detected from useMyPlans if omitted) */
  isPlanning?: boolean;
  onPlanCreated?: () => void;
}

export const PlanCTA = memo(function PlanCTA({
  place,
  event,
  compact = false,
  rounded = "lg",
  className,
  isPlanning: isPlanningProp,
  onPlanCreated,
}: PlanCTAProps) {
  // Auto-detect if user has an active plan at this place
  const { data: myPlans } = useMyPlans({ scope: "mine", status: "active" });
  const hasActivePlanHere = myPlans?.plans?.some(
    (p) => p.anchor_place_id === place.id
  ) ?? false;
  const isPlanning = isPlanningProp ?? hasActivePlanHere;

  const [sheetOpen, setSheetOpen] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();
  const portalSlug = usePortalSlug();

  const handleClick = () => {
    if (loading) return;

    if (!user) {
      triggerHaptic("light");
      router.push(
        `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`
      );
      return;
    }

    triggerHaptic("light");
    setSheetOpen(true);
  };

  const handlePlanCreated = () => {
    setSheetOpen(false);
    onPlanCreated?.();
  };

  // Label: event context = "Going", place context = "Plan visit"
  const idleLabel = event ? "Going" : "Plan visit";
  const activeLabel = event ? "Going" : "Planning";

  void portalSlug; // available for future use

  if (compact) {
    return (
      <>
        <button
          onClick={handleClick}
          aria-label={isPlanning ? `Planning at ${place.name}` : `Plan visit to ${place.name}`}
          className={[
            "w-8 h-8 rounded-full flex items-center justify-center transition-all",
            isPlanning
              ? "bg-[var(--neon-green)]/20 border border-[var(--neon-green)]/50"
              : "bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/30 hover:bg-[var(--neon-green)]/20",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <MapPin
            size={14}
            weight={isPlanning ? "fill" : "regular"}
            className="text-[var(--neon-green)]"
          />
        </button>

        <PlanSheet
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          place={place}
          event={event}
          onPlanCreated={handlePlanCreated}
        />
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        aria-label={isPlanning ? activeLabel : idleLabel}
        className={[
          `flex items-center justify-center gap-2 ${rounded === "xl" ? "rounded-xl" : "rounded-lg"} px-3 py-2 font-mono text-sm transition-all`,
          isPlanning
            ? "bg-[var(--neon-green)]/20 border border-[var(--neon-green)]/50 text-[var(--neon-green)]"
            : "bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/30 text-[var(--neon-green)] hover:bg-[var(--neon-green)]/20",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {isPlanning ? (
          <span className="relative flex-shrink-0 w-2 h-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--neon-green)] opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--neon-green)]" />
          </span>
        ) : (
          <MapPin size={14} weight="regular" className="flex-shrink-0" />
        )}
        <span>{isPlanning ? activeLabel : idleLabel}</span>
      </button>

      <PlanSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        place={place}
        event={event}
        onPlanCreated={handlePlanCreated}
      />
    </>
  );
});

export type { PlanCTAProps };
