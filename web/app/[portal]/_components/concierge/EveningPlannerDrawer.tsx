"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { EveningVibe, BuiltEveningResponse } from "@/lib/concierge/evening-vibes";
import EveningPlannerWizard from "./EveningPlannerWizard";
import EveningPlannerResult from "./EveningPlannerResult";

interface EveningPlannerDrawerProps {
  portalSlug: string;
  portalId: string;
  onClose: () => void;
}

type DrawerState = "wizard" | "building" | "result" | "error";

export default function EveningPlannerDrawer({
  portalSlug,
  portalId: _portalId,
  onClose,
}: EveningPlannerDrawerProps) {
  void _portalId; // Reserved for Save to Playbook
  const [state, setState] = useState<DrawerState>("wizard");
  const [result, setResult] = useState<BuiltEveningResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Body scroll lock
  useEffect(() => {
    setMounted(true);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleWizardSubmit = useCallback(
    async (params: { date: string; vibe: EveningVibe; partySize: number }) => {
      setState("building");
      setErrorMessage(null);

      try {
        const searchParams = new URLSearchParams({
          date: params.date,
          vibe: params.vibe,
          party_size: String(params.partySize),
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(
          `/api/portals/${portalSlug}/build-evening?${searchParams}`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || "Failed to build evening");
        }

        const data: BuiltEveningResponse = await response.json();
        setResult(data);
        setState("result");
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Something went wrong"
        );
        setState("error");
      }
    },
    [portalSlug]
  );

  const handleSwapStop = useCallback((stopIndex: number) => {
    // TODO: Integrate with outing-suggestions API for swap alternatives
    void stopIndex;
  }, []);

  const handleRemoveStop = useCallback(
    (stopIndex: number) => {
      if (!result) return;
      setResult({
        ...result,
        stops: result.stops.filter((_, i) => i !== stopIndex),
      });
    },
    [result]
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  if (!mounted) return null;

  const content = (
    <div
      className="fixed inset-0 z-[140] bg-black/50 transition-colors duration-300"
      onClick={handleBackdropClick}
    >
      {/* Mobile: bottom sheet. Desktop: right panel */}
      <div className="fixed bottom-0 left-0 right-0 md:top-0 md:left-auto md:right-0 md:w-[420px] md:rounded-none md:border-t-0 md:border-l bg-[var(--hotel-ivory)] border-t border-[var(--hotel-sand)] rounded-t-2xl shadow-2xl md:shadow-[-8px_0_30px_-10px_rgba(0,0,0,0.1)] max-h-[85vh] md:max-h-full overflow-hidden flex flex-col">
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-2 md:hidden">
          <div className="w-12 h-1 rounded-full bg-[var(--hotel-sand)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1 md:pt-4">
          <h2 className="font-display text-lg text-[var(--hotel-charcoal)]">
            {state === "wizard"
              ? "Plan Your Evening"
              : state === "building"
              ? "Building..."
              : "Your Evening"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--hotel-cream)] transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5 text-[var(--hotel-stone)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-4 pb-6">
          {state === "wizard" && (
            <EveningPlannerWizard onSubmit={handleWizardSubmit} />
          )}

          {state === "building" && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="w-10 h-10 border-2 border-[var(--hotel-champagne)] border-t-transparent rounded-full animate-spin" />
              <p className="font-body text-sm text-[var(--hotel-stone)]">
                Crafting your perfect evening...
              </p>
            </div>
          )}

          {state === "result" && result && (
            <EveningPlannerResult
              result={result}
              portalSlug={portalSlug}
              onSwapStop={handleSwapStop}
              onRemoveStop={handleRemoveStop}
            />
          )}

          {state === "error" && (
            <div className="text-center py-12 space-y-4">
              <p className="font-body text-sm text-red-600">
                {errorMessage || "Something went wrong"}
              </p>
              <button
                onClick={() => setState("wizard")}
                className="px-6 py-2 rounded-full border border-[var(--hotel-sand)] bg-white text-sm font-body text-[var(--hotel-charcoal)] hover:bg-[var(--hotel-cream)] transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
