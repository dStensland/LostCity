import { inferCivicIntent, INTENT_CONFIG } from "../civic-intent";

describe("inferCivicIntent", () => {
  it("returns 'volunteer' for volunteer-tagged events", () => {
    expect(inferCivicIntent(["volunteer", "food"])).toBe("volunteer");
    expect(inferCivicIntent(["volunteer-opportunity"])).toBe("volunteer");
    expect(inferCivicIntent(["drop-in"])).toBe("volunteer");
  });

  it("returns 'meeting' for government-tagged events", () => {
    expect(inferCivicIntent(["government", "city-council"])).toBe("meeting");
    expect(inferCivicIntent(["school-board"])).toBe("meeting");
    expect(inferCivicIntent(["zoning", "public-meeting"])).toBe("meeting");
  });

  it("returns 'action' for advocacy-tagged events", () => {
    expect(inferCivicIntent(["advocacy", "rally"])).toBe("action");
    expect(inferCivicIntent(["canvassing"])).toBe("action");
    expect(inferCivicIntent(["organizing", "civic-engagement"])).toBe("action");
  });

  it("returns 'event' as fallback", () => {
    expect(inferCivicIntent(["food", "charity"])).toBe("event");
    expect(inferCivicIntent([])).toBe("event");
  });

  it("prefers meeting > action > volunteer when multiple match", () => {
    expect(inferCivicIntent(["volunteer", "government"])).toBe("meeting");
    expect(inferCivicIntent(["volunteer", "advocacy"])).toBe("action");
    expect(inferCivicIntent(["advocacy", "government"])).toBe("meeting");
  });

  it("exports badge config for each intent", () => {
    expect(INTENT_CONFIG.volunteer.label).toBe("Volunteer");
    expect(INTENT_CONFIG.meeting.label).toBe("Meeting");
    expect(INTENT_CONFIG.action.label).toBe("Action");
    expect(INTENT_CONFIG.event.label).toBe("Event");
  });
});
