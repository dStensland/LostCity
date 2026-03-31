"use client";

import { useMemo } from "react";
import { FindContext } from "@/lib/find-context";

interface FindContextProviderProps {
  portalId: string;
  portalSlug: string;
  portalExclusive: boolean;
  children: React.ReactNode;
}

export function FindContextProvider({
  portalId,
  portalSlug,
  portalExclusive,
  children,
}: FindContextProviderProps) {
  const value = useMemo(
    () => ({ portalId, portalSlug, portalExclusive }),
    [portalId, portalSlug, portalExclusive]
  );
  return <FindContext.Provider value={value}>{children}</FindContext.Provider>;
}
