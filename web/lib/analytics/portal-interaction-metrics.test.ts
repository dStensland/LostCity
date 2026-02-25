import { describe, expect, it } from "vitest";
import type { PortalInteractionRow } from "@/lib/analytics/portal-interaction-metrics";
import { summarizeInteractionRows } from "@/lib/analytics/portal-interaction-metrics";

function row(overrides: Partial<PortalInteractionRow>): PortalInteractionRow {
  return {
    portal_id: "portal-1",
    action_type: "resource_clicked",
    mode_context: null,
    section_key: "event_cards",
    target_kind: "event",
    metadata: null,
    created_at: "2026-02-19T20:00:00.000Z",
    ...overrides,
  };
}

describe("portal interaction metrics", () => {
  it("does not count reason-chip impressions as resource clicks", () => {
    const summary = summarizeInteractionRows(
      [
        row({
          section_key: "concierge_reason_chip_impression",
          metadata: { reason_chip_present: true, reason_chip_count: 2 },
        }),
        row({
          section_key: "event_cards",
          metadata: { reason_chip_present: true, reason_chip_count: 2 },
        }),
        row({
          section_key: "event_cards",
          metadata: null,
        }),
      ],
      10,
    );

    expect(summary.resource_clicked).toBe(2);
    expect(summary.reason_chip_impressions).toBe(1);
    expect(summary.reason_chip_influenced_clicks).toBe(1);
    expect(summary.reason_chip_influenced_click_rate).toBe(50);
    expect(summary.reason_chip_impression_click_through_rate).toBe(100);
  });

  it("tracks quick-add attempts, outcomes, and storage mix", () => {
    const summary = summarizeInteractionRows(
      [
        row({
          section_key: "best_bet_quick_add",
          target_kind: "itinerary_quick_add",
          metadata: { outcome: "attempt" },
        }),
        row({
          section_key: "event_card_quick_add:compact",
          target_kind: "itinerary_quick_add",
          metadata: { outcome: "success", storage: "remote" },
        }),
        row({
          section_key: "event_card_quick_add:featured",
          target_kind: "itinerary_quick_add",
          metadata: { outcome: "success", storage: "local" },
        }),
        row({
          section_key: "event_card_quick_add:compact",
          target_kind: "itinerary_quick_add",
          metadata: { outcome: "error" },
        }),
      ],
      20,
    );

    expect(summary.quick_add_attempts).toBe(3);
    expect(summary.quick_add_successes).toBe(2);
    expect(summary.quick_add_failures).toBe(1);
    expect(summary.quick_add_success_rate).toBe(66.67);
    expect(summary.quick_add_by_storage).toEqual([
      { storage: "local", count: 1 },
      { storage: "remote", count: 1 },
    ]);
  });
});
