"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  useOutingPlanner,
  type AnchorInput,
  type UseOutingPlannerReturn,
} from "./useOutingPlanner";
import { getOutingCopy, type OutingCopy } from "./outing-copy";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface OutingPlannerContextValue extends UseOutingPlannerReturn {
  copy: OutingCopy;
}

const OutingPlannerContext = createContext<OutingPlannerContextValue | null>(null);

export function useOutingPlannerContext(): OutingPlannerContextValue {
  const ctx = useContext(OutingPlannerContext);
  if (!ctx) {
    throw new Error("useOutingPlannerContext must be used within <OutingPlannerProvider>");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface OutingPlannerProviderProps {
  portalId: string;
  portalSlug: string;
  portalVertical?: string;
  anchor: AnchorInput | null;
  isOpen: boolean;
  children: ReactNode;
}

export default function OutingPlannerProvider({
  portalId,
  portalSlug,
  portalVertical,
  anchor,
  isOpen,
  children,
}: OutingPlannerProviderProps) {
  const planner = useOutingPlanner(portalId, portalSlug, anchor, isOpen);
  const copy = getOutingCopy(portalVertical);

  return (
    <OutingPlannerContext.Provider value={{ ...planner, copy }}>
      {children}
    </OutingPlannerContext.Provider>
  );
}
