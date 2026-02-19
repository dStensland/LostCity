/*
  Simple API latency audit for launch readiness.
  Usage:
    BASE_URL=http://localhost:3000 npx tsx scripts/perf-audit.ts
*/

import fs from "node:fs";

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const outputPath = process.env.PERF_AUDIT_OUTPUT;
const requestTimeoutMs = Number.parseInt(
  process.env.PERF_AUDIT_TIMEOUT_MS || "10000",
  10,
);
const maxColdMs = process.env.PERF_MAX_COLD_MS
  ? Number.parseFloat(process.env.PERF_MAX_COLD_MS)
  : null;
const maxWarmMs = process.env.PERF_MAX_WARM_MS
  ? Number.parseFloat(process.env.PERF_MAX_WARM_MS)
  : null;
const require2xx = process.env.PERF_REQUIRE_2XX !== "false";

type EndpointCase = {
  name: string;
  path: string;
};

const endpointCases: EndpointCase[] = [
  { name: "search_instant", path: "/api/search/instant?q=music&portal=atlanta" },
  { name: "portal_feed", path: "/api/portals/atlanta/feed" },
  { name: "showtimes", path: "/api/showtimes?portal=atlanta" },
  { name: "happening_now", path: "/api/portals/atlanta/happening-now" },
  { name: "trending", path: "/api/trending?portal=atlanta" },
  { name: "classes", path: "/api/classes?portal=atlanta" },
  { name: "specials", path: "/api/specials?lat=33.7488&lng=-84.3877&radius_km=5" },
  { name: "around_me", path: "/api/around-me?portal=atlanta&lat=33.7488&lng=-84.3877&limit=60&radius=8" },
  { name: "spots", path: "/api/spots?portal=atlanta&center_lat=33.7488&center_lng=-84.3877&radius_km=6&limit=300" },
  { name: "tonight", path: "/api/tonight?portal=atlanta" },
];

type Result = {
  name: string;
  status: number;
  coldMs: number;
  warmMs: number;
  payloadBytes: number;
};

function nowMs(): number {
  return performance.now();
}

async function timedFetch(url: string): Promise<{ status: number; ms: number; bytes: number }> {
  const start = nowMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text();
    const ms = nowMs() - start;
    return {
      status: response.status,
      ms,
      bytes: Buffer.byteLength(text),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function formatMs(ms: number): string {
  return `${ms.toFixed(1)} ms`;
}

function renderMarkdown(results: Result[]): string {
  const lines: string[] = [];
  lines.push(`# Performance Audit (${new Date().toISOString()})`);
  lines.push("");
  lines.push(`Base URL: ${baseUrl}`);
  lines.push("");
  lines.push("| Endpoint | Status | Cold | Warm | Delta | Payload |",
  );
  lines.push("|---|---:|---:|---:|---:|---:|");

  for (const result of results) {
    const delta = result.coldMs - result.warmMs;
    lines.push(
      `| ${result.name} | ${result.status} | ${formatMs(result.coldMs)} | ${formatMs(result.warmMs)} | ${formatMs(delta)} | ${(result.payloadBytes / 1024).toFixed(1)} KB |`
    );
  }

  const slowCold = results.filter((r) => r.coldMs > 1500);
  lines.push("");
  lines.push("## Flags");
  if (slowCold.length === 0) {
    lines.push("- No cold-path endpoints above 1.5s in this run.");
  } else {
    for (const row of slowCold) {
      lines.push(`- ${row.name}: cold ${formatMs(row.coldMs)} (target < 1500 ms)`);
    }
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  const results: Result[] = [];

  for (const endpointCase of endpointCases) {
    const url = `${baseUrl}${endpointCase.path}`;
    const cold = await timedFetch(url);
    const warm = await timedFetch(url);

    results.push({
      name: endpointCase.name,
      status: warm.status,
      coldMs: cold.ms,
      warmMs: warm.ms,
      payloadBytes: warm.bytes,
    });
  }

  const report = renderMarkdown(results);
  console.log(report);

  const gateFailures: string[] = [];
  if (require2xx) {
    for (const row of results) {
      if (row.status < 200 || row.status >= 300) {
        gateFailures.push(`${row.name} status ${row.status} is non-2xx`);
      }
    }
  }
  if (maxColdMs !== null) {
    for (const row of results) {
      if (row.coldMs > maxColdMs) {
        gateFailures.push(
          `${row.name} cold ${row.coldMs.toFixed(1)}ms > ${maxColdMs.toFixed(1)}ms`,
        );
      }
    }
  }
  if (maxWarmMs !== null) {
    for (const row of results) {
      if (row.warmMs > maxWarmMs) {
        gateFailures.push(
          `${row.name} warm ${row.warmMs.toFixed(1)}ms > ${maxWarmMs.toFixed(1)}ms`,
        );
      }
    }
  }

  if (outputPath) {
    fs.writeFileSync(outputPath, report, "utf8");
    console.log(`\nWrote report to ${outputPath}`);
  }

  if (gateFailures.length > 0) {
    console.error("\nPerformance gate failed:");
    for (const failure of gateFailures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Performance audit failed:", error);
  process.exit(1);
});
