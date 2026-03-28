import { addDays, format } from "date-fns";

// Dynamic import to avoid ESM/CJS crash in Vercel runtime.
// jsdom v28's transitive dep @exodus/bytes is ESM-only and can't be require()'d.
async function getJSDOM(): Promise<typeof import("jsdom")> {
  return await import("jsdom");
}
import {
  getYonderAccommodationInventorySource,
  type YonderAccommodationInventorySource,
  YONDER_INVENTORY_PROVIDERS,
} from "@/config/yonder-accommodation-inventory";
import { createServiceClient } from "@/lib/supabase/service";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";

const CACHE_NAMESPACE = "yonder:provider-inventory:v3";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type GaStateParkHandle = {
  providerSlug: string;
  parkId: string;
};

type VenueIdRow = {
  id: number;
};

type PersistedInventorySnapshotRow = {
  arrival_date: string;
  nights: number;
  window_label: string | null;
  total_results: number | null;
  records: unknown;
  metadata: unknown;
};

export type YonderRuntimeInventoryRecord = {
  unitType:
    | "tent_site"
    | "cabin"
    | "backcountry_site"
    | "group_site"
    | "group_lodge"
    | "guide_package"
    | "yurt"
    | "other";
  rawLabels: string[];
  visibleInventoryCount: number;
  sampleSiteLabel?: string | null;
  sampleDetailStatus?: "bookable" | "notify_only" | "check_availability" | null;
  sampleNightlyRate?: string | null;
  sampleWeeklyRate?: string | null;
};

export type YonderRuntimeInventorySnapshot = {
  destinationSlug: string;
  providerId: YonderAccommodationInventorySource["providerId"];
  providerLabel: string;
  arrivalDate: string;
  nights: number;
  windowLabel: string;
  totalResults: number | null;
  records: YonderRuntimeInventoryRecord[];
};

const YONDER_GA_STATE_PARK_HANDLES: Record<string, GaStateParkHandle> = {
  "cloudland-canyon": {
    providerSlug: "cloudland-canyon-state-park",
    parkId: "530148",
  },
  "vogel-state-park": {
    providerSlug: "vogel-state-park",
    parkId: "530201",
  },
  "fort-mountain-state-park": {
    providerSlug: "fort-mountain-state-park",
    parkId: "530158",
  },
  "black-rock-mountain": {
    providerSlug: "black-rock-mountain-state-park",
    parkId: "530146",
  },
  "chattahoochee-bend-state-park": {
    providerSlug: "chattahoochee-bend-state-park",
    parkId: "530483",
  },
  "red-top-mountain-state-park": {
    providerSlug: "red-top-mountain-state-park",
    parkId: "530364",
  },
  "hard-labor-creek-state-park": {
    providerSlug: "hard-labor-creek-state-park",
    parkId: "530166",
  },
  "fort-yargo-state-park": {
    providerSlug: "fort-yargo-state-park",
    parkId: "530159",
  },
  "don-carter-state-park": {
    providerSlug: "don-carter-state-park",
    parkId: "531350",
  },
};

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " "));
}

function normalizeUnitType(label: string): YonderRuntimeInventoryRecord["unitType"] {
  const lowered = label.toLowerCase();
  if (lowered.includes("cottage") || lowered.includes("cabin")) {
    return "cabin";
  }
  if (lowered.includes("yurt")) {
    return "yurt";
  }
  if (lowered.includes("backcountry")) {
    return "backcountry_site";
  }
  if (lowered.includes("group lodge")) {
    return "group_lodge";
  }
  if (
    lowered.includes("group shelter") ||
    lowered.includes("picnic shelter") ||
    lowered.includes("group site")
  ) {
    return "group_site";
  }
  if (
    lowered.includes("camp") ||
    lowered.includes("tent") ||
    lowered.includes("rv") ||
    lowered.includes("trailer") ||
    lowered.includes("adirondack")
  ) {
    return "tent_site";
  }
  return "other";
}

type RuntimeSiteCard = {
  siteLabel: string;
  unitType: YonderRuntimeInventoryRecord["unitType"];
  detailUrl: string | null;
};

function getNextWeekendWindow(reference = new Date()) {
  const day = reference.getDay();
  const daysUntilFriday = (5 - day + 7) % 7;
  const arrival = addDays(reference, daysUntilFriday);
  const nights = 2;
  return {
    arrivalDateIso: format(arrival, "yyyy-MM-dd"),
    arrivalDate: format(arrival, "MM/dd/yyyy"),
    nights,
    windowLabel: `${format(arrival, "EEE MMM d")} for ${nights} nights`,
  };
}

function getInventoryScopeForSource(
  source: YonderAccommodationInventorySource,
): "overnight" | "package" | "day_use" {
  if (source.coverageLevel === "package_only") {
    return "package";
  }
  if (source.coverageLevel === "self_guided") {
    return "day_use";
  }
  return "overnight";
}

function normalizePersistedRuntimeRecord(
  value: unknown,
): YonderRuntimeInventoryRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const unitType =
    typeof record.unitType === "string"
      ? record.unitType
      : typeof record.unit_type === "string"
        ? record.unit_type
        : null;
  const rawLabels = Array.isArray(record.rawLabels)
    ? record.rawLabels
    : Array.isArray(record.raw_labels)
      ? record.raw_labels
      : null;
  const visibleInventoryCount =
    typeof record.visibleInventoryCount === "number"
      ? record.visibleInventoryCount
      : typeof record.visible_inventory_count === "number"
        ? record.visible_inventory_count
        : null;

  if (
    !unitType ||
    !rawLabels ||
    rawLabels.some((label) => typeof label !== "string") ||
    visibleInventoryCount === null
  ) {
    return null;
  }

  return {
    unitType: unitType as YonderRuntimeInventoryRecord["unitType"],
    rawLabels: rawLabels as string[],
    visibleInventoryCount,
    sampleSiteLabel:
      typeof record.sampleSiteLabel === "string"
        ? record.sampleSiteLabel
        : typeof record.sample_site_label === "string"
          ? record.sample_site_label
          : null,
    sampleDetailStatus:
      typeof record.sampleDetailStatus === "string"
        ? (record.sampleDetailStatus as YonderRuntimeInventoryRecord["sampleDetailStatus"])
        : typeof record.sample_detail_status === "string"
          ? (record.sample_detail_status as YonderRuntimeInventoryRecord["sampleDetailStatus"])
          : null,
    sampleNightlyRate:
      typeof record.sampleNightlyRate === "string"
        ? record.sampleNightlyRate
        : typeof record.sample_nightly_rate === "string"
          ? record.sample_nightly_rate
          : null,
    sampleWeeklyRate:
      typeof record.sampleWeeklyRate === "string"
        ? record.sampleWeeklyRate
        : typeof record.sample_weekly_rate === "string"
          ? record.sample_weekly_rate
          : null,
  };
}

async function fetchPersistedSnapshot(
  destinationSlug: string,
  source: YonderAccommodationInventorySource,
  arrivalDateIso: string,
  nights: number,
): Promise<YonderRuntimeInventorySnapshot | null> {
  try {
    const supabase = createServiceClient();
    const venueResult = await supabase
      .from("places")
      .select("id")
      .eq("slug", destinationSlug)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    const venueRow = (venueResult.data as VenueIdRow | null) ?? null;

    if (venueResult.error || !venueRow) {
      return null;
    }

    const selectColumns =
      "arrival_date, nights, window_label, total_results, records, metadata";
    const inventoryScope = getInventoryScopeForSource(source);
    let snapshotData: PersistedInventorySnapshotRow | null = null;

    const currentResult = await supabase
      .from("current_venue_inventory_snapshots")
      .select(selectColumns)
      .eq("place_id", venueRow.id)
      .eq("provider_id", source.providerId)
      .eq("inventory_scope", inventoryScope)
      .eq("arrival_date", arrivalDateIso)
      .eq("nights", nights)
      .limit(1)
      .maybeSingle();

    if (!currentResult.error && currentResult.data) {
      snapshotData = currentResult.data as PersistedInventorySnapshotRow;
    }

    if (!snapshotData) {
      const snapshotResult = await supabase
        .from("place_inventory_snapshots")
        .select(selectColumns + ", captured_for_date, captured_at")
        .eq("place_id", venueRow.id)
        .eq("provider_id", source.providerId)
        .eq("inventory_scope", inventoryScope)
        .eq("arrival_date", arrivalDateIso)
        .eq("nights", nights)
        .order("captured_for_date", { ascending: false })
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (snapshotResult.error || !snapshotResult.data) {
        return null;
      }

      snapshotData = snapshotResult.data as PersistedInventorySnapshotRow;
    }

    const persistedRecords = Array.isArray(snapshotData.records)
      ? snapshotData.records
          .map(normalizePersistedRuntimeRecord)
          .filter(
            (
              record,
            ): record is YonderRuntimeInventoryRecord => record !== null,
          )
      : [];

    if (persistedRecords.length === 0) {
      return null;
    }

    const metadata =
      snapshotData.metadata &&
      typeof snapshotData.metadata === "object" &&
      !Array.isArray(snapshotData.metadata)
        ? (snapshotData.metadata as Record<string, unknown>)
        : {};

    return {
      destinationSlug,
      providerId: source.providerId,
      providerLabel:
        typeof metadata.provider_label === "string"
          ? metadata.provider_label
          : YONDER_INVENTORY_PROVIDERS[source.providerId].shortLabel,
      arrivalDate: format(new Date(`${arrivalDateIso}T00:00:00`), "MM/dd/yyyy"),
      nights: snapshotData.nights,
      windowLabel:
        snapshotData.window_label ??
        `${format(new Date(`${arrivalDateIso}T00:00:00`), "EEE MMM d")} for ${snapshotData.nights} nights`,
      totalResults: snapshotData.total_results,
      records: persistedRecords,
    };
  } catch {
    return null;
  }
}

function parseTotalResults(html: string): number | null {
  const flattened = html.replace(/\s+/g, " ");
  const match =
    flattened.match(/Campsite Search Results:\s+\d+\s*-\s*\d+\s+of\s+(\d+)/i) ??
    flattened.match(/(\d+)\s+site\(s\)\s+found/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

function parseRuntimeInventoryRecords(
  html: string,
): YonderRuntimeInventoryRecord[] {
  const summaryPattern =
    /<div class=['"]site_type_item_redesigned(?:\s+slct)?['"]>([\s\S]*?)<\/div>/gi;
  const grouped = new Map<
    YonderRuntimeInventoryRecord["unitType"],
    { rawLabels: string[]; visibleInventoryCount: number }
  >();

  for (const match of html.matchAll(summaryPattern)) {
    const text = stripTags(match[1]);
    const summaryMatch = text.match(/^(.*?)\s+\((\d+)\)$/);
    if (!summaryMatch) continue;

    const rawLabel = summaryMatch[1].trim();
    if (!rawLabel || rawLabel.toUpperCase() === "ALL") continue;

    const visibleInventoryCount = Number.parseInt(summaryMatch[2], 10);
    const unitType = normalizeUnitType(rawLabel);
    const current = grouped.get(unitType) ?? {
      rawLabels: [],
      visibleInventoryCount: 0,
    };

    if (!current.rawLabels.includes(rawLabel)) {
      current.rawLabels.push(rawLabel);
    }
    current.visibleInventoryCount += visibleInventoryCount;
    grouped.set(unitType, current);
  }

  return [...grouped.entries()]
    .map(([unitType, value]) => ({
      unitType,
      rawLabels: value.rawLabels,
      visibleInventoryCount: value.visibleInventoryCount,
    }))
    .sort((a, b) => b.visibleInventoryCount - a.visibleInventoryCount);
}

async function parseRuntimeSiteCards(html: string): Promise<RuntimeSiteCard[]> {
  const { JSDOM } = await getJSDOM();
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const cards: RuntimeSiteCard[] = [];
  const cardNodes = [...document.querySelectorAll("#shoppingitems > .br")]
    .filter((node) => !node.classList.contains("hdr"));

  for (const node of cardNodes) {
    const cells = [...node.querySelectorAll(":scope > .td")].map((cell) =>
      cell.textContent?.replace(/\s+/g, " ").trim() ?? "",
    );
    if (cells.length < 7) continue;

    const siteLabel = cells[0].replace(/^Map\s+/i, "").trim();
    const siteTypeLabel = cells[2]?.trim();
    if (!siteLabel || !siteTypeLabel) continue;

    const detailLink = node.querySelector(".td a[href*='campsiteDetails.do']");

    cards.push({
      siteLabel,
      unitType: normalizeUnitType(siteTypeLabel),
      detailUrl: detailLink?.getAttribute("href")
        ? `https://gastateparks.reserveamerica.com${decodeHtmlEntities(
            detailLink.getAttribute("href") ?? "",
          )}`
        : null,
    });
  }

  return cards;
}

async function fetchGaStateParkDetailSignal(
  detailUrl: string,
  arrivalDate: string,
  nights: number,
): Promise<{
  sampleDetailStatus: YonderRuntimeInventoryRecord["sampleDetailStatus"];
  sampleNightlyRate: string | null;
  sampleWeeklyRate: string | null;
} | null> {
  const initialRes = await fetch(detailUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
    next: { revalidate: 0 },
  });
  if (!initialRes.ok) return null;
  const initialHtml = await initialRes.text();
  const { JSDOM } = await getJSDOM();
  const initialDom = new JSDOM(initialHtml);
  const form = initialDom.window.document.querySelector<HTMLFormElement>(
    "#booksiteform",
  );
  if (!form) return null;

  const payload = new URLSearchParams();
  for (const input of [...form.querySelectorAll<HTMLInputElement>("input")]) {
    const name = input.getAttribute("name");
    if (!name) continue;
    payload.set(name, decodeHtmlEntities(input.getAttribute("value") ?? ""));
  }
  payload.set("arvdate", arrivalDate);
  payload.set("arrivaldate", arrivalDate);
  payload.set("lengthOfStay", String(nights));
  payload.set("dateChosen", "true");

  const pricedRes = await fetch(detailUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0",
      Referer: detailUrl,
    },
    body: payload.toString(),
    next: { revalidate: 0 },
  });
  if (!pricedRes.ok) return null;

  const pricedHtml = await pricedRes.text();
  const flattened = pricedHtml.replace(/\s+/g, " ");
  const sampleDetailStatus =
    flattened.includes("Book these Dates")
      ? "bookable"
      : flattened.includes("Create Availability Notification")
        ? "notify_only"
        : flattened.includes("Check Availability")
          ? "check_availability"
          : null;

  const rateValues = [...pricedHtml.matchAll(/<span class=['"]notranslate['"]>\s*(\$[\d,]+(?:\.\d{2})?)\s*<\/span>/gi)].map(
    (match) => match[1],
  );

  return {
    sampleDetailStatus,
    sampleNightlyRate: rateValues[0] ?? null,
    sampleWeeklyRate: rateValues[1] ?? null,
  };
}

async function fetchGaStateParkRuntimeSnapshot(
  destinationSlug: string,
  source: YonderAccommodationInventorySource,
): Promise<YonderRuntimeInventorySnapshot | null> {
  const handle = YONDER_GA_STATE_PARK_HANDLES[destinationSlug];
  if (!handle) return null;

  const weekendWindow = getNextWeekendWindow();
  const cacheKey = [
    destinationSlug,
    source.providerId,
    weekendWindow.arrivalDateIso,
    weekendWindow.nights,
  ].join("|");

  const cached = await getSharedCacheJson<YonderRuntimeInventorySnapshot>(
    CACHE_NAMESPACE,
    cacheKey,
  );
  if (cached) return cached;

  const params = new URLSearchParams({
    site: "all",
    type: "9",
    minimal: "no",
    search: "site",
    criteria: "new",
    "book-sites": "new",
    contractCode: "GA",
    parkId: handle.parkId,
    campingDate: weekendWindow.arrivalDate,
    lengthOfStay: String(weekendWindow.nights),
    siteTypeFilter: "ALL",
  });

  const url = `https://gastateparks.reserveamerica.com/camping/${handle.providerSlug}/r/campsiteSearch.do?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;

  const html = await res.text();
  const records = parseRuntimeInventoryRecords(html);
  const siteCards = await parseRuntimeSiteCards(html);
  const seenUnitTypes = new Set<YonderRuntimeInventoryRecord["unitType"]>();

  for (const record of records) {
    const sampleCard = siteCards.find((card) => {
      if (card.unitType !== record.unitType) return false;
      if (seenUnitTypes.has(card.unitType)) return false;
      return true;
    });
    if (!sampleCard) continue;

    seenUnitTypes.add(sampleCard.unitType);
    record.sampleSiteLabel = sampleCard.siteLabel;

    if (sampleCard.detailUrl) {
      const detailSignal = await fetchGaStateParkDetailSignal(
        sampleCard.detailUrl,
        weekendWindow.arrivalDate,
        weekendWindow.nights,
      );
      if (detailSignal) {
        record.sampleDetailStatus = detailSignal.sampleDetailStatus;
        record.sampleNightlyRate = detailSignal.sampleNightlyRate;
        record.sampleWeeklyRate = detailSignal.sampleWeeklyRate;
      }
    }
  }

  const snapshot: YonderRuntimeInventorySnapshot = {
    destinationSlug,
    providerId: source.providerId,
    providerLabel: "GA State Parks",
    arrivalDate: weekendWindow.arrivalDate,
    nights: weekendWindow.nights,
    windowLabel: weekendWindow.windowLabel,
    totalResults: parseTotalResults(html),
    records,
  };

  await setSharedCacheJson(CACHE_NAMESPACE, cacheKey, snapshot, CACHE_TTL_MS);
  return snapshot;
}

export async function getYonderRuntimeInventorySnapshot(
  destinationSlug: string | null | undefined,
): Promise<YonderRuntimeInventorySnapshot | null> {
  if (!destinationSlug) return null;
  const source = getYonderAccommodationInventorySource(destinationSlug);
  if (!source) return null;

   const weekendWindow = getNextWeekendWindow();
   const cacheKey = [
     destinationSlug,
     source.providerId,
     weekendWindow.arrivalDateIso,
     weekendWindow.nights,
   ].join("|");

   const cached = await getSharedCacheJson<YonderRuntimeInventorySnapshot>(
     CACHE_NAMESPACE,
     cacheKey,
   );
   if (cached) return cached;

   const persisted = await fetchPersistedSnapshot(
     destinationSlug,
     source,
     weekendWindow.arrivalDateIso,
     weekendWindow.nights,
   );
   if (persisted) {
     await setSharedCacheJson(CACHE_NAMESPACE, cacheKey, persisted, CACHE_TTL_MS);
     return persisted;
   }

  if (source.providerId === "ga_state_parks") {
    return fetchGaStateParkRuntimeSnapshot(destinationSlug, source);
  }

  return null;
}
