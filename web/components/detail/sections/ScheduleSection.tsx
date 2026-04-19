"use client";

import { useRouter } from "next/navigation";
import { FestivalScheduleGrid } from "@/components/detail/FestivalScheduleGrid";
import type { SectionProps } from "@/lib/detail/types";
import { buildEventUrl } from "@/lib/entity-urls";
import { useEntityLinkOptions } from "@/lib/link-context";

export function ScheduleSection({ data, portalSlug }: SectionProps) {
  const router = useRouter();
  const { context, existingParams } = useEntityLinkOptions();

  if (data.entityType !== "festival") return null;

  const { programs } = data.payload;
  if (!programs || programs.length === 0) return null;

  const handleEventClick = (sessionId: number) => {
    router.push(buildEventUrl(sessionId, portalSlug, context, existingParams));
  };

  const handleProgramClick = (programSlug: string) => {
    // Programs use the series overlay slot (?series=slug) — clear sibling
    // overlay keys when transitioning from another overlay.
    const next = existingParams
      ? new URLSearchParams(existingParams.toString())
      : new URLSearchParams();
    next.delete("event");
    next.delete("spot");
    next.delete("festival");
    next.delete("org");
    next.delete("artist");
    next.set("series", programSlug);
    router.push(`/${portalSlug}?${next.toString()}`);
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
