/*
  Prewarm key public API caches to reduce cold-start latency after deploy.

  Usage:
    BASE_URL=https://your-site.com npm run perf:prewarm
*/

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";
const requestTimeoutMs = Number.parseInt(
  process.env.PERF_PREWARM_TIMEOUT_MS || "10000",
  10,
);

type PrewarmEndpoint = {
  name: string;
  path: string;
  critical?: boolean;
};

const endpoints: PrewarmEndpoint[] = [
  { name: "portal_feed", path: "/api/portals/atlanta/feed", critical: true },
  { name: "showtimes", path: "/api/showtimes?portal=atlanta", critical: true },
  { name: "happening_now", path: "/api/portals/atlanta/happening-now", critical: true },
  { name: "search_instant", path: "/api/search/instant?q=music&portal=atlanta", critical: true },
  { name: "search_instant_short", path: "/api/search/instant?q=mu&portal=atlanta" },
  { name: "trending", path: "/api/trending?portal=atlanta" },
  { name: "classes", path: "/api/classes?portal=atlanta" },
  { name: "specials", path: "/api/specials?lat=33.7488&lng=-84.3877&radius_km=5" },
  { name: "around_me", path: "/api/around-me?portal=atlanta&lat=33.7488&lng=-84.3877&limit=60" },
  { name: "spots", path: "/api/spots?portal=atlanta&center_lat=33.7488&center_lng=-84.3877&radius_km=6&limit=300" },
  { name: "tonight", path: "/api/tonight?portal=atlanta" },
  { name: "portal_specials", path: "/api/portals/atlanta/destinations/specials?lat=33.7488&lng=-84.3877" },
];

function nowMs(): number {
  return performance.now();
}

async function hit(path: string): Promise<{ status: number; ms: number }> {
  const url = `${baseUrl}${path}`;
  const start = nowMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    await response.text();
    return { status: response.status, ms: nowMs() - start };
  } finally {
    clearTimeout(timeout);
  }
}

async function main(): Promise<void> {
  console.log(`Prewarming ${endpoints.length} endpoints at ${baseUrl}`);

  const failures: string[] = [];
  for (const endpoint of endpoints) {
    try {
      const first = await hit(endpoint.path);
      const second = await hit(endpoint.path);
      console.log(
        `${endpoint.name.padEnd(20)} first=${first.status} ${first.ms.toFixed(1)}ms | second=${second.status} ${second.ms.toFixed(1)}ms`
      );
      if (endpoint.critical && (first.status >= 400 || second.status >= 400)) {
        failures.push(endpoint.name);
      }
    } catch (error) {
      console.error(`${endpoint.name} failed`, error);
      if (endpoint.critical) failures.push(endpoint.name);
    }
  }

  if (failures.length > 0) {
    console.error(`Critical prewarm failures: ${failures.join(", ")}`);
    process.exit(1);
  }

  console.log("Prewarm complete");
}

main().catch((error) => {
  console.error("Prewarm failed:", error);
  process.exit(1);
});
