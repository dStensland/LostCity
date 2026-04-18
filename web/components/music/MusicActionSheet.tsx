"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { buildEventUrl } from "@/lib/entity-urls";
import { useEntityLinkOptions } from "@/lib/link-context";
import type { MusicShowPayload } from "@/lib/music/types";

export interface MusicActionSheetProps {
  show: MusicShowPayload | null;
  portalSlug: string;
  onClose: () => void;
  onAddToPlans: (show: MusicShowPayload) => void;
}

export function MusicActionSheet({ show, portalSlug, onClose, onAddToPlans }: MusicActionSheetProps) {
  const [visible, setVisible] = useState(false);
  const { context, existingParams } = useEntityLinkOptions();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (show) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [show, onClose]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(Boolean(show)));
    return () => cancelAnimationFrame(raf);
  }, [show]);

  if (!show) return null;
  if (typeof document === "undefined") return null;

  const headliner = show.artists.find((a) => a.is_headliner) ?? show.artists[0];
  const supports = show.artists.filter((a) => !a.is_headliner).slice(0, 3);
  const eventUrl = buildEventUrl(show.id, portalSlug, context, existingParams);

  const content = (
    <div
      className={[
        "fixed inset-0 z-[140] bg-black/50",
        "transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
      ].join(" ")}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={[
          "fixed bottom-0 left-0 right-0",
          "bg-[var(--void)] border-t border-[var(--twilight)]",
          "rounded-t-2xl shadow-2xl",
          "max-h-[85vh] overflow-y-auto",
          "md:top-0 md:left-auto md:right-0 md:w-[420px] md:rounded-none md:border-t-0 md:border-l",
          "transition-transform duration-300 ease-out",
          visible
            ? "translate-y-0 md:translate-x-0"
            : "translate-y-full md:translate-x-full md:translate-y-0",
        ].join(" ")}
      >
        <div className="flex justify-center pt-3 pb-2" aria-hidden="true">
          <div className="w-12 h-1 rounded-full bg-[var(--twilight)]" />
        </div>

        <div className="px-4 pb-5">
          <div className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
            {show.venue.name}{show.venue.neighborhood ? ` · ${show.venue.neighborhood}` : ""}
          </div>
          <h2 className="text-xl font-semibold text-[var(--cream)] mb-1">
            {headliner?.name ?? show.title}
          </h2>
          {supports.length > 0 && (
            <div className="text-sm italic text-[var(--soft)] mb-2">
              w/ {supports.map((s) => s.name).join(", ")}
            </div>
          )}
          <div className="text-sm text-[var(--muted)] mb-5 font-mono">
            {show.doors_time && show.start_time
              ? `DOORS ${show.doors_time} · SHOW ${show.start_time}`
              : `SHOW ${show.start_time ?? show.doors_time ?? "TBD"}`}
            {show.age_policy ? ` · ${show.age_policy}` : ""}
            {show.is_free ? " · FREE" : ""}
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              autoFocus
              onClick={() => onAddToPlans(show)}
              className="w-full min-h-[44px] bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
            >
              Add to Plans
            </button>
            {show.ticket_url && (
              <a
                href={show.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[44px] flex items-center justify-center border border-[var(--coral)] text-[var(--coral)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--coral)]/10 transition-colors"
              >
                Get Tickets →
              </a>
            )}
            <a
              href={eventUrl}
              className="w-full min-h-[44px] flex items-center justify-center text-[var(--muted)] hover:text-[var(--cream)] font-mono text-sm transition-colors"
            >
              Open Event →
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
