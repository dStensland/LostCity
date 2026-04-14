"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { PresentedResults } from "@/lib/search/presenting/types";
import type { StructuredFilters } from "@/lib/search/understanding/types";

export type SearchStatus = "idle" | "annotating" | "fetching" | "ready" | "error";
export type SearchMode = "inline" | "overlay";

interface SearchStore {
  // query slice — updates on every keystroke
  raw: string;
  filters: StructuredFilters;

  // results slice — updates on fetch completion only
  results: PresentedResults | null;
  status: SearchStatus;
  requestId: string | null;
  error: string | null;

  // ui slice
  mode: SearchMode;
  overlayOpen: boolean;

  // actions
  setRaw: (raw: string) => void;
  setFilters: (f: Partial<StructuredFilters>) => void;
  startFetch: (requestId: string) => void;
  commitResults: (r: PresentedResults, requestId: string) => void;
  commitError: (error: string, requestId: string) => void;
  openOverlay: () => void;
  closeOverlay: () => void;
  clear: () => void;
}

export const useSearchStore = create<SearchStore>()(
  subscribeWithSelector((set, get) => ({
    raw: "",
    filters: {},
    results: null,
    status: "idle",
    requestId: null,
    error: null,
    mode: "inline",
    overlayOpen: false,

    setRaw: (raw) => set({ raw }),

    setFilters: (f) => set({ filters: { ...get().filters, ...f } }),

    startFetch: (requestId) => set({ requestId, status: "fetching", error: null }),

    commitResults: (r, requestId) => {
      if (get().requestId !== requestId) return; // stale
      set({ results: r, status: "ready", error: null });
    },

    commitError: (error, requestId) => {
      if (get().requestId !== requestId) return;
      set({ status: "error", error });
    },

    openOverlay: () => set({ overlayOpen: true, mode: "overlay" }),

    closeOverlay: () => set({ overlayOpen: false }),

    clear: () =>
      set({
        raw: "",
        filters: {},
        results: null,
        status: "idle",
        requestId: null,
        error: null,
      }),
  })),
);
