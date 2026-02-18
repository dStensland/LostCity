export type PortalVertical =
  | "city"
  | "hotel"
  | "film"
  | "hospital"
  | "community"
  | "marketplace"
  | "dog";

export type PortalType = "city" | "event" | "business" | "personal" | string;

export type EventMetadataField =
  | "date"
  | "time"
  | "venue"
  | "neighborhood"
  | "distance"
  | "price"
  | "status";

export type ParticipantModel =
  | "artists"
  | "teams"
  | "comics"
  | "speakers"
  | "performers"
  | "contextual";

export type CityScopeMode = "always" | "shared_only" | "never";

export type PortalManifest = {
  version: "v1";
  portalId: string;
  slug: string;
  portalType: PortalType;
  vertical: PortalVertical;
  scope: {
    portalExclusive: boolean;
    allowFederatedSources: boolean;
    sourceIds: number[];
    sourceColumn: string;
    publicOnlyWhenNoPortal: boolean;
    enforceCityFilter: CityScopeMode;
  };
  metadata: {
    eventFieldOrder: EventMetadataField[];
    participantModel: ParticipantModel;
    linkParticipants: boolean;
    showParticipantGenres: boolean;
  };
  modules: {
    events: boolean;
    spots: boolean;
    artists: boolean;
    weather: boolean;
    map: boolean;
  };
};

type PortalManifestInput = {
  portalId: string;
  slug: string;
  portalType: PortalType;
  parentPortalId?: string | null;
  settings?: Record<string, unknown> | null;
  filters?: { city?: string; cities?: string[] } | null;
  sourceIds?: number[];
};

function toPortalVertical(
  portalType: PortalType,
  settings?: Record<string, unknown> | null
): PortalVertical {
  const rawVertical = settings?.vertical;
  if (
    rawVertical === "city" ||
    rawVertical === "hotel" ||
    rawVertical === "film" ||
    rawVertical === "hospital" ||
    rawVertical === "community" ||
    rawVertical === "marketplace" ||
    rawVertical === "dog"
  ) {
    return rawVertical;
  }

  if (portalType === "business") return "community";
  return "city";
}

function sanitizeSourceIds(sourceIds: number[] | undefined): number[] {
  if (!sourceIds || sourceIds.length === 0) return [];
  return sourceIds.filter((id) => Number.isInteger(id) && id > 0);
}

function resolveEventMetadataOrder(vertical: PortalVertical): EventMetadataField[] {
  if (vertical === "hotel") {
    return ["date", "time", "venue", "distance", "price", "status"];
  }

  if (vertical === "hospital") {
    return ["date", "time", "venue", "distance", "status"];
  }

  return ["date", "time", "venue", "neighborhood", "price", "status"];
}

function resolveParticipantModel(vertical: PortalVertical): ParticipantModel {
  if (vertical === "film") return "performers";
  if (vertical === "community") return "contextual";
  return "contextual";
}

function resolveCityScopeMode(
  portalType: PortalType,
  portalExclusive: boolean,
  filters?: { city?: string; cities?: string[] } | null
): CityScopeMode {
  const hasCityGuard = Boolean(filters?.city || (filters?.cities && filters.cities.length > 0));
  if (!hasCityGuard) return "never";
  if (portalType === "business" && portalExclusive) return "shared_only";
  return "always";
}

export function buildPortalManifest(input: PortalManifestInput): PortalManifest {
  const vertical = toPortalVertical(input.portalType, input.settings);
  const portalExclusive = input.portalType === "business" && !input.parentPortalId;
  const sourceIds = sanitizeSourceIds(input.sourceIds);
  const sourceColumn = "source_id";
  const allowFederatedSources = sourceIds.length > 0;

  return {
    version: "v1",
    portalId: input.portalId,
    slug: input.slug,
    portalType: input.portalType,
    vertical,
    scope: {
      portalExclusive,
      allowFederatedSources,
      sourceIds,
      sourceColumn,
      publicOnlyWhenNoPortal: true,
      enforceCityFilter: resolveCityScopeMode(input.portalType, portalExclusive, input.filters),
    },
    metadata: {
      eventFieldOrder: resolveEventMetadataOrder(vertical),
      participantModel: resolveParticipantModel(vertical),
      linkParticipants: true,
      showParticipantGenres: true,
    },
    modules: {
      events: true,
      spots: vertical !== "film",
      artists: vertical === "city" || vertical === "film" || vertical === "community",
      weather: vertical !== "dog",
      map: vertical !== "hotel",
    },
  };
}

export function shouldApplyCityFilter(manifest: PortalManifest): boolean {
  if (manifest.scope.enforceCityFilter === "never") return false;
  if (manifest.scope.enforceCityFilter === "always") return true;
  return !manifest.scope.portalExclusive;
}

