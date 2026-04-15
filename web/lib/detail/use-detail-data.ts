"use client";

import { useDetailFetch } from "@/lib/hooks/useDetailFetch";
import type { EntityType } from "./types";

const API_ROUTES: Record<EntityType, string> = {
  event: "/api/events",
  place: "/api/places/by-slug",
  series: "/api/series",
  festival: "/api/festivals",
  org: "/api/organizations/by-slug",
};

interface UseDetailDataConfig<T> {
  entityType: EntityType;
  identifier: string | number;
  portalSlug: string;
  initialData?: T;
}

export function useDetailData<T>(config: UseDetailDataConfig<T>) {
  const { entityType, identifier, portalSlug, initialData } = config;

  const needsPortal = entityType === "event" || entityType === "series" || entityType === "festival";
  const portalParam = needsPortal ? `?portal=${portalSlug}` : "";
  const url = initialData
    ? null
    : `${API_ROUTES[entityType]}/${identifier}${portalParam}`;

  const { data: fetchedData, status, error, retry } = useDetailFetch<T>(url, {
    entityLabel: entityType,
  });

  return {
    data: initialData ?? fetchedData,
    status: initialData ? ("ready" as const) : status,
    error,
    retry,
  };
}
