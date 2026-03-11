export type YonderInventoryRefreshCadence = "hourly" | "daily" | "disabled";

export type YonderInventoryRefreshConfig = {
  cadence: YonderInventoryRefreshCadence;
  hourUtc: number | null;
  source: "yonder_inventory_refresh" | "interest_channel_matches_refresh" | "default";
};

type PortalSettings = Record<string, unknown> | null | undefined;

type RefreshSettingsShape = {
  cadence?: unknown;
  hour_utc?: unknown;
};

export type PortalInventoryRefreshTarget = {
  id: string;
  slug: string;
  settings: PortalSettings;
};

export type SkippedInventoryRefreshTarget = {
  id: string;
  slug: string;
  cadence: YonderInventoryRefreshCadence;
  hour_utc: number | null;
  reason: "disabled" | "outside_daily_window";
};

const DEFAULT_DAILY_HOUR_UTC = 11;

function parseHourUtc(value: unknown): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : null;

  if (numeric === null || !Number.isInteger(numeric) || numeric < 0 || numeric > 23) {
    return null;
  }

  return numeric;
}

function normalizeCadence(value: unknown): YonderInventoryRefreshCadence {
  if (value === "hourly" || value === "daily" || value === "disabled") {
    return value;
  }
  return "daily";
}

function parseRefreshConfig(
  raw: unknown,
  source: YonderInventoryRefreshConfig["source"],
): YonderInventoryRefreshConfig | null {
  if (typeof raw === "string") {
    return {
      cadence: normalizeCadence(raw),
      hourUtc: null,
      source,
    };
  }

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const typedRaw = raw as RefreshSettingsShape;
    const cadence = normalizeCadence(typedRaw.cadence);
    const parsedHour = parseHourUtc(typedRaw.hour_utc);

    return {
      cadence,
      hourUtc: cadence === "daily" ? parsedHour ?? DEFAULT_DAILY_HOUR_UTC : null,
      source,
    };
  }

  return null;
}

export function resolveYonderInventoryRefreshConfig(
  portalSettings: PortalSettings,
): YonderInventoryRefreshConfig {
  const explicit = parseRefreshConfig(
    portalSettings?.yonder_inventory_refresh,
    "yonder_inventory_refresh",
  );
  if (explicit) return explicit;

  const inherited = parseRefreshConfig(
    portalSettings?.interest_channel_matches_refresh,
    "interest_channel_matches_refresh",
  );
  if (inherited) return inherited;

  return {
    cadence: "daily",
    hourUtc: DEFAULT_DAILY_HOUR_UTC,
    source: "default",
  };
}

export function shouldRunYonderInventoryRefreshAt(
  config: YonderInventoryRefreshConfig,
  now: Date,
): boolean {
  if (config.cadence === "disabled") return false;
  if (config.cadence === "hourly") return true;

  const hourUtc = config.hourUtc ?? DEFAULT_DAILY_HOUR_UTC;
  return now.getUTCHours() === hourUtc;
}

export function filterPortalsByYonderInventoryRefreshCadence<
  T extends PortalInventoryRefreshTarget,
>(
  portals: T[],
  now: Date = new Date(),
): {
  eligible: T[];
  skipped: SkippedInventoryRefreshTarget[];
} {
  const eligible: T[] = [];
  const skipped: SkippedInventoryRefreshTarget[] = [];

  for (const portal of portals) {
    const config = resolveYonderInventoryRefreshConfig(portal.settings);
    if (shouldRunYonderInventoryRefreshAt(config, now)) {
      eligible.push(portal);
      continue;
    }

    skipped.push({
      id: portal.id,
      slug: portal.slug,
      cadence: config.cadence,
      hour_utc: config.hourUtc,
      reason: config.cadence === "disabled" ? "disabled" : "outside_daily_window",
    });
  }

  return { eligible, skipped };
}
