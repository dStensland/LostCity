import { describe, expect, it } from "vitest";

const routes = [
  "/api/music/this-week",
  "/api/music/tonight",
  "/api/music/by-venue",
  "/api/music/by-show",
  "/api/music/residencies",
  "/api/music/festivals-horizon",
  "/api/music/on-sale",
];

// Integration tests require `npm run dev` on :3000. Opt-in via MUSIC_INTEGRATION=1 so
// CI doesn't fail. Run locally with:
//   MUSIC_INTEGRATION=1 npx vitest run app/api/music/_integration.test.ts
const runIntegration = process.env.MUSIC_INTEGRATION === "1";

describe.skipIf(!runIntegration)(
  "Music API portal isolation (integration, live dev server)",
  () => {
    it.each(routes)("%s rejects missing portal", async (path) => {
      const res = await fetch(`http://localhost:3000${path}`);
      expect(res.status).toBe(400);
    });

    it.each(routes)("%s returns OK for a known portal", async (path) => {
      const res = await fetch(`http://localhost:3000${path}?portal=atlanta`);
      expect(res.status).toBe(200);
    });

    it.each(routes)(
      "%s returns empty collections for a nonexistent portal",
      async (path) => {
        const res = await fetch(
          `http://localhost:3000${path}?portal=nonexistent-portal-xyz`,
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        const collections = Object.values(body).filter(Array.isArray);
        expect(collections.every((c) => (c as unknown[]).length === 0)).toBe(
          true,
        );
      },
    );
  },
);
