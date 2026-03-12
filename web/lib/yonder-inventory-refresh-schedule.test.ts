import { describe, expect, it } from "vitest";
import {
  filterPortalsByYonderInventoryRefreshCadence,
  resolveYonderInventoryRefreshConfig,
  shouldRunYonderInventoryRefreshAt,
} from "./yonder-inventory-refresh-schedule";

describe("yonder-inventory-refresh-schedule", () => {
  it("defaults to daily cadence at 11 UTC when config is missing", () => {
    const config = resolveYonderInventoryRefreshConfig(null);
    expect(config).toEqual({
      cadence: "daily",
      hourUtc: 11,
      source: "default",
    });
  });

  it("prefers explicit yonder inventory refresh config", () => {
    const config = resolveYonderInventoryRefreshConfig({
      yonder_inventory_refresh: {
        cadence: "daily",
        hour_utc: 9,
      },
      interest_channel_matches_refresh: {
        cadence: "hourly",
      },
    });

    expect(config).toEqual({
      cadence: "daily",
      hourUtc: 9,
      source: "yonder_inventory_refresh",
    });
  });

  it("falls back to portal refresh cadence when dedicated config is missing", () => {
    const config = resolveYonderInventoryRefreshConfig({
      interest_channel_matches_refresh: {
        cadence: "daily",
        hour_utc: 8,
      },
    });

    expect(config).toEqual({
      cadence: "daily",
      hourUtc: 8,
      source: "interest_channel_matches_refresh",
    });
  });

  it("runs daily cadence at configured hour", () => {
    const config = resolveYonderInventoryRefreshConfig({
      yonder_inventory_refresh: {
        cadence: "daily",
        hour_utc: 10,
      },
    });

    expect(shouldRunYonderInventoryRefreshAt(config, new Date("2026-03-11T10:15:00.000Z"))).toBe(
      true,
    );
    expect(shouldRunYonderInventoryRefreshAt(config, new Date("2026-03-11T11:15:00.000Z"))).toBe(
      false,
    );
  });

  it("filters disabled and out-of-window portals", () => {
    const now = new Date("2026-03-11T11:15:00.000Z");
    const portals = [
      {
        id: "1",
        slug: "yonder",
        settings: {
          yonder_inventory_refresh: {
            cadence: "daily",
            hour_utc: 11,
          },
        },
      },
      {
        id: "2",
        slug: "skip-window",
        settings: {
          yonder_inventory_refresh: {
            cadence: "daily",
            hour_utc: 10,
          },
        },
      },
      {
        id: "3",
        slug: "disabled",
        settings: {
          yonder_inventory_refresh: {
            cadence: "disabled",
          },
        },
      },
    ];

    const result = filterPortalsByYonderInventoryRefreshCadence(portals, now);
    expect(result.eligible.map((portal) => portal.slug)).toEqual(["yonder"]);
    expect(result.skipped).toEqual([
      {
        id: "2",
        slug: "skip-window",
        cadence: "daily",
        hour_utc: 10,
        reason: "outside_daily_window",
      },
      {
        id: "3",
        slug: "disabled",
        cadence: "disabled",
        hour_utc: null,
        reason: "disabled",
      },
    ]);
  });
});
