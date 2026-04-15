"use client";

import { FestivalScheduleGrid } from "@/components/detail/FestivalScheduleGrid";
import type { SectionProps } from "@/lib/detail/types";
import { buildEventUrl } from "@/lib/entity-urls";

export function ScheduleSection({ data, portalSlug }: SectionProps) {
  if (data.entityType !== "festival") return null;

  const { programs } = data.payload;
  if (!programs || programs.length === 0) return null;

  const handleEventClick = (sessionId: number) => {
    window.location.href = buildEventUrl(sessionId, portalSlug, "page");
  };

  const handleProgramClick = (programSlug: string) => {
    window.location.href = `/${portalSlug}?series=${programSlug}`;
  };

  return (
    <FestivalScheduleGrid
      programs={programs}
      portalSlug={portalSlug}
      onEventClick={handleEventClick}
      onProgramClick={handleProgramClick}
    />
  );
}
