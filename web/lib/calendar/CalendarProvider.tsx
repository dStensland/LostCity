"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from "react";
import { addMonths, subMonths, isSameDay, isSameMonth } from "date-fns";
import { useSearchParams } from "next/navigation";
import { useCalendarPreferences } from "@/lib/hooks/useCalendarPreferences";
import type {
  CalendarState,
  CalendarAction,
  CalendarView,
  StatusFilter,
  SheetState,
} from "@/lib/types/calendar";

function calendarReducer(
  state: CalendarState,
  action: CalendarAction
): CalendarState {
  switch (action.type) {
    case "SET_MONTH":
      return { ...state, currentMonth: action.month };
    case "SELECT_DATE":
      return { ...state, selectedDate: action.date };
    case "SET_VIEW":
      return { ...state, currentView: action.view };
    case "SET_STATUS_FILTER":
      return { ...state, statusFilter: action.filter };
    case "TOGGLE_FRIENDS_PANEL":
      return { ...state, friendsPanelOpen: !state.friendsPanelOpen };
    case "TOGGLE_FRIEND": {
      const next = new Set(state.selectedFriendIds);
      if (next.has(action.friendId)) {
        next.delete(action.friendId);
      } else {
        next.add(action.friendId);
      }
      return { ...state, selectedFriendIds: next };
    }
    case "CLEAR_FRIENDS":
      return { ...state, selectedFriendIds: new Set() };
    case "OPEN_SHEET":
      return {
        ...state,
        sheetState: action.sheetState,
      };
    case "CLOSE_SHEET":
      return { ...state, sheetState: { sheet: null } };
    case "GO_TO_TODAY": {
      const today = new Date();
      return { ...state, currentMonth: today, selectedDate: today };
    }
    case "NEXT_MONTH":
      return { ...state, currentMonth: addMonths(state.currentMonth, 1) };
    case "PREV_MONTH":
      return { ...state, currentMonth: subMonths(state.currentMonth, 1) };
    case "TOGGLE_SYNC_MENU":
      return { ...state, syncMenuOpen: !state.syncMenuOpen };
    default:
      return state;
  }
}

const initialState: CalendarState = {
  currentMonth: new Date(),
  selectedDate: new Date(),
  currentView: "agenda",
  statusFilter: "all",
  friendsPanelOpen: false,
  selectedFriendIds: new Set(),
  sheetState: { sheet: null },
  syncMenuOpen: false,
};

interface CalendarContextValue {
  state: CalendarState;
  dispatch: React.Dispatch<CalendarAction>;
  // Convenience dispatchers
  setView: (view: CalendarView) => void;
  setStatusFilter: (filter: StatusFilter) => void;
  selectDate: (date: Date | null) => void;
  openSheet: (sheetState: Exclude<SheetState, { sheet: null }>) => void;
  closeSheet: () => void;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function useCalendar() {
  const ctx = useContext(CalendarContext);
  if (!ctx)
    throw new Error("useCalendar must be used within CalendarProvider");
  return ctx;
}

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(calendarReducer, initialState);
  const searchParams = useSearchParams();
  const { data: preferences } = useCalendarPreferences();

  // Sync preferences default_view on load (only when no URL override)
  useEffect(() => {
    if (preferences?.default_view && !searchParams.get("view")) {
      dispatch({ type: "SET_VIEW", view: preferences.default_view });
    }
    // Only run when preferences first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences?.default_view]);

  // URL sync: read ?date= and ?view= on mount
  useEffect(() => {
    const dateParam = searchParams.get("date");
    const viewParam = searchParams.get("view") as CalendarView | null;

    if (viewParam && ["month", "week", "agenda"].includes(viewParam)) {
      dispatch({ type: "SET_VIEW", view: viewParam });
    }

    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const parsed = new Date(`${dateParam}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        const frame = requestAnimationFrame(() => {
          if (!state.selectedDate || !isSameDay(state.selectedDate, parsed)) {
            dispatch({ type: "SELECT_DATE", date: parsed });
          }
          if (!isSameMonth(state.currentMonth, parsed)) {
            dispatch({ type: "SET_MONTH", month: parsed });
          }
        });
        return () => cancelAnimationFrame(frame);
      }
    }
    // Only run on mount / param changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // URL sync: write state changes to URL (replaceState, not router.push)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let changed = false;

    const viewParam = params.get("view");
    if (viewParam !== state.currentView) {
      params.set("view", state.currentView);
      changed = true;
    }

    if (state.selectedDate) {
      const dateStr = state.selectedDate.toISOString().slice(0, 10);
      if (params.get("date") !== dateStr) {
        params.set("date", dateStr);
        changed = true;
      }
    }

    if (changed) {
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(window.history.state, "", newUrl);
    }
  }, [state.currentView, state.selectedDate]);

  const setView = useCallback(
    (view: CalendarView) => dispatch({ type: "SET_VIEW", view }),
    []
  );
  const setStatusFilter = useCallback(
    (filter: StatusFilter) =>
      dispatch({ type: "SET_STATUS_FILTER", filter }),
    []
  );
  const selectDate = useCallback(
    (date: Date | null) => dispatch({ type: "SELECT_DATE", date }),
    []
  );
  const openSheet = useCallback(
    (sheetState: Exclude<SheetState, { sheet: null }>) => {
      dispatch({ type: "OPEN_SHEET", sheetState });
    },
    []
  );
  const closeSheet = useCallback(
    () => dispatch({ type: "CLOSE_SHEET" }),
    []
  );

  const value: CalendarContextValue = {
    state,
    dispatch,
    setView,
    setStatusFilter,
    selectDate,
    openSheet,
    closeSheet,
  };

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}
