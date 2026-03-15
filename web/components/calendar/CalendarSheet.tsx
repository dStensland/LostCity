"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { useCalendar } from "@/lib/calendar/CalendarProvider";
import { EventPreviewSheet } from "./sheets/EventPreviewSheet";
import { PlanPreviewSheet } from "./sheets/PlanPreviewSheet";
import { CreatePlanSheet } from "./sheets/CreatePlanSheet";
import { AddToPlanSheet } from "./sheets/AddToPlanSheet";
import { FilterSheet } from "./sheets/FilterSheet";
import { ChangeRSVPSheet } from "./sheets/ChangeRSVPSheet";
import { ConflictSheet } from "./sheets/ConflictSheet";
import type { SheetType, SheetState } from "@/lib/types/calendar";

const SHEET_TITLES: Record<SheetType, string> = {
  "event-preview": "Event",
  "plan-preview": "Plan",
  "create-plan": "Create Plan",
  "add-to-plan": "Add to Plan",
  filter: "Filters",
  "change-rsvp": "Change RSVP",
  conflict: "Time Conflict",
};

function SheetContent({ sheetState }: { sheetState: Exclude<SheetState, { sheet: null }> }) {
  switch (sheetState.sheet) {
    case "event-preview":
      return <EventPreviewSheet event={sheetState.data} />;
    case "plan-preview":
      return <PlanPreviewSheet plan={sheetState.data} />;
    case "create-plan":
      return <CreatePlanSheet />;
    case "add-to-plan":
      return <AddToPlanSheet event={sheetState.data} />;
    case "filter":
      return <FilterSheet />;
    case "change-rsvp":
      return <ChangeRSVPSheet event={sheetState.data} />;
    case "conflict":
      return <ConflictSheet data={sheetState.data} />;
    default:
      return null;
  }
}

export function CalendarSheet() {
  const { state, closeSheet } = useCalendar();
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const isOpen = state.sheetState.sheet !== null;

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Required for entrance animation
      setIsVisible(true);
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 300);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) closeSheet();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, closeSheet]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) closeSheet();
  };

  if (typeof document === "undefined" || !isVisible || state.sheetState.sheet === null)
    return null;

  const title = SHEET_TITLES[state.sheetState.sheet];

  return createPortal(
    <div
      className={`fixed inset-0 z-[140] transition-colors duration-300 ${
        isAnimating ? "bg-black/50" : "bg-transparent"
      }`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={sheetRef}
        className={`
          fixed bottom-0 left-0 right-0
          bg-[var(--void)] border-t border-[var(--twilight)]
          rounded-t-2xl shadow-2xl
          max-h-[85vh]
          flex flex-col
          transition-transform duration-300 ease-out
          md:top-0 md:bottom-0 md:left-auto md:right-0 md:w-[420px]
          md:max-h-none md:rounded-none md:border-t-0 md:border-l
          ${
            isAnimating
              ? "translate-y-0 md:translate-x-0"
              : "translate-y-full md:translate-x-full"
          }
        `}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0 md:hidden">
          <div className="w-12 h-1 rounded-full bg-[var(--twilight)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 pt-2 md:pt-5 flex-shrink-0">
          <h2 className="font-mono text-lg font-semibold text-[var(--cream)]">
            {title}
          </h2>
          <button
            onClick={closeSheet}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[var(--twilight)] transition-colors"
            aria-label="Close"
          >
            <X size={18} className="text-[var(--muted)]" />
          </button>
        </div>

        {/* Sheet content — fills remaining height */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <SheetContent sheetState={state.sheetState as Exclude<SheetState, { sheet: null }>} />
        </div>
      </div>
    </div>,
    document.body
  );
}

// Keep default export for backward compatibility with placeholder import
export default CalendarSheet;
