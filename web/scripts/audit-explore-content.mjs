import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "fs/promises";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(WEB_ROOT, "content");
const OUTPUT_JSON = path.join(OUTPUT_DIR, "explore_tracks_content_audit.json");
const OUTPUT_MD = path.join(OUTPUT_DIR, "explore_tracks_content_audit.md");
const OUTPUT_FLAGS_JSON = path.join(OUTPUT_DIR, "explore_tracks_insufficient_flags.json");
const OUTPUT_QUEUE_MD = path.join(OUTPUT_DIR, "explore_tracks_action_queue.md");

const LOOKAHEAD_DAYS = 14;
const IMAGE_TIMEOUT_MS = 9000;
const IMAGE_CHECK_CONCURRENCY = 14;

function readEnv(envPath) {
  const raw = readFileSync(envPath, "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!key) continue;
    env[key] = value;
  }
  return env;
}

function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeVenue(input) {
  if (!input) return null;
  if (Array.isArray(input)) return input[0] ?? null;
  return input;
}

function isTruthyText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function toPct(have, total) {
  if (!total) return 0;
  return Number(((have / total) * 100).toFixed(1));
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let idx = 0;

  async function run() {
    while (idx < items.length) {
      const current = idx++;
      results[current] = await worker(items[current], current);
    }
  }

  const workers = [];
  for (let i = 0; i < Math.min(limit, items.length); i += 1) {
    workers.push(run());
  }
  await Promise.all(workers);
  return results;
}

function shouldRetryWithGet(status) {
  return status === 401 || status === 403 || status === 405;
}

async function checkImageUrl(url) {
  if (!isTruthyText(url)) {
    return { state: "missing", httpStatus: null, note: "empty_url" };
  }

  const request = async (method) => {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      headers: method === "GET" ? { Range: "bytes=0-0" } : undefined,
    });
    return response;
  };

  try {
    const head = await request("HEAD");
    if (head.ok) {
      return { state: "ok", httpStatus: head.status, note: "head_ok" };
    }
    if (shouldRetryWithGet(head.status)) {
      const getRes = await request("GET");
      if (getRes.ok) {
        return { state: "ok", httpStatus: getRes.status, note: "get_ok_after_head_blocked" };
      }
      if (getRes.status >= 400 && getRes.status < 500) {
        return { state: "broken", httpStatus: getRes.status, note: "get_client_error" };
      }
      return { state: "uncertain", httpStatus: getRes.status, note: "get_non_ok" };
    }
    if (head.status >= 400 && head.status < 500) {
      return { state: "broken", httpStatus: head.status, note: "head_client_error" };
    }
    return { state: "uncertain", httpStatus: head.status, note: "head_non_ok" };
  } catch (error) {
    return { state: "error", httpStatus: null, note: String(error?.name || "fetch_error") };
  }
}

function buildVenueFlags({
  hasAnyImage,
  hasWorkingImage,
  hasEvents,
  hasHighlights,
  hasBlurb,
  hasSource,
  hasDescription,
}) {
  const flags = [];
  const actions = [];

  if (!hasAnyImage) {
    flags.push("missing_image");
    actions.push("replace_or_add_image");
  } else if (!hasWorkingImage) {
    flags.push("broken_or_unreachable_image");
    actions.push("replace_or_verify_image");
  }

  if (!hasEvents) {
    flags.push("no_upcoming_events_14d");
    actions.push("augment_with_active_event");
  }
  if (!hasHighlights) {
    flags.push("no_facts_or_landmarks");
    actions.push("add_facts_or_landmarks");
  }
  if (!hasBlurb) {
    flags.push("missing_editorial_blurb");
    actions.push("add_editorial_blurb");
  }
  if (!hasSource) {
    flags.push("missing_source_link");
    actions.push("add_source");
  }
  if (!hasDescription) {
    flags.push("missing_venue_description");
    actions.push("enrich_venue_profile");
  }

  return { flags, actions: [...new Set(actions)] };
}

function computeRiskScore({
  hasAnyImage,
  hasWorkingImage,
  hasEvents,
  hasHighlights,
  hasBlurb,
  hasSource,
  hasDescription,
}) {
  let score = 0;
  if (!hasAnyImage) score += 4;
  else if (!hasWorkingImage) score += 3;
  if (!hasEvents) score += 2;
  if (!hasHighlights) score += 2;
  if (!hasBlurb) score += 2;
  if (!hasSource) score += 1;
  if (!hasDescription) score += 2;
  return score;
}

function determineCrawlerNeed({ score, hasAnyImage, hasWorkingImage, hasEvents, hasHighlights, hasSource, hasDescription, hasWebsite }) {
  if (!hasAnyImage && !hasEvents && !hasHighlights) return true;
  if (!hasWorkingImage && !hasEvents && !hasHighlights) return true;
  if (!hasSource && !hasDescription && !hasEvents) return true;
  if (score >= 9 && !hasWebsite) return true;
  return false;
}

async function main() {
  const env = readEnv(path.join(WEB_ROOT, ".env.local"));
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in web/.env.local");
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const today = new Date();
  const todayStr = formatDateLocal(today);
  const future = new Date(today);
  future.setDate(future.getDate() + LOOKAHEAD_DAYS);
  const futureStr = formatDateLocal(future);

  const { data: tracksRaw, error: tracksError } = await supabase
    .from("explore_tracks")
    .select("id, slug, name, quote, quote_source, description, sort_order, category, group_name, banner_image_url")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (tracksError) throw tracksError;
  const tracks = tracksRaw ?? [];

  const trackIds = tracks.map((track) => track.id);

  const { data: trackVenuesRaw, error: trackVenuesError } = await supabase
    .from("explore_track_venues")
    .select(`
      id, track_id, venue_id, sort_order, is_featured, editorial_blurb, source_url, source_label, status,
      venues (
        id, slug, name, neighborhood, city, venue_type, website,
        description, short_description, image_url, hero_image_url, data_quality, last_verified_at
      )
    `)
    .in("track_id", trackIds)
    .eq("status", "approved")
    .order("sort_order", { ascending: true });
  if (trackVenuesError) throw trackVenuesError;
  const trackVenues = trackVenuesRaw ?? [];

  const venueIds = Array.from(
    new Set(
      trackVenues
        .map((row) => normalizeVenue(row.venues)?.id ?? row.venue_id ?? null)
        .filter((id) => Boolean(id))
    )
  );

  const [eventsResult, highlightsResult, tipsResult] = await Promise.all([
    venueIds.length
      ? supabase
          .from("events")
          .select("id, venue_id, title, start_date, is_free")
          .in("venue_id", venueIds)
          .gte("start_date", todayStr)
          .lte("start_date", futureStr)
          .is("canonical_event_id", null)
          .is("portal_id", null)
          .or("is_class.eq.false,is_class.is.null")
          .or("is_sensitive.eq.false,is_sensitive.is.null")
      : Promise.resolve({ data: [], error: null }),
    venueIds.length
      ? supabase.from("venue_highlights").select("id, venue_id, highlight_type, title")
      : Promise.resolve({ data: [], error: null }),
    venueIds.length
      ? supabase.from("explore_tips").select("id, venue_id").eq("status", "approved")
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (eventsResult.error) throw eventsResult.error;
  if (highlightsResult.error) throw highlightsResult.error;
  if (tipsResult.error) throw tipsResult.error;

  const events = eventsResult.data ?? [];
  const highlights = highlightsResult.data ?? [];
  const tips = tipsResult.data ?? [];

  const eventsByVenue = new Map();
  for (const event of events) {
    const list = eventsByVenue.get(event.venue_id) ?? [];
    list.push(event);
    eventsByVenue.set(event.venue_id, list);
  }
  const highlightsByVenue = new Map();
  for (const highlight of highlights) {
    const list = highlightsByVenue.get(highlight.venue_id) ?? [];
    list.push(highlight);
    highlightsByVenue.set(highlight.venue_id, list);
  }
  const tipsByVenue = new Set(tips.map((tip) => tip.venue_id));

  const uniqueImageUrls = new Set();
  for (const row of trackVenues) {
    const venue = normalizeVenue(row.venues);
    if (!venue) continue;
    if (isTruthyText(venue.hero_image_url)) uniqueImageUrls.add(venue.hero_image_url);
    if (isTruthyText(venue.image_url)) uniqueImageUrls.add(venue.image_url);
  }

  const imageUrls = [...uniqueImageUrls];
  console.log(`Checking ${imageUrls.length} unique image URLs...`);
  const checked = await mapLimit(imageUrls, IMAGE_CHECK_CONCURRENCY, async (url) => {
    const status = await checkImageUrl(url);
    return { url, ...status };
  });
  const imageStatusByUrl = new Map(checked.map((entry) => [entry.url, entry]));

  const trackById = new Map(tracks.map((track) => [track.id, track]));
  const venueAudits = [];

  for (const row of trackVenues) {
    const track = trackById.get(row.track_id);
    const venue = normalizeVenue(row.venues);
    if (!track || !venue) continue;

    const heroImageStatus = isTruthyText(venue.hero_image_url) ? imageStatusByUrl.get(venue.hero_image_url) : null;
    const imageStatus = isTruthyText(venue.image_url) ? imageStatusByUrl.get(venue.image_url) : null;
    const hasAnyImage = Boolean(isTruthyText(venue.hero_image_url) || isTruthyText(venue.image_url));
    const hasWorkingImage = [heroImageStatus, imageStatus].some((status) => status?.state === "ok");

    const venueEvents = eventsByVenue.get(venue.id) ?? [];
    const venueHighlights = highlightsByVenue.get(venue.id) ?? [];

    const hasEvents = venueEvents.length > 0;
    const hasHighlights = venueHighlights.length > 0;
    const hasBlurb = isTruthyText(row.editorial_blurb);
    const hasSource = isTruthyText(row.source_url);
    const hasDescription = isTruthyText(venue.description) || isTruthyText(venue.short_description);
    const hasWebsite = isTruthyText(venue.website);

    const { flags, actions } = buildVenueFlags({
      hasAnyImage,
      hasWorkingImage,
      hasEvents,
      hasHighlights,
      hasBlurb,
      hasSource,
      hasDescription,
    });

    const score = computeRiskScore({
      hasAnyImage,
      hasWorkingImage,
      hasEvents,
      hasHighlights,
      hasBlurb,
      hasSource,
      hasDescription,
    });

    const crawlerCandidate = determineCrawlerNeed({
      score,
      hasAnyImage,
      hasWorkingImage,
      hasEvents,
      hasHighlights,
      hasSource,
      hasDescription,
      hasWebsite,
    });

    venueAudits.push({
      track: {
        id: track.id,
        slug: track.slug,
        name: track.name,
        category: track.category,
        group_name: track.group_name,
      },
      track_venue: {
        id: row.id,
        sort_order: row.sort_order,
        is_featured: row.is_featured,
      },
      venue: {
        id: venue.id,
        slug: venue.slug,
        name: venue.name,
        neighborhood: venue.neighborhood,
        city: venue.city,
        venue_type: venue.venue_type,
        website: venue.website,
        data_quality: venue.data_quality,
      },
      signals: {
        events_14d: venueEvents.length,
        free_events_14d: venueEvents.filter((event) => Boolean(event.is_free)).length,
        highlights_count: venueHighlights.length,
        highlight_types: [...new Set(venueHighlights.map((item) => item.highlight_type).filter(Boolean))],
        approved_tips_count: tipsByVenue.has(venue.id) ? 1 : 0,
      },
      media: {
        hero_image_url: venue.hero_image_url,
        image_url: venue.image_url,
        hero_status: heroImageStatus?.state ?? null,
        hero_status_code: heroImageStatus?.httpStatus ?? null,
        image_status: imageStatus?.state ?? null,
        image_status_code: imageStatus?.httpStatus ?? null,
        has_working_image: hasWorkingImage,
      },
      content: {
        has_editorial_blurb: hasBlurb,
        has_source_url: hasSource,
        has_venue_description: hasDescription,
      },
      flags,
      recommended_actions: actions,
      insufficiency_score: score,
      crawler_candidate: crawlerCandidate,
    });
  }

  const byTrack = new Map();
  for (const record of venueAudits) {
    const key = record.track.id;
    const list = byTrack.get(key) ?? [];
    list.push(record);
    byTrack.set(key, list);
  }

  const trackSummaries = tracks.map((track) => {
    const rows = byTrack.get(track.id) ?? [];
    const totals = {
      venues: rows.length,
      with_working_image: rows.filter((row) => row.media.has_working_image).length,
      with_events_14d: rows.filter((row) => row.signals.events_14d > 0).length,
      with_facts_landmarks: rows.filter((row) => row.signals.highlights_count > 0).length,
      with_editorial_blurb: rows.filter((row) => row.content.has_editorial_blurb).length,
      with_source_url: rows.filter((row) => row.content.has_source_url).length,
      insufficient: rows.filter((row) => row.insufficiency_score >= 6).length,
      crawler_candidates: rows.filter((row) => row.crawler_candidate).length,
      needs_active_event: rows.filter((row) => row.flags.includes("no_upcoming_events_14d")).length,
      needs_facts_landmarks: rows.filter((row) => row.flags.includes("no_facts_or_landmarks")).length,
      needs_both_event_and_facts: rows.filter(
        (row) => row.flags.includes("no_upcoming_events_14d") && row.flags.includes("no_facts_or_landmarks")
      ).length,
    };

    const topIssues = rows
      .flatMap((row) => row.flags)
      .reduce((acc, item) => {
        acc[item] = (acc[item] ?? 0) + 1;
        return acc;
      }, {});

    const issuePairs = Object.entries(topIssues).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
      track: {
        id: track.id,
        slug: track.slug,
        name: track.name,
        sort_order: track.sort_order,
        category: track.category,
        group_name: track.group_name,
      },
      totals,
      coverage_pct: {
        working_image: toPct(totals.with_working_image, totals.venues),
        events_14d: toPct(totals.with_events_14d, totals.venues),
        facts_landmarks: toPct(totals.with_facts_landmarks, totals.venues),
        editorial_blurb: toPct(totals.with_editorial_blurb, totals.venues),
        source_url: toPct(totals.with_source_url, totals.venues),
      },
      top_issues: issuePairs.map(([issue, count]) => ({ issue, count })),
      flagged_venues: rows
        .filter((row) => row.insufficiency_score >= 6)
        .sort((a, b) => b.insufficiency_score - a.insufficiency_score)
        .slice(0, 8)
        .map((row) => ({
          venue_id: row.venue.id,
          venue_slug: row.venue.slug,
          venue_name: row.venue.name,
          insufficiency_score: row.insufficiency_score,
          crawler_candidate: row.crawler_candidate,
          flags: row.flags,
          recommended_actions: row.recommended_actions,
        })),
    };
  });

  const crawlerCandidates = venueAudits
    .filter((row) => row.crawler_candidate)
    .sort((a, b) => b.insufficiency_score - a.insufficiency_score)
    .slice(0, 140)
    .map((row) => ({
      track_slug: row.track.slug,
      track_name: row.track.name,
      venue_slug: row.venue.slug,
      venue_name: row.venue.name,
      insufficiency_score: row.insufficiency_score,
      flags: row.flags,
      recommended_actions: row.recommended_actions,
      events_14d: row.signals.events_14d,
      highlights_count: row.signals.highlights_count,
      has_working_image: row.media.has_working_image,
      has_editorial_blurb: row.content.has_editorial_blurb,
      has_source_url: row.content.has_source_url,
    }));

  const uniqueCrawlerCandidates = [];
  const crawlerSeen = new Set();
  for (const row of crawlerCandidates) {
    const venueSlug = row.venue_slug || `venue-${row.venue_name.toLowerCase().replace(/\s+/g, "-")}`;
    if (crawlerSeen.has(venueSlug)) continue;
    crawlerSeen.add(venueSlug);
    uniqueCrawlerCandidates.push(row);
  }

  const actionBuckets = venueAudits.reduce(
    (acc, row) => {
      for (const action of row.recommended_actions) {
        acc[action] = (acc[action] ?? 0) + 1;
      }
      return acc;
    },
    {}
  );

  const imageHealth = checked.reduce(
    (acc, item) => {
      acc[item.state] = (acc[item.state] ?? 0) + 1;
      return acc;
    },
    { ok: 0, broken: 0, uncertain: 0, error: 0, missing: 0 }
  );

  const audit = {
    generated_at: new Date().toISOString(),
    window: {
      events_from: todayStr,
      events_to: futureStr,
      lookahead_days: LOOKAHEAD_DAYS,
    },
    scoring: {
      insufficient_threshold: 6,
      crawler_candidate_logic:
        "no usable image + no events/highlights, or no source+description+events, or high score with no website",
    },
    totals: {
      active_tracks: tracks.length,
      approved_track_venues: venueAudits.length,
      unique_venues: venueIds.length,
      total_events_14d: events.length,
      venues_with_events_14d: Array.from(eventsByVenue.keys()).length,
      venues_with_highlights: Array.from(highlightsByVenue.keys()).length,
      venues_with_approved_tips: tipsByVenue.size,
      crawler_candidates: crawlerCandidates.length,
      crawler_candidates_unique_venues: uniqueCrawlerCandidates.length,
      insufficient_rows: venueAudits.filter((row) => row.insufficiency_score >= 6).length,
      image_health: imageHealth,
    },
    action_buckets: actionBuckets,
    track_summaries: trackSummaries,
    crawler_candidates: crawlerCandidates,
    crawler_candidates_unique_venues: uniqueCrawlerCandidates,
    venue_audit_rows: venueAudits,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_JSON, JSON.stringify(audit, null, 2), "utf8");

  const insufficientRows = venueAudits
    .filter((row) => row.insufficiency_score >= 6)
    .sort((a, b) => b.insufficiency_score - a.insufficiency_score);

  const compactFlags = {
    generated_at: audit.generated_at,
    totals: {
      insufficient_rows: insufficientRows.length,
      crawler_candidates: crawlerCandidates.length,
      crawler_candidates_unique_venues: uniqueCrawlerCandidates.length,
    },
    insufficient_rows: insufficientRows.map((row) => ({
      track_slug: row.track.slug,
      track_name: row.track.name,
      venue_slug: row.venue.slug,
      venue_name: row.venue.name,
      insufficiency_score: row.insufficiency_score,
      crawler_candidate: row.crawler_candidate,
      flags: row.flags,
      recommended_actions: row.recommended_actions,
      events_14d: row.signals.events_14d,
      highlights_count: row.signals.highlights_count,
      has_working_image: row.media.has_working_image,
      has_editorial_blurb: row.content.has_editorial_blurb,
      has_source_url: row.content.has_source_url,
    })),
    crawler_candidates_unique_venues: uniqueCrawlerCandidates,
  };
  await writeFile(OUTPUT_FLAGS_JSON, JSON.stringify(compactFlags, null, 2), "utf8");

  const md = [];
  md.push("# Explore Tracks Content Audit");
  md.push("");
  md.push(`Generated: ${audit.generated_at}`);
  md.push("");
  md.push("## Scope");
  md.push(`- Active tracks: ${audit.totals.active_tracks}`);
  md.push(`- Approved track-venue rows: ${audit.totals.approved_track_venues}`);
  md.push(`- Unique venues: ${audit.totals.unique_venues}`);
  md.push(`- Event window: ${todayStr} to ${futureStr} (${LOOKAHEAD_DAYS} days)`);
  md.push("");
  md.push("## Global Health");
  md.push(`- Upcoming events (track-linked): ${audit.totals.total_events_14d}`);
  md.push(`- Venues with upcoming events: ${audit.totals.venues_with_events_14d}`);
  md.push(`- Venues with highlights (facts/landmarks): ${audit.totals.venues_with_highlights}`);
  md.push(`- Venues with approved tips: ${audit.totals.venues_with_approved_tips}`);
  md.push(`- Insufficient rows (score >= 6): ${audit.totals.insufficient_rows}`);
  md.push(`- Crawler candidates: ${audit.totals.crawler_candidates}`);
  md.push(`- Unique crawler venue candidates: ${audit.totals.crawler_candidates_unique_venues}`);
  md.push(
    `- Image health: ok=${imageHealth.ok}, broken=${imageHealth.broken}, uncertain=${imageHealth.uncertain}, error=${imageHealth.error}`
  );
  md.push("");

  md.push("## Augmentation Buckets");
  const bucketPairs = Object.entries(actionBuckets).sort((a, b) => b[1] - a[1]);
  for (const [bucket, count] of bucketPairs) {
    md.push(`- ${bucket}: ${count}`);
  }
  md.push("");

  md.push("## Priority Tracks");
  const priorityTracks = [...trackSummaries]
    .sort((a, b) => b.totals.insufficient - a.totals.insufficient || b.totals.crawler_candidates - a.totals.crawler_candidates)
    .slice(0, 10);
  for (const item of priorityTracks) {
    md.push(
      `- ${item.track.sort_order}. ${item.track.name} (\`${item.track.slug}\`) - insufficient ${item.totals.insufficient}/${item.totals.venues}, crawler ${item.totals.crawler_candidates}`
    );
  }
  md.push("");

  for (const summary of trackSummaries.sort((a, b) => a.track.sort_order - b.track.sort_order)) {
    md.push(`## ${summary.track.sort_order}. ${summary.track.name} (\`${summary.track.slug}\`)`);
    md.push("");
    md.push(`- Venues: ${summary.totals.venues}`);
    md.push(
      `- Coverage: images ${summary.coverage_pct.working_image}%, events ${summary.coverage_pct.events_14d}%, facts/landmarks ${summary.coverage_pct.facts_landmarks}%, blurbs ${summary.coverage_pct.editorial_blurb}%, sources ${summary.coverage_pct.source_url}%`
    );
    md.push(`- Insufficient rows: ${summary.totals.insufficient}`);
    md.push(`- Crawler candidates: ${summary.totals.crawler_candidates}`);
    md.push(
      `- Needs augmentation: active events ${summary.totals.needs_active_event}, facts/landmarks ${summary.totals.needs_facts_landmarks}, both ${summary.totals.needs_both_event_and_facts}`
    );

    if (summary.top_issues.length) {
      md.push("- Top issue mix:");
      for (const issue of summary.top_issues) {
        md.push(`  - ${issue.issue}: ${issue.count}`);
      }
    }

    if (summary.flagged_venues.length) {
      md.push("- Highest-risk venues:");
      for (const venue of summary.flagged_venues.slice(0, 6)) {
        md.push(
          `  - ${venue.venue_name} (\`${venue.venue_slug}\`) score=${venue.insufficiency_score} crawler=${venue.crawler_candidate} flags=${venue.flags.join(", ")}`
        );
      }
    }
    md.push("");
  }

  md.push("## Crawler Candidate List");
  for (const row of uniqueCrawlerCandidates.slice(0, 80)) {
    md.push(
      `- ${row.track_name} -> ${row.venue_name} (\`${row.venue_slug}\`), score=${row.insufficiency_score}, flags=${row.flags.join(", ")}`
    );
  }
  md.push("");
  md.push(`JSON output: \`${path.relative(WEB_ROOT, OUTPUT_JSON)}\``);

  await writeFile(OUTPUT_MD, md.join("\n"), "utf8");

  const imageFixRows = venueAudits
    .filter((row) => row.flags.includes("broken_or_unreachable_image") || row.flags.includes("missing_image"))
    .sort((a, b) => b.insufficiency_score - a.insufficiency_score);

  const noEventTracks = [...trackSummaries]
    .sort((a, b) => b.totals.needs_active_event - a.totals.needs_active_event)
    .slice(0, 12);

  const noFactsTracks = [...trackSummaries]
    .sort((a, b) => b.totals.needs_facts_landmarks - a.totals.needs_facts_landmarks)
    .slice(0, 12);

  const lowSourceTracks = [...trackSummaries]
    .sort((a, b) => a.coverage_pct.source_url - b.coverage_pct.source_url)
    .slice(0, 12);

  const queue = [];
  queue.push("# Explore Tracks Action Queue");
  queue.push("");
  queue.push(`Generated: ${audit.generated_at}`);
  queue.push("");
  queue.push("## P0 - Image Repairs");
  if (!imageFixRows.length) {
    queue.push("- None detected.");
  } else {
    for (const row of imageFixRows) {
      queue.push(
        `- ${row.track.name} -> ${row.venue.name} (\`${row.venue.slug}\`) flags=${row.flags.join(", ")}`
      );
    }
  }
  queue.push("");
  queue.push("## P1 - Crawler/Research Candidates (Unique Venues)");
  for (const row of uniqueCrawlerCandidates.slice(0, 40)) {
    queue.push(
      `- ${row.venue_name} (\`${row.venue_slug}\`) via ${row.track_name} - score=${row.insufficiency_score}, flags=${row.flags.join(", ")}`
    );
  }
  queue.push("");
  queue.push("## P2 - Track-Level Augmentation Priorities");
  queue.push("");
  queue.push("### Active Event Augmentation");
  for (const row of noEventTracks) {
    queue.push(
      `- ${row.track.sort_order}. ${row.track.name} (\`${row.track.slug}\`): ${row.totals.needs_active_event}/${row.totals.venues} need event signal`
    );
  }
  queue.push("");
  queue.push("### Facts/Landmarks Augmentation");
  for (const row of noFactsTracks) {
    queue.push(
      `- ${row.track.sort_order}. ${row.track.name} (\`${row.track.slug}\`): ${row.totals.needs_facts_landmarks}/${row.totals.venues} need facts/landmarks`
    );
  }
  queue.push("");
  queue.push("### Source Link Augmentation");
  for (const row of lowSourceTracks) {
    queue.push(
      `- ${row.track.sort_order}. ${row.track.name} (\`${row.track.slug}\`): source coverage ${row.coverage_pct.source_url}%`
    );
  }
  queue.push("");
  queue.push(
    "Use `content/explore_tracks_insufficient_flags.json` for machine-readable batch updates and `content/explore_tracks_content_audit.md` for full context."
  );
  await writeFile(OUTPUT_QUEUE_MD, queue.join("\n"), "utf8");

  console.log(`Wrote ${path.relative(WEB_ROOT, OUTPUT_JSON)}`);
  console.log(`Wrote ${path.relative(WEB_ROOT, OUTPUT_FLAGS_JSON)}`);
  console.log(`Wrote ${path.relative(WEB_ROOT, OUTPUT_MD)}`);
  console.log(`Wrote ${path.relative(WEB_ROOT, OUTPUT_QUEUE_MD)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
