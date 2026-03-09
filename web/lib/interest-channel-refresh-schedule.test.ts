import { describe, expect, it } from "vitest";
import {
  filterPortalsByInterestChannelRefreshCadence,
  resolveInterestChannelRefreshConfig,
  shouldRunInterestChannelRefreshAt,
} from "./interest-channel-refresh-schedule";

describe("interest-channel-refresh-schedule", () => {
  it("defaults to hourly cadence when config is missing", () => {
    const config = resolveInterestChannelRefreshConfig(null);
    expect(config).toEqual({
      cadence: "hourly",
      hourUtc: null,
    });
  });

  it("runs daily cadence at configured hour_utc", () => {
    const config = resolveInterestChannelRefreshConfig({
      interest_channel_matches_refresh: {
        cadence: "daily",
        hour_utc: 10,
      },
    });

    expect(shouldRunInterestChannelRefreshAt(config, new Date("2026-03-07T10:20:00.000Z"))).toBe(
      true,
    );
    expect(shouldRunInterestChannelRefreshAt(config, new Date("2026-03-07T11:20:00.000Z"))).toBe(
      false,
    );
  });

  it("defaults daily cadence hour_utc to 0 when omitted or invalid", () => {
    const missingHour = resolveInterestChannelRefreshConfig({
      interest_channel_matches_refresh: {
        cadence: "daily",
      },
    });
    const invalidHour = resolveInterestChannelRefreshConfig({
      interest_channel_matches_refresh: {
        cadence: "daily",
        hour_utc: 99,
      },
    });

    expect(missingHour).toEqual({
      cadence: "daily",
      hourUtc: 0,
    });
    expect(invalidHour).toEqual({
      cadence: "daily",
      hourUtc: 0,
    });
  });

  it("supports string shorthand cadence values", () => {
    const disabled = resolveInterestChannelRefreshConfig({
      interest_channel_matches_refresh: "disabled",
    });
    const hourly = resolveInterestChannelRefreshConfig({
      interest_channel_matches_refresh: "hourly",
    });

    expect(disabled).toEqual({
      cadence: "disabled",
      hourUtc: null,
    });
    expect(hourly).toEqual({
      cadence: "hourly",
      hourUtc: null,
    });
  });

  it("filters disabled and out-of-window portals", () => {
    const now = new Date("2026-03-07T09:20:00.000Z");
    const portals = [
      {
        id: "1",
        slug: "hourly-portal",
        settings: null,
      },
      {
        id: "2",
        slug: "daily-window-hit",
        settings: {
          interest_channel_matches_refresh: {
            cadence: "daily",
            hour_utc: 9,
          },
        },
      },
      {
        id: "3",
        slug: "daily-window-miss",
        settings: {
          interest_channel_matches_refresh: {
            cadence: "daily",
            hour_utc: 8,
          },
        },
      },
      {
        id: "4",
        slug: "disabled-portal",
        settings: {
          interest_channel_matches_refresh: {
            cadence: "disabled",
          },
        },
      },
    ];

    const result = filterPortalsByInterestChannelRefreshCadence(portals, now);

    expect(result.eligible.map((p) => p.slug)).toEqual([
      "hourly-portal",
      "daily-window-hit",
    ]);
    expect(result.skipped).toEqual([
      {
        id: "3",
        slug: "daily-window-miss",
        cadence: "daily",
        hour_utc: 8,
        reason: "outside_daily_window",
      },
      {
        id: "4",
        slug: "disabled-portal",
        cadence: "disabled",
        hour_utc: null,
        reason: "disabled",
      },
    ]);
  });
});
