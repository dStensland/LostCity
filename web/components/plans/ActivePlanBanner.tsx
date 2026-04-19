"use client";

import { memo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import { Users, EyeSlash, Globe, SignOut } from "@phosphor-icons/react";
import { triggerHaptic } from "@/lib/haptics";
import { usePortalSlug } from "@/lib/portal-context";
import type { PlanVisibility } from "@/lib/types/plans";

// Renamed from ActiveHangBanner → ActivePlanBanner
// Data shape updated: hang.venue → plan.place (optional embed from caller)

type Visibility = PlanVisibility;

/** Minimal place embed for the banner — callers that have this data can pass it. */
export interface ActivePlanBannerPlace {
  id: number;
  name: string;
  slug: string | null;
  image_url: string | null;
  neighborhood: string | null;
  address: string | null;
}

export interface ActivePlanBannerProps {
  plan: {
    id: string;
    anchor_place_id: number | null;
    status: "planning" | "active" | "ended" | "expired" | "cancelled";
    visibility: Visibility;
    note: string | null;
    starts_at: string;
    started_at: string | null;
    title: string | null;
    /** Optional — supply when caller has the anchor place detail */
    place?: ActivePlanBannerPlace | null;
  };
  onEnd: () => void;
  onChangeVisibility?: (visibility: Visibility) => void;
  className?: string;
}

const VISIBILITY_CYCLE: Visibility[] = ["private", "friends", "public"];

const VISIBILITY_CONFIG: Record<
  Visibility,
  {
    label: string;
    icon: React.ElementType;
    colorClass: string;
    bgClass: string;
    borderClass: string;
  }
> = {
  private: {
    label: "Only you",
    icon: EyeSlash,
    colorClass: "text-[var(--neon-green)]",
    bgClass: "bg-[var(--neon-green)]/10",
    borderClass: "border-[var(--neon-green)]/20",
  },
  friends: {
    label: "Friends",
    icon: Users,
    colorClass: "text-[var(--coral)]",
    bgClass: "bg-[var(--coral)]/10",
    borderClass: "border-[var(--coral)]/20",
  },
  public: {
    label: "Public",
    icon: Globe,
    colorClass: "text-[var(--neon-cyan)]",
    bgClass: "bg-[var(--neon-cyan)]/10",
    borderClass: "border-[var(--neon-cyan)]/20",
  },
};

/** Format time since plan started as "Active · 3h 20m" or just "Active" */
function formatActiveSince(startedAt: string | null): string {
  if (!startedAt) return "Active";
  const ms = Date.now() - new Date(startedAt).getTime();
  if (ms < 0) return "Active";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `Active · ${hours}h ${minutes}m`;
  if (minutes > 0) return `Active · ${minutes}m`;
  return "Active";
}

export const ActivePlanBanner = memo(function ActivePlanBanner({
  plan,
  onEnd,
  onChangeVisibility,
  className,
}: ActivePlanBannerProps) {
  const portalSlug = usePortalSlug();

  const [activeSince, setActiveSince] = useState<string>(() =>
    formatActiveSince(plan.started_at)
  );

  // Update elapsed time every minute
  useEffect(() => {
    const tick = () => setActiveSince(formatActiveSince(plan.started_at));
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [plan.started_at]);

  const handleVisibilityToggle = useCallback(() => {
    if (!onChangeVisibility) return;
    const currentIdx = VISIBILITY_CYCLE.indexOf(plan.visibility);
    const nextIdx = (currentIdx + 1) % VISIBILITY_CYCLE.length;
    const nextVisibility = VISIBILITY_CYCLE[nextIdx];
    triggerHaptic("selection");
    onChangeVisibility(nextVisibility);
  }, [plan.visibility, onChangeVisibility]);

  const handleEnd = useCallback(() => {
    triggerHaptic("medium");
    onEnd();
  }, [onEnd]);

  const visConfig = VISIBILITY_CONFIG[plan.visibility];
  const VisIcon = visConfig.icon;

  const place = plan.place ?? null;
  const displayName = plan.title ?? place?.name ?? "Active Plan";
  const placeHref = place?.slug ? `/${portalSlug}/spots/${place.slug}` : null;
  const imageUrl = place?.image_url ?? null;

  return (
    <div
      className={`
        flex items-center gap-3 px-3 py-2.5
        bg-[var(--neon-green)]/8 border border-[var(--neon-green)]/20 rounded-xl
        ${className ?? ""}
      `}
    >
      {/* Place thumbnail with pulsing ring */}
      {placeHref ? (
        <Link href={placeHref} className="flex-shrink-0 relative" aria-label={`View ${displayName}`}>
          <PlanThumbnail imageUrl={imageUrl} name={displayName} isActive={plan.status === "active"} />
        </Link>
      ) : (
        <div className="flex-shrink-0 relative">
          <PlanThumbnail imageUrl={imageUrl} name={displayName} isActive={plan.status === "active"} />
        </div>
      )}

      {/* Center: plan name + status/visibility */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--cream)] leading-snug truncate">
          {placeHref ? (
            <>
              You&apos;re at{" "}
              <Link
                href={placeHref}
                className="font-semibold hover:text-[var(--neon-green)] transition-colors"
              >
                {displayName}
              </Link>
            </>
          ) : (
            <span className="font-semibold">{displayName}</span>
          )}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-xs font-mono text-[var(--soft)]">
            {activeSince}
          </span>
          <span className="text-[var(--muted)] text-xs">·</span>
          {/* Tappable visibility badge */}
          <button
            onClick={handleVisibilityToggle}
            disabled={!onChangeVisibility}
            className={`
              inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border
              font-mono text-2xs font-medium
              ${visConfig.colorClass} ${visConfig.bgClass} ${visConfig.borderClass}
              ${onChangeVisibility ? "cursor-pointer hover:opacity-80 active:scale-95 transition-all" : "cursor-default"}
            `}
            aria-label={`Visibility: ${visConfig.label}. ${onChangeVisibility ? "Tap to change." : ""}`}
          >
            <VisIcon size={10} weight="bold" />
            {visConfig.label}
          </button>
        </div>
      </div>

      {/* Right: End button */}
      <button
        onClick={handleEnd}
        className="flex-shrink-0 flex items-center gap-1 font-mono text-xs text-[var(--neon-green)] hover:text-[var(--cream)] transition-colors active:scale-95"
        aria-label="End active plan"
      >
        <SignOut size={14} weight="bold" />
        Leave
      </button>
    </div>
  );
});

function PlanThumbnail({ imageUrl, name, isActive }: { imageUrl: string | null; name: string; isActive: boolean }) {
  return (
    <>
      <div className="w-10 h-10 rounded-lg overflow-hidden relative">
        {imageUrl ? (
          <SmartImage
            src={imageUrl}
            alt={name}
            width={40}
            height={40}
            sizes="40px"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-[var(--twilight)] flex items-center justify-center">
            <span className="text-[var(--muted)] text-xs font-bold">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      {/* Pulsing green ring for active status */}
      {isActive && (
        <span className="absolute inset-0 rounded-lg ring-2 ring-[var(--neon-green)]/60 animate-ping pointer-events-none" />
      )}
      <span className="absolute inset-0 rounded-lg ring-1 ring-[var(--neon-green)]/40 pointer-events-none" />
    </>
  );
}

// ActivePlanBannerProps is already exported inline above
