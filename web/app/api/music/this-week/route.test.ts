import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/music/this-week", () => {
  it("requires portal query param", async () => {
    const req = new Request("http://localhost/api/music/this-week");
    const res = await GET(req as never);
    expect(res.status).toBe(400);
  });

  it("returns an empty shows array when no music events match", async () => {
    const req = new Request(
      "http://localhost/api/music/this-week?portal=nonexistent-portal-slug",
    );
    const res = await GET(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ shows: [] });
  });

  it("caps at 3 shows even when more signals match", async () => {
    const req = new Request(
      "http://localhost/api/music/this-week?portal=atlanta",
    );
    const res = await GET(req as never);
    const body = await res.json();
    expect(Array.isArray(body.shows)).toBe(true);
    expect(body.shows.length).toBeLessThanOrEqual(3);
  });
});
