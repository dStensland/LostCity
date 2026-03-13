"use client";

import type { ReactNode } from "react";

interface I18nProviderProps {
  locale: string;
  messages: Record<string, unknown>;
  children: ReactNode;
}

// next-intl removed (Emory portal archived). This is now a passthrough wrapper.
export function I18nProvider({ children }: I18nProviderProps) {
  return <>{children}</>;
}
