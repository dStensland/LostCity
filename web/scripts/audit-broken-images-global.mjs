import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..");

const OUTPUT_DIR = path.join(WEB_ROOT, "content");
const OUTPUT_JSON = path.join(OUTPUT_DIR, "global_image_audit.json");
const OUTPUT_MD = path.join(OUTPUT_DIR, "global_image_audit.md");
const OUTPUT_BROKEN_JSON = path.join(OUTPUT_DIR, "global_broken_image_urls.json");

const CHECK_TIMEOUT_MS = 9000;
const CHECK_CONCURRENCY = 24;

function runPsql(sql) {
  const command = `
cd "${REPO_ROOT}"
set -a
source .env
set +a
psql "$DATABASE_URL" -At -F $'\\t' <<'SQL'
${sql}
SQL
`;

  const result = spawnSync("bash", ["-lc", command], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 60,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || `psql failed with code ${result.status}`);
  }
  return result.stdout;
}

function parseTsvRows(tsv) {
  const rows = [];
  for (const line of tsv.split("\n")) {
    if (!line) continue;
    const parts = line.split("\t");
    if (parts.length < 4) continue;
    rows.push({
      source_table: parts[0],
      source_column: parts[1],
      record_id: parts[2],
      url: parts.slice(3).join("\t").trim(),
    });
  }
  return rows;
}

function normalizeUrl(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return trimmed;
}

async function checkImageUrl(url) {
  if (!url) return { state: "missing", status: null, note: "empty" };

  const request = async (method) =>
    fetch(url, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      headers: method === "GET" ? { Range: "bytes=0-0" } : undefined,
    });

  try {
    const head = await request("HEAD");
    if (head.ok) return { state: "ok", status: head.status, note: "head_ok" };

    if ([401, 403, 405].includes(head.status)) {
      const getRes = await request("GET");
      if (getRes.ok) return { state: "ok", status: getRes.status, note: "get_ok_after_head_blocked" };
      if (getRes.status >= 400 && getRes.status < 500) {
        return { state: "broken", status: getRes.status, note: "get_client_error" };
      }
      return { state: "uncertain", status: getRes.status, note: "get_non_ok" };
    }

    if (head.status >= 400 && head.status < 500) {
      return { state: "broken", status: head.status, note: "head_client_error" };
    }
    return { state: "uncertain", status: head.status, note: "head_non_ok" };
  } catch (error) {
    return { state: "error", status: null, note: String(error?.name || "fetch_error") };
  }
}

async function mapLimit(items, concurrency, worker) {
  const out = new Array(items.length);
  let next = 0;

  async function runWorker() {
    while (next < items.length) {
      const idx = next++;
      out[idx] = await worker(items[idx], idx);
      if ((idx + 1) % 250 === 0) {
        console.log(`Checked ${idx + 1}/${items.length} URLs...`);
      }
    }
  }

  const workers = [];
  for (let i = 0; i < Math.min(concurrency, items.length); i += 1) {
    workers.push(runWorker());
  }
  await Promise.all(workers);
  return out;
}

function isFailState(state) {
  return state !== "ok";
}

function summarizeBySource(refRows, statusByUrl) {
  const map = new Map();

  for (const row of refRows) {
    const key = `${row.source_table}.${row.source_column}`;
    const entry =
      map.get(key) ??
      {
        source_table: row.source_table,
        source_column: row.source_column,
        total_refs: 0,
        unique_urls: new Set(),
        failing_refs: 0,
        failing_unique_urls: new Set(),
        states: { ok: 0, broken: 0, uncertain: 0, error: 0, missing: 0 },
      };

    entry.total_refs += 1;
    entry.unique_urls.add(row.url);
    const state = statusByUrl.get(row.url)?.state ?? "error";
    entry.states[state] = (entry.states[state] ?? 0) + 1;

    if (isFailState(state)) {
      entry.failing_refs += 1;
      entry.failing_unique_urls.add(row.url);
    }

    map.set(key, entry);
  }

  return Array.from(map.values())
    .map((entry) => ({
      source_table: entry.source_table,
      source_column: entry.source_column,
      total_refs: entry.total_refs,
      unique_urls: entry.unique_urls.size,
      failing_refs: entry.failing_refs,
      failing_unique_urls: entry.failing_unique_urls.size,
      failing_ref_pct: entry.total_refs ? Number(((entry.failing_refs / entry.total_refs) * 100).toFixed(2)) : 0,
      states: entry.states,
    }))
    .sort((a, b) => b.failing_refs - a.failing_refs || b.total_refs - a.total_refs);
}

function buildFailingUrlIndex(refRows, statusByUrl) {
  const byUrl = new Map();
  for (const row of refRows) {
    const status = statusByUrl.get(row.url);
    if (!status || !isFailState(status.state)) continue;
    const entry =
      byUrl.get(row.url) ??
      {
        url: row.url,
        state: status.state,
        status_code: status.status,
        note: status.note,
        references: [],
      };
    entry.references.push({
      source_table: row.source_table,
      source_column: row.source_column,
      record_id: row.record_id,
    });
    byUrl.set(row.url, entry);
  }

  return Array.from(byUrl.values())
    .map((entry) => ({
      ...entry,
      reference_count: entry.references.length,
      references: entry.references.slice(0, 12),
    }))
    .sort((a, b) => b.reference_count - a.reference_count);
}

async function main() {
  const sql = `
WITH refs AS (
  SELECT 'venues'::text AS source_table, 'image_url'::text AS source_column, id::text AS record_id, image_url::text AS url
  FROM venues
  WHERE image_url IS NOT NULL AND btrim(image_url) <> ''
  UNION ALL
  SELECT 'venues','hero_image_url', id::text, hero_image_url::text
  FROM venues
  WHERE hero_image_url IS NOT NULL AND btrim(hero_image_url) <> ''
  UNION ALL
  SELECT 'events','image_url', id::text, image_url::text
  FROM events
  WHERE image_url IS NOT NULL AND btrim(image_url) <> ''
  UNION ALL
  SELECT 'events_deduplicated','image_url', id::text, image_url::text
  FROM events_deduplicated
  WHERE image_url IS NOT NULL AND btrim(image_url) <> ''
  UNION ALL
  SELECT 'artists','image_url', id::text, image_url::text
  FROM artists
  WHERE image_url IS NOT NULL AND btrim(image_url) <> ''
  UNION ALL
  SELECT 'collections','cover_image_url', id::text, cover_image_url::text
  FROM collections
  WHERE cover_image_url IS NOT NULL AND btrim(cover_image_url) <> ''
  UNION ALL
  SELECT 'festivals','image_url', id::text, image_url::text
  FROM festivals
  WHERE image_url IS NOT NULL AND btrim(image_url) <> ''
  UNION ALL
  SELECT 'series','image_url', id::text, image_url::text
  FROM series
  WHERE image_url IS NOT NULL AND btrim(image_url) <> ''
  UNION ALL
  SELECT 'venue_highlights','image_url', id::text, image_url::text
  FROM venue_highlights
  WHERE image_url IS NOT NULL AND btrim(image_url) <> ''
  UNION ALL
  SELECT 'venue_specials','image_url', id::text, image_url::text
  FROM venue_specials
  WHERE image_url IS NOT NULL AND btrim(image_url) <> ''
  UNION ALL
  SELECT 'explore_tracks','banner_image_url', id::text, banner_image_url::text
  FROM explore_tracks
  WHERE banner_image_url IS NOT NULL AND btrim(banner_image_url) <> ''
  UNION ALL
  SELECT 'explore_tracks','quote_portrait_url', id::text, quote_portrait_url::text
  FROM explore_tracks
  WHERE quote_portrait_url IS NOT NULL AND btrim(quote_portrait_url) <> ''
  UNION ALL
  SELECT 'submissions','image_urls', s.id::text, u.url::text
  FROM submissions s
  CROSS JOIN LATERAL unnest(s.image_urls) AS u(url)
  WHERE s.image_urls IS NOT NULL
)
SELECT source_table, source_column, record_id, url
FROM refs
WHERE url IS NOT NULL AND btrim(url) <> '';
`;

  const refRowsRaw = parseTsvRows(runPsql(sql));
  const refRows = refRowsRaw
    .map((row) => ({ ...row, url: normalizeUrl(row.url) }))
    .filter((row) => Boolean(row.url));

  const uniqueUrls = Array.from(new Set(refRows.map((row) => row.url)));
  console.log(`Image refs: ${refRows.length} rows`);
  console.log(`Unique image URLs: ${uniqueUrls.length}`);

  const checked = await mapLimit(uniqueUrls, CHECK_CONCURRENCY, async (url) => ({
    url,
    ...(await checkImageUrl(url)),
  }));
  const statusByUrl = new Map(checked.map((row) => [row.url, row]));

  const states = checked.reduce(
    (acc, row) => {
      acc[row.state] = (acc[row.state] ?? 0) + 1;
      return acc;
    },
    { ok: 0, broken: 0, uncertain: 0, error: 0, missing: 0 }
  );

  const perSource = summarizeBySource(refRows, statusByUrl);
  const failingUrls = buildFailingUrlIndex(refRows, statusByUrl);

  const audit = {
    generated_at: new Date().toISOString(),
    scope: {
      total_references: refRows.length,
      unique_urls: uniqueUrls.length,
      checked_concurrency: CHECK_CONCURRENCY,
      timeout_ms: CHECK_TIMEOUT_MS,
    },
    url_states: states,
    failing_urls_count: failingUrls.length,
    source_breakdown: perSource,
    failing_urls: failingUrls,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_JSON, JSON.stringify(audit, null, 2), "utf8");
  await writeFile(
    OUTPUT_BROKEN_JSON,
    JSON.stringify(
      {
        generated_at: audit.generated_at,
        failing_urls_count: failingUrls.length,
        failing_urls: failingUrls,
      },
      null,
      2
    ),
    "utf8"
  );

  const md = [];
  md.push("# Global Broken Image Audit");
  md.push("");
  md.push(`Generated: ${audit.generated_at}`);
  md.push("");
  md.push("## Scope");
  md.push(`- Total image references: ${audit.scope.total_references}`);
  md.push(`- Unique URLs checked: ${audit.scope.unique_urls}`);
  md.push(`- Timeout per URL: ${CHECK_TIMEOUT_MS}ms`);
  md.push(`- Concurrency: ${CHECK_CONCURRENCY}`);
  md.push("");
  md.push("## URL States");
  md.push(`- ok: ${states.ok}`);
  md.push(`- broken: ${states.broken}`);
  md.push(`- uncertain: ${states.uncertain}`);
  md.push(`- error: ${states.error}`);
  md.push(`- failing URLs total: ${failingUrls.length}`);
  md.push("");
  md.push("## Source Breakdown");
  for (const row of perSource) {
    md.push(
      `- ${row.source_table}.${row.source_column}: failing ${row.failing_refs}/${row.total_refs} refs (${row.failing_ref_pct}%), failing unique URLs ${row.failing_unique_urls}/${row.unique_urls}`
    );
  }
  md.push("");
  md.push("## Top Failing URLs");
  if (!failingUrls.length) {
    md.push("- None.");
  } else {
    for (const item of failingUrls.slice(0, 120)) {
      md.push(`- [${item.state}] ${item.url}`);
      md.push(`  - status: ${item.status_code ?? "n/a"}, refs: ${item.reference_count}`);
      for (const ref of item.references.slice(0, 6)) {
        md.push(`  - ${ref.source_table}.${ref.source_column} -> ${ref.record_id}`);
      }
    }
  }
  md.push("");
  md.push(`JSON report: \`${path.relative(WEB_ROOT, OUTPUT_JSON)}\``);
  md.push(`Broken-only JSON: \`${path.relative(WEB_ROOT, OUTPUT_BROKEN_JSON)}\``);
  await writeFile(OUTPUT_MD, md.join("\n"), "utf8");

  console.log(`Wrote ${path.relative(WEB_ROOT, OUTPUT_JSON)}`);
  console.log(`Wrote ${path.relative(WEB_ROOT, OUTPUT_BROKEN_JSON)}`);
  console.log(`Wrote ${path.relative(WEB_ROOT, OUTPUT_MD)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
