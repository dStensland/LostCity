"use client";

import { useState } from "react";
import { ForkKnife } from "@phosphor-icons/react";
import OutingPlannerSheet from "@/components/outing-planner/OutingPlannerSheet";

interface OutingPlannerButtonProps {
  event: {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    end_time: string | null;
    is_all_day?: boolean;
    category: string | null;
    venue: {
      id: number;
      name: string;
      slug: string;
      lat: number;
      lng: number;
    };
  };
  portalId: string;
  portalSlug: string;
  portalVertical?: string;
  /** Hex color from getCategoryColor — drives neon glow styling */
  categoryColor?: string;
}

export default function OutingPlannerButton({
  event,
  portalId,
  portalSlug,
  portalVertical,
  categoryColor,
}: OutingPlannerButtonProps) {
  const [open, setOpen] = useState(false);
  const color = categoryColor || "var(--coral)";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 sm:px-4 min-h-[40px] rounded-full text-sm font-mono font-medium transition-all focus-ring active:scale-95"
        style={{
          color,
          backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
          boxShadow: `0 0 12px color-mix(in srgb, ${color} 20%, transparent)`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = `color-mix(in srgb, ${color} 18%, transparent)`;
          e.currentTarget.style.borderColor = `color-mix(in srgb, ${color} 45%, transparent)`;
          e.currentTarget.style.boxShadow = `0 0 16px color-mix(in srgb, ${color} 35%, transparent)`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = `color-mix(in srgb, ${color} 10%, transparent)`;
          e.currentTarget.style.borderColor = `color-mix(in srgb, ${color} 30%, transparent)`;
          e.currentTarget.style.boxShadow = `0 0 12px color-mix(in srgb, ${color} 20%, transparent)`;
        }}
      >
        <ForkKnife size={16} weight="duotone" />
        <span className="hidden sm:inline">Plan Night</span>
      </button>

      <OutingPlannerSheet
        anchor={{
          type: "event",
          event: {
            id: event.id,
            title: event.title,
            start_date: event.start_date,
            start_time: event.start_time,
            end_time: event.end_time,
            is_all_day: event.is_all_day,
            category_id: event.category,
            venue: {
              id: event.venue.id,
              name: event.venue.name,
              slug: event.venue.slug,
              lat: event.venue.lat,
              lng: event.venue.lng,
            },
          },
        }}
        portalId={portalId}
        portalSlug={portalSlug}
        portalVertical={portalVertical}
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
