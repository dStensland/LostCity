"use client";

import {
  ZONE_COLORS,
  getDangerLevel,
  getBufferLabel,
  WalkingPersonIcon,
} from "@/lib/playbook-shared";
import { formatWalkTime, formatWalkDistance } from "@/lib/itinerary-utils";

interface OutingTimelineConnectorProps {
  walkTimeMinutes: number | null;
  walkDistanceMeters: number | null;
  durationMinutes?: number;
}

export default function OutingTimelineConnector({
  walkTimeMinutes,
  walkDistanceMeters,
  durationMinutes = 60,
}: OutingTimelineConnectorProps) {
  const walkTime = formatWalkTime(walkTimeMinutes);
  const walkDist = formatWalkDistance(walkDistanceMeters);
  const walkMin = walkTimeMinutes || 0;
  const bufferMinutes = durationMinutes - walkMin;
  const dangerLevel = walkMin > 0 ? getDangerLevel(walkMin, bufferMinutes) : "safe";

  if (!walkTime && !walkDist) return null;

  return (
    <div className="relative flex gap-3 py-1">
      {/* Time column spacer */}
      <div className="shrink-0 w-[54px]" />
      {/* Spine continuation */}
      <div className="shrink-0 w-6 flex justify-center">
        <div className="w-px h-full bg-[var(--neon-cyan)]/10" />
      </div>
      {/* Walk info */}
      <div className="flex-1 flex flex-col gap-1 py-0.5">
        <div className="flex items-center gap-1.5">
          <WalkingPersonIcon size={12} className="text-[var(--muted)]" />
          <span className="text-2xs font-mono text-[var(--muted)]">
            {walkTime}{walkDist ? ` \u00b7 ${walkDist}` : ""}
          </span>
        </div>
        {walkMin > 0 && (
          <div
            className="inline-flex items-center gap-1.5 self-start px-2 py-0.5 rounded-md text-2xs font-mono"
            style={{
              background: ZONE_COLORS[dangerLevel].bg,
              border: `1px solid ${ZONE_COLORS[dangerLevel].border}`,
              color: ZONE_COLORS[dangerLevel].text,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: ZONE_COLORS[dangerLevel].dot }}
            />
            {getBufferLabel(dangerLevel, Math.max(0, bufferMinutes))}
          </div>
        )}
      </div>
    </div>
  );
}
