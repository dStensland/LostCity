"use client";

import { memo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Users, EyeSlash, Globe, SignOut } from "@phosphor-icons/react";
import { triggerHaptic } from "@/lib/haptics";
import { usePortalSlug } from "@/lib/portal-context";
import { trackHangEnded, trackHangVisibilityChanged } from "@/lib/analytics/hangs-tracking";

type Visibility = "private" | "friends" | "public";

interface ActiveHangBannerProps {
  hang: {
    id: string;
    venue_id: number;
    status: "active" | "planned" | "ended";
    visibility: Visibility;
    note: string | null;
    started_at: string;
    auto_expire_at: string;
    venue: {
      id: number;
      name: string;
      slug: string | null;
      image_url: string | null;
      neighborhood: string | null;
      address: string | null;
    };
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

/** Format milliseconds remaining as "3h 20m" or "45m" */
function formatTimeRemaining(ms: number): { text: string; expiringSoon: boolean } {
  if (ms <= 0) return { text: "Ending", expiringSoon: true };

  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const expiringSoon = ms < 30 * 60_000;

  if (hours > 0) {
    return { text: `${hours}h ${minutes}m left`, expiringSoon };
  }
  return { text: `${minutes}m left`, expiringSoon };
}

export const ActiveHangBanner = memo(function ActiveHangBanner({
  hang,
  onEnd,
  onChangeVisibility,
  className,
}: ActiveHangBannerProps) {
  const portalSlug = usePortalSlug();

  const [remaining, setRemaining] = useState<{ text: string; expiringSoon: boolean }>(() =>
    formatTimeRemaining(new Date(hang.auto_expire_at).getTime() - Date.now())
  );

  // Update time remaining every minute
  useEffect(() => {
    const tick = () => {
      setRemaining(formatTimeRemaining(new Date(hang.auto_expire_at).getTime() - Date.now()));
    };

    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [hang.auto_expire_at]);

  const handleVisibilityToggle = useCallback(() => {
    if (!onChangeVisibility) return;
    const currentIdx = VISIBILITY_CYCLE.indexOf(hang.visibility);
    const nextIdx = (currentIdx + 1) % VISIBILITY_CYCLE.length;
    const nextVisibility = VISIBILITY_CYCLE[nextIdx];
    triggerHaptic("selection");
    trackHangVisibilityChanged({ portalSlug, from: hang.visibility, to: nextVisibility });
    onChangeVisibility(nextVisibility);
  }, [hang.visibility, portalSlug, onChangeVisibility]);

  const handleEnd = useCallback(() => {
    triggerHaptic("medium");
    const durationMinutes = Math.round(
      (Date.now() - new Date(hang.started_at).getTime()) / 60_000
    );
    trackHangEnded({ portalSlug, venueId: hang.venue_id, durationMinutes });
    onEnd();
  }, [hang.started_at, hang.venue_id, portalSlug, onEnd]);

  const visConfig = VISIBILITY_CONFIG[hang.visibility];
  const VisIcon = visConfig.icon;
  const venueHref = hang.venue.slug ? `/spots/${hang.venue.slug}` : `/venues/${hang.venue.id}`;

  return (
    <div
      className={`
        flex items-center gap-3 px-3 py-2.5
        bg-[var(--neon-green)]/8 border border-[var(--neon-green)]/20 rounded-xl
        ${className ?? ""}
      `}
    >
      {/* Venue thumbnail with pulsing ring */}
      <Link href={venueHref} className="flex-shrink-0 relative" aria-label={`View ${hang.venue.name}`}>
        <div className="w-10 h-10 rounded-lg overflow-hidden relative">
          {hang.venue.image_url ? (
            <Image
              src={hang.venue.image_url}
              alt={hang.venue.name}
              width={40}
              height={40}
              sizes="40px"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-[var(--twilight)] flex items-center justify-center">
              <span className="text-[var(--muted)] text-xs font-bold">
                {hang.venue.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        {/* Pulsing green ring for active status */}
        {hang.status === "active" && (
          <span className="absolute inset-0 rounded-lg ring-2 ring-[var(--neon-green)]/60 animate-ping pointer-events-none" />
        )}
        <span className="absolute inset-0 rounded-lg ring-1 ring-[var(--neon-green)]/40 pointer-events-none" />
      </Link>

      {/* Center: venue name + time/visibility */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--cream)] leading-snug truncate">
          You&apos;re at{" "}
          <Link
            href={venueHref}
            className="font-semibold hover:text-[var(--neon-green)] transition-colors"
          >
            {hang.venue.name}
          </Link>
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span
            className={`text-xs font-mono ${remaining.expiringSoon ? "text-[var(--coral)]" : "text-[var(--soft)]"}`}
          >
            {remaining.text}
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

      {/* Right: Leave button */}
      <button
        onClick={handleEnd}
        className="flex-shrink-0 flex items-center gap-1 font-mono text-xs text-[var(--neon-green)] hover:text-[var(--cream)] transition-colors active:scale-95"
        aria-label="End hang and leave venue"
      >
        <SignOut size={14} weight="bold" />
        Leave
      </button>
    </div>
  );
});

export type { ActiveHangBannerProps };
