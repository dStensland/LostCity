import { normalizeFinURLParams } from "../normalize-find-url";

describe("normalizeFinURLParams", () => {
  // Legacy view aliases → find
  it("redirects ?view=happening to ?view=find", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=happening"));
    expect(result.get("view")).toBe("find");
  });

  it("redirects ?view=places to ?view=find", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=places"));
    expect(result.get("view")).toBe("find");
  });

  it("redirects ?view=events to ?view=find", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=events"));
    expect(result.get("view")).toBe("find");
  });

  it("redirects ?view=spots to ?view=find", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=spots"));
    expect(result.get("view")).toBe("find");
  });

  // Display mode views
  it("redirects ?view=map to ?view=find&display=map", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=map"));
    expect(result.get("view")).toBe("find");
    expect(result.get("display")).toBe("map");
  });

  it("redirects ?view=calendar to ?view=find&display=calendar", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=calendar"));
    expect(result.get("view")).toBe("find");
    expect(result.get("display")).toBe("calendar");
  });

  // Tab → lane → tool redirect (full pipeline)
  it("redirects ?tab=eat-drink to ?view=places&tab=eat-drink&from=find", () => {
    const result = normalizeFinURLParams(new URLSearchParams("tab=eat-drink"));
    expect(result.get("view")).toBe("places");
    expect(result.get("tab")).toBe("eat-drink");
    expect(result.get("from")).toBe("find");
    expect(result.has("lane")).toBe(false);
  });

  it("redirects ?tab=things-to-do to ?view=places&tab=things-to-do&from=find", () => {
    const result = normalizeFinURLParams(new URLSearchParams("tab=things-to-do"));
    expect(result.get("view")).toBe("places");
    expect(result.get("tab")).toBe("things-to-do");
    expect(result.get("from")).toBe("find");
    expect(result.has("lane")).toBe(false);
  });

  it("redirects ?tab=nightlife to ?view=places&tab=nightlife&from=find", () => {
    const result = normalizeFinURLParams(new URLSearchParams("tab=nightlife"));
    expect(result.get("view")).toBe("places");
    expect(result.get("tab")).toBe("nightlife");
    expect(result.get("from")).toBe("find");
    expect(result.has("lane")).toBe(false);
  });

  // Content → lane → tool redirect (full pipeline)
  it("redirects ?content=showtimes to ?view=happening&content=showtimes&from=find", () => {
    const result = normalizeFinURLParams(new URLSearchParams("content=showtimes"));
    expect(result.get("view")).toBe("happening");
    expect(result.get("content")).toBe("showtimes");
    expect(result.get("from")).toBe("find");
    expect(result.has("lane")).toBe(false);
  });

  it("redirects ?content=regulars to ?view=find&regulars=true", () => {
    const result = normalizeFinURLParams(new URLSearchParams("content=regulars"));
    expect(result.get("view")).toBe("find");
    expect(result.get("regulars")).toBe("true");
    expect(result.has("content")).toBe(false);
  });

  // Type → lane → tool redirect (full pipeline)
  it("redirects ?view=happening&type=showtimes to ?view=happening&content=showtimes&from=find", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=happening&type=showtimes"));
    expect(result.get("view")).toBe("happening");
    expect(result.get("content")).toBe("showtimes");
    expect(result.get("from")).toBe("find");
    expect(result.has("lane")).toBe(false);
  });

  it("redirects ?view=places&type=destinations to ?view=places&tab=things-to-do&from=find", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=places&type=destinations"));
    expect(result.get("view")).toBe("places");
    expect(result.get("tab")).toBe("things-to-do");
    expect(result.get("from")).toBe("find");
    expect(result.has("lane")).toBe(false);
  });

  // Filter preservation
  it("preserves filter params through redirects", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=happening&venue_type=restaurant&neighborhoods=Midtown"));
    expect(result.get("view")).toBe("find");
    expect(result.get("venue_type")).toBe("restaurant");
    expect(result.get("neighborhoods")).toBe("Midtown");
  });

  // No-ops
  it("does not modify ?view=find without a lane", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=find"));
    expect(result.get("view")).toBe("find");
    expect(result.has("lane")).toBe(false);
  });

  it("does not modify ?view=feed", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=feed"));
    expect(result.get("view")).toBe("feed");
  });

  it("does not modify ?view=community", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=community"));
    expect(result.get("view")).toBe("community");
  });

  // Lane → tool redirects
  it("preserves from=find param through redirects", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=happening&from=find"));
    expect(result.get("from")).toBe("find");
  });

  it("does not add from param when not present", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=happening"));
    expect(result.has("from")).toBe(false);
  });

  it("redirects ?view=find&lane=dining to ?view=places&tab=eat-drink&from=find", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=find&lane=dining"));
    expect(result.get("view")).toBe("places");
    expect(result.get("tab")).toBe("eat-drink");
    expect(result.get("from")).toBe("find");
    expect(result.has("lane")).toBe(false);
  });

  it("redirects ?view=find&lane=music to ?view=happening&content=showtimes&from=find", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=find&lane=music"));
    expect(result.get("view")).toBe("happening");
    expect(result.get("content")).toBe("showtimes");
    expect(result.get("from")).toBe("find");
  });

  it("redirects ?view=find&lane=arts with venue_type filter", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=find&lane=arts"));
    expect(result.get("view")).toBe("places");
    expect(result.get("tab")).toBe("things-to-do");
    expect(result.get("venue_type")).toContain("museum");
    expect(result.get("from")).toBe("find");
  });
});
