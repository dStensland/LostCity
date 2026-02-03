"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import CategoryIcon from "@/components/CategoryIcon";
import { formatTimeSplit } from "@/lib/formats";

interface CalendarEvent {
  id: number;
  title: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  category: string | null;
  subcategory: string | null;
  rsvp_status: "going" | "interested" | "went";
  venue: {
    name: string;
    neighborhood: string | null;
  } | null;
}

interface HoverPreviewCardProps {
  event: CalendarEvent;
  triggerRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  portalSlug?: string;
}

const HOVER_DELAY = 200; // ms before showing

export function useHoverPreview() {
  const [hoveredEvent, setHoveredEvent] = useState<CalendarEvent | null>(null);
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPreview = useCallback((event: CalendarEvent, element: HTMLElement) => {
    // Clear any pending hide timeout
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }

    // Set a delay before showing
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredEvent(event);
      setTriggerElement(element);
    }, HOVER_DELAY);
  }, []);

  const hidePreview = useCallback(() => {
    // Clear show timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // Small delay before hiding to allow moving to the preview card
    leaveTimeoutRef.current = setTimeout(() => {
      setHoveredEvent(null);
      setTriggerElement(null);
    }, 100);
  }, []);

  const keepPreviewOpen = useCallback(() => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    };
  }, []);

  return {
    hoveredEvent,
    triggerElement,
    showPreview,
    hidePreview,
    keepPreviewOpen,
  };
}

export default function HoverPreviewCard({
  event,
  triggerRef,
  onClose,
  portalSlug = "la",
}: HoverPreviewCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, flipUp: false });

  // Calculate position using useLayoutEffect for synchronous DOM measurements
  // We use a ref callback pattern to avoid the lint warning about setState in effects
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !cardRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const cardRect = cardRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let top = triggerRect.bottom + 8;
    let left = triggerRect.left;
    let flipUp = false;

    // Flip up if not enough space below
    if (top + cardRect.height > viewportHeight - 20) {
      top = triggerRect.top - cardRect.height - 8;
      flipUp = true;
    }

    // Adjust left if too close to right edge
    if (left + cardRect.width > viewportWidth - 20) {
      left = viewportWidth - cardRect.width - 20;
    }

    // Don't go past left edge
    if (left < 20) {
      left = 20;
    }

    setPosition({ top, left, flipUp });
  }, [triggerRef]);

  useEffect(() => {
    // Use requestAnimationFrame to defer state update out of the effect body
    const frame = requestAnimationFrame(calculatePosition);
    return () => cancelAnimationFrame(frame);
  }, [calculatePosition]);

  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);

  const formatPrice = (): string | null => {
    if (event.is_free) return "Free";
    if (event.price_min === null) return null;
    if (event.price_max === null || event.price_min === event.price_max) {
      return `$${event.price_min}`;
    }
    return `$${event.price_min}-${event.price_max}`;
  };

  const price = formatPrice();

  return (
    <div
      ref={cardRef}
      className={`
        fixed z-50 w-72 bg-[var(--midnight-blue)] border border-[var(--nebula)] rounded-xl shadow-xl shadow-[var(--deep-violet)]/50
        transition-opacity duration-150
      `}
      style={{
        top: position.top,
        left: position.left,
      }}
      onMouseEnter={() => {}} // Handled by parent keepPreviewOpen
      onMouseLeave={onClose}
    >
      {/* Header with category */}
      <div className="p-4 border-b border-[var(--nebula)]/50">
        <div className="flex items-start gap-3">
          {event.category && (
            <div className="p-2 rounded-lg bg-[var(--twilight-purple)]/50 flex-shrink-0">
              <CategoryIcon type={event.category} size={20} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-[var(--cream)] font-medium line-clamp-2">{event.title}</h3>
            {event.venue && (
              <p className="text-sm text-[var(--muted)] mt-0.5 truncate">{event.venue.name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="p-4 space-y-2">
        {/* Time */}
        <div className="flex items-center gap-2 text-sm">
          <svg
            className="w-4 h-4 text-[var(--coral)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-[var(--cream)]">
            {time}
            {period && <span className="text-[var(--muted)] text-xs ml-1">{period}</span>}
            {event.end_time && !event.is_all_day && (
              <span className="text-[var(--muted)]">
                {" "}
                - {formatTimeSplit(event.end_time, false).time}
                {formatTimeSplit(event.end_time, false).period && (
                  <span className="text-xs ml-1">{formatTimeSplit(event.end_time, false).period}</span>
                )}
              </span>
            )}
          </span>
        </div>

        {/* Venue location */}
        {event.venue?.neighborhood && (
          <div className="flex items-center gap-2 text-sm">
            <svg
              className="w-4 h-4 text-[var(--muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="text-[var(--soft)]">{event.venue.neighborhood}</span>
          </div>
        )}

        {/* Tags row */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {price && (
            <span
              className={`
                px-2 py-0.5 rounded-full font-mono text-[0.6rem] font-medium
                ${event.is_free
                  ? "bg-[var(--neon-green)]/20 text-[var(--neon-green)]"
                  : "bg-[var(--twilight-purple)] text-[var(--cream)]"
                }
              `}
            >
              {price}
            </span>
          )}
          {event.category && (
            <span className="px-2 py-0.5 rounded-full bg-[var(--twilight-purple)] font-mono text-[0.6rem] text-[var(--muted)]">
              {event.category}
            </span>
          )}
          {event.subcategory && (
            <span className="px-2 py-0.5 rounded-full bg-[var(--cosmic-blue)] font-mono text-[0.6rem] text-[var(--muted)]">
              {event.subcategory}
            </span>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t border-[var(--nebula)]/50 flex items-center justify-between">
        {/* RSVP status */}
        <span
          className={`
            inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-medium
            ${event.rsvp_status === "going"
              ? "bg-[var(--coral)]/20 text-[var(--coral)]"
              : "bg-[var(--gold)]/20 text-[var(--gold)]"
            }
          `}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              event.rsvp_status === "going" ? "bg-[var(--coral)]" : "bg-[var(--gold)]"
            }`}
          />
          {event.rsvp_status === "going" ? "Going" : "Interested"}
        </span>

        {/* View details link */}
        <Link
          href={`/${portalSlug}?event=${event.id}`}
          scroll={false}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--coral)]/20 text-[var(--coral)] font-mono text-xs font-medium hover:bg-[var(--coral)]/30 transition-colors"
        >
          Details
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
