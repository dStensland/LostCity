"use client";

import { createContext, useContext, ReactNode } from "react";

export type Portal = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  portal_type: "city" | "event" | "business" | "personal";
  status: string;
  visibility: string;
  filters: {
    city?: string;
    geo_center?: [number, number];
    geo_radius_km?: number;
    categories?: string[];
    exclude_categories?: string[];
    neighborhoods?: string[];
    date_range_start?: string;
    date_range_end?: string;
    price_max?: number;
    venue_ids?: number[];
    tags?: string[];
  };
  branding: {
    logo_url?: string;
    hero_image_url?: string;
    favicon_url?: string;
    og_image_url?: string;
    primary_color?: string;
    secondary_color?: string;
    background_color?: string;
    font_heading?: string;
    font_body?: string;
    [key: string]: unknown;
  };
  settings: Record<string, unknown>;
};

type PortalContextValue = {
  portal: Portal;
  isLoading: boolean;
};

const PortalContext = createContext<PortalContextValue | null>(null);

export function PortalProvider({
  portal,
  children,
}: {
  portal: Portal;
  children: ReactNode;
}) {
  return (
    <PortalContext.Provider value={{ portal, isLoading: false }}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const context = useContext(PortalContext);
  if (!context) {
    // Default to Atlanta if no context (for backwards compatibility)
    return {
      portal: {
        id: "default",
        slug: "atlanta",
        name: "Atlanta",
        tagline: "The real Atlanta, found",
        portal_type: "city" as const,
        status: "active",
        visibility: "public",
        filters: { city: "Atlanta" },
        branding: {},
        settings: {},
      },
      isLoading: false,
    };
  }
  return context;
}

export function usePortalName() {
  const { portal } = usePortal();
  return portal.name;
}

export function usePortalCity() {
  const { portal } = usePortal();
  return portal.filters.city || portal.name;
}
