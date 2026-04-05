"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useReplaceStateParams, useReplaceStateSearch } from "@/lib/hooks/useReplaceStateParams";
import type { ExploreLaneId, ExploreUtilityView } from "./types";

type HistoryMode = "push" | "replace";

export interface ExploreUrlState {
  lane: ExploreLaneId | null;
  q: string;
  display: ExploreUtilityView;
  params: URLSearchParams;
  pathname: string;
  search: string;
  setLane: (lane: ExploreLaneId | null, mode?: HistoryMode) => void;
  setSearchQuery: (query: string, mode?: HistoryMode) => void;
  setDisplay: (display: ExploreUtilityView, mode?: HistoryMode) => void;
  setLaneParams: (
    entries: Record<string, string | null | undefined>,
    mode?: HistoryMode,
  ) => void;
  replaceParams: (
    mutator: (params: URLSearchParams) => void,
    mode?: HistoryMode,
  ) => void;
  goHome: (mode?: HistoryMode) => void;
}

const ExploreUrlStateContext = createContext<ExploreUrlState | null>(null);

function applyHistory(url: string, mode: HistoryMode) {
  if (mode === "replace") {
    window.history.replaceState(window.history.state, "", url);
    return;
  }
  window.history.pushState(window.history.state, "", url);
}

function normalizeLane(
  params: URLSearchParams,
): { lane: ExploreLaneId | null; display: ExploreUtilityView } {
  const rawLane = params.get("lane");
  const rawDisplay = params.get("display");

  if (rawLane === "map") {
    return { lane: "events", display: "map" };
  }
  if (rawLane === "calendar") {
    return { lane: "events", display: "calendar" };
  }

  const display: ExploreUtilityView =
    rawDisplay === "map" || rawDisplay === "calendar" ? rawDisplay : "list";

  const lane =
    rawLane === "events" ||
    rawLane === "shows" ||
    rawLane === "game-day" ||
    rawLane === "regulars" ||
    rawLane === "places" ||
    rawLane === "classes"
      ? rawLane
      : null;

  return {
    lane,
    display: lane === "events" ? display : "list",
  };
}

export function ExploreUrlStateProvider({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  const params = useReplaceStateParams();
  const search = useReplaceStateSearch();
  const { lane, display } = useMemo(() => normalizeLane(params), [params]);
  const q = params.get("q")?.trim() ?? "";

  const replaceParams = useCallback(
    (mutator: (next: URLSearchParams) => void, mode: HistoryMode = "replace") => {
      const next = new URLSearchParams(params.toString());
      next.delete("view");
      mutator(next);
      const qs = next.toString();
      applyHistory(`${pathname}${qs ? `?${qs}` : ""}`, mode);
    },
    [params, pathname],
  );

  const setLane = useCallback(
    (nextLane: ExploreLaneId | null, mode: HistoryMode = "push") => {
      replaceParams((next) => {
        next.delete("q");
        next.delete("focus");
        if (!nextLane) {
          next.delete("lane");
          next.delete("display");
          return;
        }

        next.set("lane", nextLane);
        if (nextLane !== "events") {
          next.delete("display");
        } else if (!next.get("display")) {
          next.set("display", "list");
        }
      }, mode);
    },
    [replaceParams],
  );

  const setSearchQuery = useCallback(
    (query: string, mode: HistoryMode = "push") => {
      replaceParams((next) => {
        const trimmed = query.trim();
        next.delete("lane");
        next.delete("display");
        next.delete("focus");
        next.delete("search");
        if (!trimmed) {
          next.delete("q");
        } else {
          next.set("q", trimmed);
        }
      }, mode);
    },
    [replaceParams],
  );

  const setDisplay = useCallback(
    (nextDisplay: ExploreUtilityView, mode: HistoryMode = "replace") => {
      replaceParams((next) => {
        next.delete("q");
        next.set("lane", "events");
        if (nextDisplay === "list") {
          next.delete("display");
        } else {
          next.set("display", nextDisplay);
        }
      }, mode);
    },
    [replaceParams],
  );

  const setLaneParams = useCallback(
    (
      entries: Record<string, string | null | undefined>,
      mode: HistoryMode = "replace",
    ) => {
      replaceParams((next) => {
        for (const [key, value] of Object.entries(entries)) {
          if (!value) {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        }
      }, mode);
    },
    [replaceParams],
  );

  const goHome = useCallback(
    (mode: HistoryMode = "push") => {
      replaceParams((next) => {
        next.delete("lane");
        next.delete("display");
        next.delete("q");
        next.delete("focus");
      }, mode);
    },
    [replaceParams],
  );

  const value = useMemo<ExploreUrlState>(
    () => ({
      lane,
      q,
      display,
      params,
      pathname,
      search,
      setLane,
      setSearchQuery,
      setDisplay,
      setLaneParams,
      replaceParams,
      goHome,
    }),
    [
      display,
      goHome,
      lane,
      params,
      pathname,
      q,
      replaceParams,
      search,
      setDisplay,
      setLane,
      setLaneParams,
      setSearchQuery,
    ],
  );

  return (
    <ExploreUrlStateContext.Provider value={value}>
      {children}
    </ExploreUrlStateContext.Provider>
  );
}

export function useExploreUrlState(): ExploreUrlState {
  const value = useContext(ExploreUrlStateContext);
  if (!value) {
    throw new Error("useExploreUrlState must be used within ExploreUrlStateProvider");
  }
  return value;
}
