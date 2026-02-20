import { describe, expect, it } from "vitest";
import { deriveSessionEngagementContext } from "@/lib/session-engagement";

describe("deriveSessionEngagementContext", () => {
  it("classifies festival program series as festival session engagement", () => {
    const context = deriveSessionEngagementContext({
      id: "9de3cf39-b497-4f27-bf75-bf374affac89",
      series_type: "festival_program",
      festival_id: "dragon-con",
    });

    expect(context).toEqual({
      engagement_target: "festival_session",
      festival_id: "dragon-con",
      program_id: "9de3cf39-b497-4f27-bf75-bf374affac89",
    });
  });

  it("falls back to event engagement for non-festival series", () => {
    const context = deriveSessionEngagementContext({
      id: "e53d67cf-88ce-4f9b-8859-47f2d261f35d",
      series_type: "recurring_show",
      festival_id: null,
    });

    expect(context).toEqual({
      engagement_target: "event",
      festival_id: null,
      program_id: null,
    });
  });

  it("falls back to event engagement when festival metadata is missing", () => {
    const context = deriveSessionEngagementContext({
      id: "fdad858f-7d73-486f-89f8-4f150f8b4a92",
      series_type: "festival_program",
      festival_id: null,
    });

    expect(context).toEqual({
      engagement_target: "event",
      festival_id: null,
      program_id: null,
    });
  });
});
