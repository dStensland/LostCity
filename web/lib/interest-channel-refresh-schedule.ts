export type InterestChannelRefreshCadence = "hourly" | "daily" | "disabled";

export type InterestChannelRefreshConfig = {
  cadence: InterestChannelRefreshCadence;
  hourUtc: number | null;
};

type PortalSettings = Record<string, unknown> | null | undefined;

type RefreshSettingsShape = {
  cadence?: unknown;
  hour_utc?: unknown;
};

export type PortalRefreshTarget = {
  id: string;
  slug: string;
  settings: PortalSettings;
};

export type SkippedPortalRefreshTarget = {
  id: string;
  slug: string;
  cadence: InterestChannelRefreshCadence;
  hour_utc: number | null;
  reason: "disabled" | "outside_daily_window";
};

const DEFAULT_DAILY_HOUR_UTC = 0;

function parseHourUtc(value: unknown): number | null {
  const numeric = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim().length > 0
      ? Number(value)
      : null;

  if (numeric === null || !Number.isInteger(numeric) || numeric < 0 || numeric > 23) {
    return null;
  }

  return numeric;
}

function normalizeCadence(value: unknown): InterestChannelRefreshCadence {
  if (value === "hourly" || value === "daily" || value === "disabled") {
    return value;
  }
  return "hourly";
}

export function resolveInterestChannelRefreshConfig(
  portalSettings: PortalSettings,
): InterestChannelRefreshConfig {
  const raw = portalSettings?.interest_channel_matches_refresh;

  if (typeof raw === "string") {
    return {
      cadence: normalizeCadence(raw),
      hourUtc: null,
    };
  }

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const typedRaw = raw as RefreshSettingsShape;
    const cadence = normalizeCadence(typedRaw.cadence);
    const parsedHour = parseHourUtc(typedRaw.hour_utc);

    return {
      cadence,
      hourUtc: cadence === "daily" ? parsedHour ?? DEFAULT_DAILY_HOUR_UTC : null,
    };
  }

  return {
    cadence: "hourly",
    hourUtc: null,
  };
}

export function shouldRunInterestChannelRefreshAt(
  config: InterestChannelRefreshConfig,
  now: Date,
): boolean {
  if (config.cadence === "disabled") return false;
  if (config.cadence === "hourly") return true;

  const hourUtc = config.hourUtc ?? DEFAULT_DAILY_HOUR_UTC;
  return now.getUTCHours() === hourUtc;
}

export function filterPortalsByInterestChannelRefreshCadence<T extends PortalRefreshTarget>(
  portals: T[],
  now: Date = new Date(),
): {
  eligible: T[];
  skipped: SkippedPortalRefreshTarget[];
} {
  const eligible: T[] = [];
  const skipped: SkippedPortalRefreshTarget[] = [];

  for (const portal of portals) {
    const config = resolveInterestChannelRefreshConfig(portal.settings);
    if (shouldRunInterestChannelRefreshAt(config, now)) {
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
