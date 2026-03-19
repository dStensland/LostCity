"use client";

import { memo, useState } from "react";
import { MapPin } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { triggerHaptic } from "@/lib/haptics";
import { usePortalSlug } from "@/lib/portal-context";
import { useMyHangs } from "@/lib/hooks/useHangs";
import { HangSheet } from "./HangSheet";
import { HangShareFlow } from "./HangShareFlow";

interface HangButtonProps {
  venue: {
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
  /** Override: explicitly set hang state (auto-detected from useMyHangs if omitted) */
  isHanging?: boolean;
  onHangCreated?: () => void;
}

export const HangButton = memo(function HangButton({
  venue,
  event,
  compact = false,
  rounded = "lg",
  className,
  isHanging: isHangingProp,
  onHangCreated,
}: HangButtonProps) {
  // Auto-detect if user is hanging at this venue via React Query
  const { data: myHangs } = useMyHangs();
  const isHanging = isHangingProp ?? (myHangs?.active?.venue_id === venue.id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [shareFlowOpen, setShareFlowOpen] = useState(false);
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

  const handleHangCreated = () => {
    setSheetOpen(false);
    // Show share flow after successful check-in
    setShareFlowOpen(true);
    onHangCreated?.();
  };

  const shareHangData = {
    id: "latest",
    venue: {
      name: venue.name,
      slug: venue.slug,
      image_url: venue.image_url,
      neighborhood: venue.neighborhood,
    },
    note: null as string | null,
    started_at: new Date().toISOString(),
  };

  if (compact) {
    return (
      <>
        <button
          onClick={handleClick}
          aria-label={isHanging ? `Hanging at ${venue.name}` : `Check in at ${venue.name}`}
          className={[
            "w-8 h-8 rounded-full flex items-center justify-center transition-all",
            isHanging
              ? "bg-[var(--neon-green)]/20 border border-[var(--neon-green)]/50"
              : "bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/30 hover:bg-[var(--neon-green)]/20",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <MapPin
            size={14}
            weight={isHanging ? "fill" : "regular"}
            className="text-[var(--neon-green)]"
          />
        </button>

        <HangSheet
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          venue={venue}
          event={event}
          onHangCreated={handleHangCreated}
        />
        <HangShareFlow
          isOpen={shareFlowOpen}
          onClose={() => setShareFlowOpen(false)}
          hang={shareHangData}
          portalSlug={portalSlug}
        />
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        aria-label={isHanging ? `Hanging at ${venue.name}` : `Check in at ${venue.name}`}
        className={[
          `flex items-center justify-center gap-2 ${rounded === "xl" ? "rounded-xl" : "rounded-lg"} px-3 py-2 font-mono text-sm transition-all`,
          isHanging
            ? "bg-[var(--neon-green)]/20 border border-[var(--neon-green)]/50 text-[var(--neon-green)]"
            : "bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/30 text-[var(--neon-green)] hover:bg-[var(--neon-green)]/20",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Pulsing dot when actively hanging */}
        {isHanging ? (
          <span className="relative flex-shrink-0 w-2 h-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--neon-green)] opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--neon-green)]" />
          </span>
        ) : (
          <MapPin size={14} weight="regular" className="flex-shrink-0" />
        )}
        <span>{isHanging ? "Hanging" : "Start Hang"}</span>
      </button>

      <HangSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        venue={venue}
        event={event}
        onHangCreated={handleHangCreated}
      />
      <HangShareFlow
        isOpen={shareFlowOpen}
        onClose={() => setShareFlowOpen(false)}
        hang={shareHangData}
        portalSlug={portalSlug}
      />
    </>
  );
});

export type { HangButtonProps };
