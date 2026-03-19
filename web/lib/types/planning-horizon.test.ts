import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getPlanningUrgency,
  ticketStatusFreshness,
  isTicketStatusStale,
  isJustOnSale,
} from "./planning-horizon";

// Fixed reference time: 2026-03-17T12:00:00.000Z (noon UTC)
const FIXED_NOW = new Date("2026-03-17T12:00:00.000Z");

// Helpers to produce ISO timestamps relative to FIXED_NOW
function hoursAgo(hours: number): string {
  return new Date(FIXED_NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function daysFromNow(days: number): string {
  return new Date(FIXED_NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function daysAgo(days: number): string {
  return daysFromNow(-days);
}

describe("planning-horizon utilities", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // getPlanningUrgency
  // ---------------------------------------------------------------------------

  describe("getPlanningUrgency", () => {
    it("returns cancelled when ticket_status is cancelled", () => {
      const result = getPlanningUrgency({
        ticket_status: "cancelled",
        sellout_risk: null,
        on_sale_date: null,
        early_bird_deadline: null,
        registration_closes: null,
      });
      expect(result).not.toBeNull();
      expect(result!.type).toBe("cancelled");
    });

    it("returns sold_out when ticket_status is sold-out", () => {
      const result = getPlanningUrgency({
        ticket_status: "sold-out",
        sellout_risk: null,
        on_sale_date: null,
        early_bird_deadline: null,
        registration_closes: null,
      });
      expect(result).not.toBeNull();
      expect(result!.type).toBe("sold_out");
    });

    it("returns selling_fast when ticket_status is low-tickets", () => {
      const result = getPlanningUrgency({
        ticket_status: "low-tickets",
        sellout_risk: null,
        on_sale_date: null,
        early_bird_deadline: null,
        registration_closes: null,
      });
      expect(result).not.toBeNull();
      expect(result!.type).toBe("selling_fast");
    });

    it("returns selling_fast when sellout_risk is high (no ticket_status)", () => {
      const result = getPlanningUrgency({
        ticket_status: null,
        sellout_risk: "high",
        on_sale_date: null,
        early_bird_deadline: null,
        registration_closes: null,
      });
      expect(result).not.toBeNull();
      expect(result!.type).toBe("selling_fast");
    });

    it("returns early_bird_ending with correct daysLeft when deadline is 3 days away", () => {
      const result = getPlanningUrgency({
        ticket_status: null,
        sellout_risk: null,
        on_sale_date: null,
        early_bird_deadline: daysFromNow(3),
        registration_closes: null,
      });
      expect(result).not.toBeNull();
      expect(result!.type).toBe("early_bird_ending");
      if (result!.type === "early_bird_ending") {
        expect(result.daysLeft).toBe(3);
      }
    });

    it("returns registration_closing with correct daysLeft when closes in 2 days", () => {
      const result = getPlanningUrgency({
        ticket_status: null,
        sellout_risk: null,
        on_sale_date: null,
        early_bird_deadline: null,
        registration_closes: daysFromNow(2),
      });
      expect(result).not.toBeNull();
      expect(result!.type).toBe("registration_closing");
      if (result!.type === "registration_closing") {
        expect(result.daysLeft).toBe(2);
      }
    });

    it("returns just_on_sale when on_sale_date is today", () => {
      const result = getPlanningUrgency({
        ticket_status: null,
        sellout_risk: null,
        on_sale_date: daysFromNow(0),
        early_bird_deadline: null,
        registration_closes: null,
      });
      expect(result).not.toBeNull();
      expect(result!.type).toBe("just_on_sale");
    });

    it("returns null when all fields are null", () => {
      const result = getPlanningUrgency({
        ticket_status: null,
        sellout_risk: null,
        on_sale_date: null,
        early_bird_deadline: null,
        registration_closes: null,
      });
      expect(result).toBeNull();
    });

    it("sold-out takes priority over early_bird_ending when both are set", () => {
      const result = getPlanningUrgency({
        ticket_status: "sold-out",
        sellout_risk: null,
        on_sale_date: null,
        early_bird_deadline: daysFromNow(3),
        registration_closes: null,
      });
      expect(result).not.toBeNull();
      expect(result!.type).toBe("sold_out");
    });

    it("does not return early_bird_ending when deadline is in the past", () => {
      const result = getPlanningUrgency({
        ticket_status: null,
        sellout_risk: null,
        on_sale_date: null,
        early_bird_deadline: daysAgo(1),
        registration_closes: null,
      });
      // Past deadline should not trigger early_bird_ending
      expect(result).toBeNull();
    });

    it("does not return early_bird_ending when deadline is more than 7 days away", () => {
      const result = getPlanningUrgency({
        ticket_status: null,
        sellout_risk: null,
        on_sale_date: null,
        early_bird_deadline: daysFromNow(8),
        registration_closes: null,
      });
      expect(result).toBeNull();
    });

    it("does not return registration_closing when closes in the past", () => {
      const result = getPlanningUrgency({
        ticket_status: null,
        sellout_risk: null,
        on_sale_date: null,
        early_bird_deadline: null,
        registration_closes: daysAgo(1),
      });
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // ticketStatusFreshness
  // ---------------------------------------------------------------------------

  describe("ticketStatusFreshness", () => {
    it("returns null for null input", () => {
      expect(ticketStatusFreshness(null)).toBeNull();
    });

    it("returns 'just checked' for a timestamp 30 minutes ago", () => {
      expect(ticketStatusFreshness(hoursAgo(0.5))).toBe("just checked");
    });

    it("returns 'as of 1 hour ago' for a timestamp 1.5 hours ago", () => {
      expect(ticketStatusFreshness(hoursAgo(1.5))).toBe("as of 1 hour ago");
    });

    it("returns 'as of N hours ago' for a timestamp 5 hours ago", () => {
      expect(ticketStatusFreshness(hoursAgo(5))).toBe("as of 5 hours ago");
    });

    it("returns 'as of yesterday' for a timestamp 25 hours ago", () => {
      expect(ticketStatusFreshness(hoursAgo(25))).toBe("as of yesterday");
    });

    it("returns 'as of N days ago' for a timestamp 72 hours ago", () => {
      expect(ticketStatusFreshness(hoursAgo(72))).toBe("as of 3 days ago");
    });
  });

  // ---------------------------------------------------------------------------
  // isTicketStatusStale
  // ---------------------------------------------------------------------------

  describe("isTicketStatusStale", () => {
    it("returns false when ticket_status is null", () => {
      expect(
        isTicketStatusStale({
          ticket_status: null,
          ticket_status_checked_at: hoursAgo(30),
        })
      ).toBe(false);
    });

    it("returns false when ticket_status_checked_at is null", () => {
      expect(
        isTicketStatusStale({
          ticket_status: "low-tickets",
          ticket_status_checked_at: null,
        })
      ).toBe(false);
    });

    it("returns false when checked 2 hours ago (not stale)", () => {
      expect(
        isTicketStatusStale({
          ticket_status: "low-tickets",
          ticket_status_checked_at: hoursAgo(2),
        })
      ).toBe(false);
    });

    it("returns true when checked 25 hours ago (stale)", () => {
      expect(
        isTicketStatusStale({
          ticket_status: "low-tickets",
          ticket_status_checked_at: hoursAgo(25),
        })
      ).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // isJustOnSale
  // ---------------------------------------------------------------------------

  describe("isJustOnSale", () => {
    it("returns true when on_sale_date is today", () => {
      expect(isJustOnSale({ on_sale_date: daysFromNow(0) })).toBe(true);
    });

    it("returns true when on_sale_date was 3 days ago (within window)", () => {
      expect(isJustOnSale({ on_sale_date: daysAgo(3) })).toBe(true);
    });

    it("returns false when on_sale_date was 4 days ago (outside window)", () => {
      expect(isJustOnSale({ on_sale_date: daysAgo(4) })).toBe(false);
    });

    it("returns false when on_sale_date is tomorrow (future)", () => {
      expect(isJustOnSale({ on_sale_date: daysFromNow(1) })).toBe(false);
    });

    it("returns false when on_sale_date is null", () => {
      expect(isJustOnSale({ on_sale_date: null })).toBe(false);
    });
  });
});
