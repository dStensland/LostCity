"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import MapPopupCard from "./MapPopupCard";
import type { EventWithLocation } from "@/lib/search";
import type { Spot } from "@/lib/spots-constants";

interface MobileMapSheetProps {
  event?: EventWithLocation | null;
  spot?: Spot | null;
  portalSlug: string;
  onClose: () => void;
}

export default function MobileMapSheet({ event, spot, portalSlug, onClose }: MobileMapSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const [visible, setVisible] = useState(false);

  // Animate in on mount
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    startY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    if (diff > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${diff}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = currentY.current - startY.current;
    if (diff > 80) {
      setVisible(false);
      setTimeout(onClose, 200);
    } else if (sheetRef.current) {
      sheetRef.current.style.transform = "translateY(0)";
    }
    startY.current = 0;
    currentY.current = 0;
  }, [onClose]);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  if (!event && !spot) return null;

  return (
    <>
      {/* Scrim backdrop */}
      <div
        className={`absolute inset-0 z-10 bg-black/30 transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={() => {
          setVisible(false);
          setTimeout(onClose, 200);
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 z-20 transition-transform duration-200 ease-out ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1 bg-[var(--dusk)] rounded-t-2xl border-t border-x border-[var(--twilight)]">
          <div className="w-10 h-1 rounded-full bg-[var(--muted)]/40" />
        </div>
        <div className="bg-[var(--dusk)] px-4 pb-4 border-x border-b border-[var(--twilight)]" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          {event && (
            <MapPopupCard
              type="event"
              id={event.id}
              title={event.title}
              category={event.category}
              venueName={event.venue?.name || null}
              neighborhood={event.venue?.neighborhood || null}
              startTime={event.start_time}
              isAllDay={event.is_all_day}
              isLive={event.is_live}
              isFree={event.is_free}
              priceMin={event.price_min}
              priceMax={event.price_max}
              portalSlug={portalSlug}
            />
          )}
          {spot && (
            <MapPopupCard
              type="spot"
              slug={spot.slug}
              name={spot.name}
              venueType={spot.venue_type}
              address={spot.address}
              neighborhood={spot.neighborhood}
              portalSlug={portalSlug}
            />
          )}
        </div>
      </div>
    </>
  );
}
