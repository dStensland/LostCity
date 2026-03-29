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

  // Tab → lane mapping
  it("redirects ?tab=eat-drink to ?view=find&lane=dining", () => {
    const result = normalizeFinURLParams(new URLSearchParams("tab=eat-drink"));
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("dining");
    expect(result.has("tab")).toBe(false);
  });

  it("redirects ?tab=things-to-do to ?view=find&lane=entertainment", () => {
    const result = normalizeFinURLParams(new URLSearchParams("tab=things-to-do"));
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("entertainment");
    expect(result.has("tab")).toBe(false);
  });

  it("redirects ?tab=nightlife to ?view=find&lane=nightlife", () => {
    const result = normalizeFinURLParams(new URLSearchParams("tab=nightlife"));
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("nightlife");
    expect(result.has("tab")).toBe(false);
  });

  // Content → lane/mode mapping
  it("redirects ?content=showtimes to ?view=find&lane=music", () => {
    const result = normalizeFinURLParams(new URLSearchParams("content=showtimes"));
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("music");
    expect(result.has("content")).toBe(false);
  });

  it("redirects ?content=regulars to ?view=find&regulars=true", () => {
    const result = normalizeFinURLParams(new URLSearchParams("content=regulars"));
    expect(result.get("view")).toBe("find");
    expect(result.get("regulars")).toBe("true");
    expect(result.has("content")).toBe(false);
  });

  // Type → lane mapping
  it("redirects ?type=showtimes to lane=music when view resolves to find", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=happening&type=showtimes"));
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("music");
  });

  it("redirects ?type=destinations to lane=outdoors when view resolves to find", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=places&type=destinations"));
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("outdoors");
  });

  // Filter preservation
  it("preserves filter params through redirects", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=happening&venue_type=restaurant&neighborhoods=Midtown"));
    expect(result.get("view")).toBe("find");
    expect(result.get("venue_type")).toBe("restaurant");
    expect(result.get("neighborhoods")).toBe("Midtown");
  });

  // No-ops
  it("does not modify ?view=find", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=find&lane=arts"));
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("arts");
  });

  it("does not modify ?view=feed", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=feed"));
    expect(result.get("view")).toBe("feed");
  });

  it("does not modify ?view=community", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=community"));
    expect(result.get("view")).toBe("community");
  });
});
