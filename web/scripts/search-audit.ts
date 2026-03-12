/*
  Search quality audit for autocomplete.

  Usage:
    BASE_URL=http://127.0.0.1:3000 npx tsx scripts/search-audit.ts
*/

import fs from "node:fs";

const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);
const requestTimeoutMs = Number.parseInt(
  process.env.SEARCH_AUDIT_TIMEOUT_MS || "5000",
  10,
);
const maxAttempts = Number.parseInt(
  process.env.SEARCH_AUDIT_MAX_ATTEMPTS || "3",
  10,
);
const retryDelayMs = Number.parseInt(
  process.env.SEARCH_AUDIT_RETRY_DELAY_MS || "750",
  10,
);
const warmupRequests = Number.parseInt(
  process.env.SEARCH_AUDIT_WARMUP_REQUESTS || "1",
  10,
);
const maxLatencyMs = process.env.SEARCH_AUDIT_MAX_LATENCY_MS
  ? Number.parseFloat(process.env.SEARCH_AUDIT_MAX_LATENCY_MS)
  : null;
const require2xx = process.env.SEARCH_AUDIT_REQUIRE_2XX !== "false";
const outputPath = process.env.SEARCH_AUDIT_OUTPUT;

type Suggestion = {
  title: string;
  type: string;
  subtitle?: string;
};

type AuditCase = {
  name: string;
  path: string;
  expectations: Array<(suggestions: Suggestion[]) => string | null>;
};

const auditCases: AuditCase[] = [
  {
    name: "l5p_alias",
    path: "/api/search/instant?q=l5p&portal=atlanta&findType=events&limit=5",
    expectations: [
      (suggestions) =>
        suggestions.length > 0 &&
        /little five points/i.test(suggestions[0]?.title || "")
          ? null
          : "Expected top suggestion to canonicalize `l5p` to Little Five Points",
    ],
  },
  {
    name: "o4w_alias",
    path: "/api/search/instant?q=o4w&portal=atlanta&findType=events&limit=5",
    expectations: [
      (suggestions) =>
        suggestions.length > 0 &&
        /old fourth ward/i.test(suggestions[0]?.title || "")
          ? null
          : "Expected top suggestion to canonicalize `o4w` to Old Fourth Ward",
    ],
  },
  {
    name: "event_intent_live_music_tonight",
    path: "/api/search/instant?q=live%20music%20tonight&portal=atlanta&findType=events&limit=5",
    expectations: [
      (suggestions) =>
        suggestions[0]?.type === "event"
          ? null
          : "Expected first `live music tonight` suggestion to be an event CTA/result",
      (suggestions) =>
        suggestions.slice(0, 5).every((suggestion) => suggestion.type === "event")
          ? null
          : "Expected top `live music tonight` suggestions to stay event-focused",
    ],
  },
  {
    name: "classes_pottery",
    path: "/api/search/instant?q=pottery&portal=atlanta&findType=classes&limit=5",
    expectations: [
      (suggestions) =>
        suggestions.some(
          (suggestion) =>
            suggestion.type === "event" && /pottery/i.test(suggestion.title),
        )
          ? null
          : "Expected classes search for `pottery` to include a pottery class/program result",
    ],
  },
  {
    name: "destination_callanwolde",
    path: "/api/search/instant?q=callanwolde&portal=atlanta&findType=destinations&limit=5",
    expectations: [
      (suggestions) =>
        suggestions.some(
          (suggestion) =>
            suggestion.type === "venue" && /callanwolde/i.test(suggestion.title),
        )
          ? null
          : "Expected destinations search for `callanwolde` to include the venue",
    ],
  },
];

type AuditResult = {
  name: string;
  ok: boolean;
  status?: number;
  latencyMs?: number;
  attempts: number;
  failures: string[];
  suggestions: Suggestion[];
  notes: string[];
};

function nowMs(): number {
  return performance.now();
}

async function fetchJson(path: string): Promise<{
  status: number;
  latencyMs: number;
  json: unknown;
}> {
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
    const json = await response.json();
    return {
      status: response.status,
      latencyMs: nowMs() - start,
      json,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSuggestions(payload: unknown): Suggestion[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const rawSuggestions = (payload as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(rawSuggestions)) {
    return [];
  }

  return rawSuggestions
    .filter(
      (suggestion): suggestion is { title?: unknown; type?: unknown; subtitle?: unknown } =>
        Boolean(suggestion && typeof suggestion === "object"),
    )
    .map((suggestion) => ({
      title: typeof suggestion.title === "string" ? suggestion.title : "",
      type: typeof suggestion.type === "string" ? suggestion.type : "",
      subtitle:
        typeof suggestion.subtitle === "string" ? suggestion.subtitle : undefined,
    }));
}

type AttemptOutcome = {
  ok: boolean;
  status?: number;
  latencyMs?: number;
  failures: string[];
  suggestions: Suggestion[];
};

async function warmCase(path: string): Promise<void> {
  for (let index = 0; index < warmupRequests; index += 1) {
    try {
      await fetchJson(path);
    } catch {
      // Warmup failures are tolerated so the real attempts can still run.
    }
  }
}

async function runAttempt(auditCase: AuditCase): Promise<AttemptOutcome> {
  const response = await fetchJson(auditCase.path);
  const suggestions = normalizeSuggestions(response.json);
  const failures: string[] = [];

  if (require2xx && (response.status < 200 || response.status >= 300)) {
    failures.push(`Expected 2xx response, got ${response.status}`);
  }

  if (maxLatencyMs !== null && response.latencyMs > maxLatencyMs) {
    failures.push(
      `Expected latency <= ${maxLatencyMs.toFixed(1)} ms, got ${response.latencyMs.toFixed(1)} ms`,
    );
  }

  for (const check of auditCase.expectations) {
    const failure = check(suggestions);
    if (failure) failures.push(failure);
  }

  return {
    ok: failures.length === 0,
    status: response.status,
    latencyMs: response.latencyMs,
    failures,
    suggestions,
  };
}

function renderReport(results: AuditResult[]): string {
  const lines: string[] = [];
  lines.push(`# Search Audit (${new Date().toISOString()})`);
  lines.push("");
  lines.push(`Base URL: ${baseUrl}`);
  lines.push(`Attempts per case: ${maxAttempts}`);
  lines.push(`Warmup requests per case: ${warmupRequests}`);
  lines.push(`Timeout: ${requestTimeoutMs} ms`);
  if (maxLatencyMs !== null) {
    lines.push(`Latency gate: <= ${maxLatencyMs.toFixed(1)} ms`);
  }
  lines.push("");

  for (const result of results) {
    lines.push(`## ${result.name}`);
    lines.push(`- Status: ${result.status ?? "error"}`);
    lines.push(`- Latency: ${result.latencyMs?.toFixed(1) ?? "n/a"} ms`);
    lines.push(`- Attempts: ${result.attempts}`);
    lines.push(`- Outcome: ${result.ok ? "PASS" : "FAIL"}`);
    for (const note of result.notes) {
      lines.push(`- Note: ${note}`);
    }
    if (result.failures.length > 0) {
      for (const failure of result.failures) {
        lines.push(`- Failure: ${failure}`);
      }
    }
    if (result.suggestions.length === 0) {
      lines.push("- Suggestions: none");
    } else {
      for (const suggestion of result.suggestions.slice(0, 5)) {
        lines.push(
          `- Suggestion: ${suggestion.title} [${suggestion.type}]${
            suggestion.subtitle ? ` — ${suggestion.subtitle}` : ""
          }`,
        );
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  const results: AuditResult[] = [];

  for (const auditCase of auditCases) {
    await warmCase(auditCase.path);

    let bestAttempt: AttemptOutcome | null = null;
    let attemptsRun = 0;
    const notes: string[] = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      attemptsRun = attempt;
      try {
        const outcome = await runAttempt(auditCase);
        if (
          bestAttempt === null ||
          (outcome.ok && !bestAttempt.ok) ||
          (outcome.ok === bestAttempt.ok &&
            (outcome.failures.length < bestAttempt.failures.length ||
              ((outcome.failures.length === bestAttempt.failures.length) &&
                (outcome.latencyMs ?? Number.POSITIVE_INFINITY) <
                  (bestAttempt.latencyMs ?? Number.POSITIVE_INFINITY))))
        ) {
          bestAttempt = outcome;
        }

        if (outcome.ok) {
          if (attempt > 1) {
            notes.push(`Passed after retry ${attempt - 1}`);
          }
          break;
        }

        if (attempt < maxAttempts) {
          notes.push(
            `Attempt ${attempt} failed${outcome.status ? ` with ${outcome.status}` : ""}; retrying`,
          );
          await sleep(retryDelayMs);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown search audit failure";
        const outcome: AttemptOutcome = {
          ok: false,
          failures: [message],
          suggestions: [],
        };

        if (
          bestAttempt === null ||
          bestAttempt.ok ||
          bestAttempt.failures.length > outcome.failures.length
        ) {
          bestAttempt = outcome;
        }

        if (attempt < maxAttempts) {
          notes.push(`Attempt ${attempt} errored; retrying`);
          await sleep(retryDelayMs);
        }
      }
    }

    if (bestAttempt === null) {
      bestAttempt = {
        ok: false,
        failures: ["Audit case did not execute"],
        suggestions: [],
      };
    }

    try {
      results.push({
        name: auditCase.name,
        ok: bestAttempt.ok,
        status: bestAttempt.status,
        latencyMs: bestAttempt.latencyMs,
        attempts: attemptsRun,
        failures: bestAttempt.failures,
        suggestions: bestAttempt.suggestions,
        notes,
      });
    } catch (error) {
      results.push({
        name: auditCase.name,
        ok: false,
        attempts: attemptsRun,
        failures: [
          error instanceof Error ? error.message : "Unknown search audit failure",
        ],
        suggestions: [],
        notes,
      });
    }
  }

  const report = renderReport(results);
  console.log(report);

  if (outputPath) {
    fs.writeFileSync(outputPath, report, "utf8");
    console.log(`\nWrote report to ${outputPath}`);
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    console.error("\nSearch audit failed:");
    for (const result of failed) {
      console.error(`- ${result.name}`);
      for (const failure of result.failures) {
        console.error(`  ${failure}`);
      }
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Search audit failed:", error);
  process.exit(1);
});
