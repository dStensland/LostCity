"use client";

import { useCallback, useMemo, useState } from "react";
import type { FeedEvent } from "@/lib/forth-types";
import {
  OPEN_PLANNER_EVENT,
  quickAddEventToItinerary,
} from "@/lib/concierge/quick-itinerary";
import {
  trackConciergeResource,
  trackConciergeWayfinding,
} from "@/lib/analytics/concierge-tracking";
import { phoneHref } from "@/lib/forth-types";

type QuickAddStatus = "idle" | "saving" | "added" | "error";

interface ItineraryQuickAddButtonProps {
  event: FeedEvent;
  portalId: string;
  portalSlug: string;
  sectionKey: string;
  conciergePhone?: string;
  compact?: boolean;
  tone?: "light" | "dark";
}

function buttonLabel(status: QuickAddStatus): string {
  if (status === "saving") return "Adding...";
  if (status === "added") return "Added • Open planner";
  if (status === "error") return "Try again";
  return "Add to itinerary";
}

export default function ItineraryQuickAddButton({
  event,
  portalId,
  portalSlug,
  sectionKey,
  conciergePhone,
  compact = false,
  tone = "dark",
}: ItineraryQuickAddButtonProps) {
  const [status, setStatus] = useState<QuickAddStatus>("idle");
  const [errorLabel, setErrorLabel] = useState<string | null>(null);

  const disableButton = status === "saving";
  const hasError = status === "error";

  const actionClassName = useMemo(() => {
    const size = compact ? "px-3 py-1.5 text-[11px]" : "px-4 py-2 text-xs";
    const base = `${size} inline-flex items-center justify-center rounded-full font-body font-semibold uppercase tracking-[0.1em] transition-colors`;
    const pending = tone === "light"
      ? `${base} bg-[var(--hotel-charcoal)] text-white hover:bg-[var(--hotel-ink)]`
      : `${base} bg-[var(--hotel-champagne)] text-[var(--hotel-ink)] hover:brightness-110`;
    if (status === "added") {
      return `${base} bg-emerald-600 text-white`;
    }
    if (status === "error") {
      return `${base} bg-rose-700 text-white hover:bg-rose-600`;
    }
    return pending;
  }, [compact, status, tone]);

  const fallbackClassName = tone === "light"
    ? "rounded-full border border-[var(--hotel-sand)] px-2.5 py-1 text-[var(--hotel-charcoal)] hover:bg-[var(--hotel-sand)]/25 transition-colors"
    : "rounded-full border border-white/30 px-2.5 py-1 text-white/90 hover:bg-white/10 transition-colors";

  const openPlanner = useCallback((source: "quick_add_error" | "quick_add_success") => {
    window.dispatchEvent(
      new CustomEvent(OPEN_PLANNER_EVENT, {
        detail: {
          source,
          eventId: event.id,
        },
      }),
    );
    trackConciergeWayfinding(portalSlug, {
      sectionKey,
      targetLabel: "Open Planner",
      targetId: "planner",
      metadata: {
        trigger: source === "quick_add_error" ? "quick_add_fallback" : "quick_add_followup",
        event_id: event.id,
        event_title: event.title,
      },
    });
  }, [event.id, event.title, portalSlug, sectionKey]);

  const handleClick = useCallback(async () => {
    if (disableButton) return;
    if (status === "added") {
      openPlanner("quick_add_success");
      return;
    }

    setStatus("saving");
    setErrorLabel(null);

    trackConciergeResource(portalSlug, {
      sectionKey,
      targetKind: "itinerary_quick_add",
      targetId: String(event.id),
      targetLabel: event.title,
      metadata: {
        outcome: "attempt",
      },
    });

    try {
      const result = await quickAddEventToItinerary(portalId, event);
      setStatus("added");
      trackConciergeResource(portalSlug, {
        sectionKey,
        targetKind: "itinerary_quick_add",
        targetId: String(event.id),
        targetLabel: event.title,
        metadata: {
          outcome: "success",
          storage: result.storage,
          item_mode: result.itemMode,
          itinerary_created: result.itineraryCreated,
          itinerary_id: result.itineraryId,
        },
      });
    } catch {
      setStatus("error");
      setErrorLabel("Couldn’t add this right now.");
      trackConciergeResource(portalSlug, {
        sectionKey,
        targetKind: "itinerary_quick_add",
        targetId: String(event.id),
        targetLabel: event.title,
        metadata: {
          outcome: "error",
        },
      });
    }
  }, [disableButton, event, openPlanner, portalId, portalSlug, sectionKey, status]);

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={disableButton}
        className={actionClassName}
        aria-live="polite"
      >
        {buttonLabel(status)}
      </button>
      {hasError && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-body">
          {errorLabel && (
            <span className={tone === "light" ? "text-rose-700" : "text-rose-200/90"}>{errorLabel}</span>
          )}
          <button
            type="button"
            onClick={() => openPlanner("quick_add_error")}
            className={fallbackClassName}
          >
            Open planner
          </button>
          {conciergePhone && (
            <a
              href={phoneHref(conciergePhone)}
              className={fallbackClassName}
              onClick={() => {
                trackConciergeResource(portalSlug, {
                  sectionKey,
                  targetKind: "concierge_call",
                  targetId: conciergePhone,
                  targetLabel: "Call Concierge",
                  metadata: {
                    trigger: "quick_add_fallback",
                    event_id: event.id,
                    event_title: event.title,
                  },
                });
              }}
            >
              Call concierge
            </a>
          )}
        </div>
      )}
    </div>
  );
}
