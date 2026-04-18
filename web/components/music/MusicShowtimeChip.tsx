"use client";

import { useMemo } from "react";
import Dot from "@/components/ui/Dot";

export interface MusicShowtimeChipProps {
  doorsTime: string | null;
  showTime: string | null;
  ticketStatus: string | null;
  isFree: boolean;
  agePolicy: string | null;
  onTap?: (e?: React.MouseEvent) => void;
}

function formatTime(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const hour12 = ((h + 11) % 12) + 1;
  const period = h >= 12 ? "PM" : "AM";
  if (m === 0) return `${hour12}${period}`;
  return `${hour12}:${String(m).padStart(2, "0")}${period}`;
}

export function MusicShowtimeChip({
  doorsTime, showTime, ticketStatus, isFree, agePolicy, onTap,
}: MusicShowtimeChipProps) {
  const isSoldOut = ticketStatus === "sold-out";
  const isLastTix = ticketStatus === "low-tickets";
  const primary = showTime || doorsTime;
  const showBoth = Boolean(doorsTime && showTime);
  const ageBadge = useMemo(() => {
    if (!agePolicy) return null;
    const normalized = agePolicy.toLowerCase().replace(/_/g, "-");
    if (normalized.includes("all")) return "ALL AGES";
    if (normalized.includes("21")) return "21+";
    if (normalized.includes("18")) return "18+";
    return null;
  }, [agePolicy]);

  if (!primary) return null;

  return (
    <button
      type="button"
      onClick={onTap}
      className={[
        "inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg",
        "bg-[var(--twilight)]/40 hover:bg-[var(--twilight)]/60",
        "border border-[var(--twilight)] active:scale-95 transition",
        "font-mono text-xs",
        isSoldOut ? "opacity-60" : "",
      ].join(" ")}
    >
      {showBoth ? (
        <span className="flex items-baseline gap-1.5">
          <span className="text-[var(--muted)]">DOORS</span>
          <span className="text-[var(--cream)]">{formatTime(doorsTime)}</span>
          <Dot />
          <span className="text-[var(--muted)]">SHOW</span>
          <span className={[
            "text-[var(--vibe)]",
            isSoldOut ? "line-through" : "",
          ].join(" ")}>{formatTime(showTime)}</span>
        </span>
      ) : (
        <span>
          <span className="text-[var(--muted)]">SHOW </span>
          <span className={[
            "text-[var(--vibe)]",
            isSoldOut ? "line-through" : "",
          ].join(" ")}>{formatTime(primary)}</span>
        </span>
      )}
      {isSoldOut && (
        <span className="bg-[var(--coral)] text-[var(--void)] px-1.5 py-0.5 text-2xs font-bold tracking-wider">
          SOLD OUT
        </span>
      )}
      {!isSoldOut && isLastTix && (
        <span className="bg-[var(--gold)] text-[var(--void)] px-1.5 py-0.5 text-2xs font-bold tracking-wider">
          LAST TIX
        </span>
      )}
      {isFree && (
        <span className="border border-[var(--neon-green)] text-[var(--neon-green)] px-1.5 py-0.5 text-2xs font-bold tracking-wider">
          FREE
        </span>
      )}
      {ageBadge && (
        <span className="border border-[var(--twilight)] text-[var(--muted)] px-1.5 py-0.5 text-2xs font-bold tracking-wider">
          {ageBadge}
        </span>
      )}
    </button>
  );
}
