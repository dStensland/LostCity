"use client";

import { useSingleEventLiveStatus } from "@/lib/hooks/useLiveEventStatus";

type LiveIndicatorProps = {
  eventId: number;
  initialIsLive?: boolean;
  size?: "sm" | "md";
  showText?: boolean;
};

/**
 * Real-time live event indicator that auto-updates when event goes live or ends.
 */
export default function LiveIndicator({
  eventId,
  initialIsLive = false,
  size = "sm",
  showText = true,
}: LiveIndicatorProps) {
  const isLive = useSingleEventLiveStatus(eventId, initialIsLive);

  if (!isLive) return null;

  const dotSize = size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2";
  const textSize = size === "sm" ? "text-[0.65rem]" : "text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-medium text-[var(--neon-red)] ${textSize}`}
      title="This event is happening now"
    >
      <span
        className={`${dotSize} rounded-full bg-[var(--neon-red)] animate-pulse`}
        style={{
          boxShadow: "0 0 4px var(--neon-red)",
        }}
      />
      {showText && <span className="animate-pulse-glow">LIVE</span>}
    </span>
  );
}
