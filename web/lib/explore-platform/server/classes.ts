import "server-only";

import { createClient, createPortalScopedClient } from "@/lib/supabase/server";
import { escapeSQLPattern } from "@/lib/api-utils";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import {
  applyFederatedPortalScopeToQuery,
  filterByPortalCity,
  parsePortalContentFilters,
  applyPortalCategoryFilters,
  filterByPortalContentScope,
} from "@/lib/portal-scope";
import { getPortalSourceAccess } from "@/lib/federation";
import { applyFeedGate } from "@/lib/feed-gate";
import {
  buildClassesScheduleRequestKey,
  buildClassesStudiosRequestKey,
} from "@/lib/explore-platform/classes-request";
import type { ExploreLaneServerLoaderArgs } from "@/lib/explore-platform/types";
import type {
  ClassesLaneInitialData,
} from "@/lib/explore-platform/lane-data";
import type {
  ClassesResponse,
  StudiosResponse,
} from "@/lib/hooks/useClassesData";

function escapePostgrestLikeValue(value: string): string {
  return escapeSQLPattern(value)
    .replace(/"/g, '\\"')
    .replace(/'/g, "''")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/,/g, "\\,");
}

type StudioRow = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  class_category: string | null;
  skill_level: string | null;
  place_id: number | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
    image_url: string | null;
  } | null;
};

function computeDateRange(dateWindow: string | null | undefined): {
  startDate: string | null;
  endDate: string | null;
} {
  if (!dateWindow || dateWindow === "all") {
    return { startDate: null, endDate: null };
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  });
  const todayStr = formatter.format(new Date());
  const today = new Date(`${todayStr}T00:00:00`);

  if (dateWindow === "week") {
    const end = new Date(today);
    end.setDate(today.getDate() + 6);
    return { startDate: todayStr, endDate: formatter.format(end) };
  }

  if (dateWindow === "2weeks") {
    const end = new Date(today);
    end.setDate(today.getDate() + 13);
    return { startDate: todayStr, endDate: formatter.format(end) };
  }

  if (dateWindow === "weekend") {
    const dayOfWeek = today.getDay();
    let daysToSat: number;
    if (dayOfWeek === 6) {
      daysToSat = 0;
    } else if (dayOfWeek === 0) {
      daysToSat = 6;
    } else {
      daysToSat = 6 - dayOfWeek;
    }
    const sat = new Date(today);
    sat.setDate(today.getDate() + daysToSat);
    const sun = new Date(sat);
    sun.setDate(sat.getDate() + 1);
    return { startDate: formatter.format(sat), endDate: formatter.format(sun) };
  }

  return { startDate: null, endDate: null };
}

export async function getExploreClassesInitialData({
  portalId,
  portalSlug,
  portalExclusive,
  params,
}: ExploreLaneServerLoaderArgs): Promise<ClassesLaneInitialData | null> {
  const searchParams = new URLSearchParams(params.toString());
  searchParams.set("portal_id", portalId);
  if (portalExclusive) {
    searchParams.set("portal_exclusive", "true");
  }

  const category = params.get("category");
  const dateWindow = params.get("window");
  const skillLevel = params.get("skill");
  const search = params.get("q");
  const studioSlug = params.get("studio");
  const { startDate, endDate } = computeDateRange(dateWindow);

  const supabase = await createClient();
  const portalContext = await resolvePortalQueryContext(supabase, searchParams);
  const portalClient = await createPortalScopedClient(portalId);
  const sourceAccess = await getPortalSourceAccess(portalId);
  const portalCity = !portalExclusive ? portalContext.filters.city : undefined;
  const portalContentFilters = parsePortalContentFilters(
    portalContext.filters as Record<string, unknown> | null,
  );
  const today = new Date().toISOString().split("T")[0];
  let matchingVenueIds: number[] = [];
  if ((search ?? "").trim().length >= 2) {
    let venueSearchQuery = supabase
      .from("places")
      .select("id")
      .ilike("name", `%${escapePostgrestLikeValue((search ?? "").trim())}%`)
      .limit(40);

    if (portalCity) {
      venueSearchQuery = venueSearchQuery.eq("city", portalCity);
    }

    const { data: matchingVenues } = await venueSearchQuery;
    matchingVenueIds = (
      (matchingVenues as Array<{ id: number }> | null) || []
    ).map((venue) => venue.id);
  }

  if (studioSlug) {
    const scheduleParams = new URLSearchParams({
      place_slug: studioSlug,
      portal: portalSlug,
      limit: "200",
    });
    if (startDate) scheduleParams.set("start_date", startDate);
    if (endDate) scheduleParams.set("end_date", endDate);
    if (skillLevel) scheduleParams.set("skill_level", skillLevel);
    if (category) scheduleParams.set("class_category", category);

    let resolvedPlaceId: number | null = null;
    const { data: placeRow } = await supabase
      .from("places")
      .select("id")
      .eq("slug", studioSlug)
      .maybeSingle();
    if (placeRow) {
      resolvedPlaceId = (placeRow as { id: number }).id;
    }

    let query = portalClient
      .from("events")
      .select(
        `
        id,
        title,
        description,
        start_date,
        start_time,
        end_date,
        end_time,
        is_all_day,
        category_id,
        tags,
        price_min,
        price_max,
        price_note,
        is_free,
        source_url,
        ticket_url,
        image_url,
        is_class,
        class_category,
        skill_level,
        instructor,
        capacity,
        is_recurring,
        series_id,
        place_id,
        venue:places(id, name, slug, neighborhood, city, state, lat, lng)
      `,
      )
      .eq("is_class", true)
      .gte("start_date", startDate || today)
      .is("canonical_event_id", null)
      .or("is_sensitive.eq.false,is_sensitive.is.null");

    if (endDate) query = query.lte("start_date", endDate);
    if (skillLevel) query = query.eq("skill_level", skillLevel);
    if (category) query = query.eq("class_category", category);

    if ((search ?? "").trim().length >= 2) {
      const escapedSearch = escapePostgrestLikeValue((search ?? "").trim());
      const searchClauses = [
        `title.ilike.%${escapedSearch}%`,
        `description.ilike.%${escapedSearch}%`,
        `instructor.ilike.%${escapedSearch}%`,
      ];
      if (matchingVenueIds.length > 0) {
        searchClauses.push(`place_id.in.(${matchingVenueIds.join(",")})`);
      }
      query = query.or(searchClauses.join(","));
    }

    if (resolvedPlaceId !== null) query = query.eq("place_id", resolvedPlaceId);

    query = applyFederatedPortalScopeToQuery(query, {
      portalId,
      portalExclusive,
      publicOnlyWhenNoPortal: true,
      sourceIds: sourceAccess.sourceIds || [],
      sourceColumn: "source_id",
    });
    query = applyPortalCategoryFilters(query, portalContentFilters, {
      userCategoriesActive: true,
    });
    query = applyFeedGate(query)
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true })
      .range(0, 199);

    const { data } = await query;

    const cityScopedClasses = filterByPortalCity(
      ((data || []) as Array<{ venue?: { city?: string | null } | null }>),
      portalCity,
      { allowMissingCity: true },
    );
    const contentScopedClasses = filterByPortalContentScope(
      cityScopedClasses,
      portalContentFilters,
    );

    const schedule: ClassesResponse = {
      classes: contentScopedClasses as ClassesResponse["classes"],
      total: contentScopedClasses.length,
      limit: 200,
      offset: 0,
    };

    return {
      schedule,
      studioSlug,
      requestKey: buildClassesScheduleRequestKey({
        portalSlug,
        studioSlug,
        category,
        dateWindow,
        skillLevel,
      }),
    };
  }

  let query = portalClient
    .from("events")
    .select(
      `
      id,
      title,
      start_date,
      start_time,
      class_category,
      skill_level,
      place_id,
      tags,
      price_min,
      category_id,
      venue:places!inner(id, name, slug, neighborhood, city, lat, lng, image_url)
    `,
    )
    .eq("is_class", true)
    .gte("start_date", startDate || today)
    .is("canonical_event_id", null)
    .or("is_sensitive.eq.false,is_sensitive.is.null");

  if (endDate) query = query.lte("start_date", endDate);
  if (category) query = query.eq("class_category", category);
  if (skillLevel) query = query.eq("skill_level", skillLevel);
  if ((search ?? "").trim().length >= 2) {
    const escapedSearch = escapePostgrestLikeValue((search ?? "").trim());
    const searchClauses = [
      `title.ilike.%${escapedSearch}%`,
      `description.ilike.%${escapedSearch}%`,
      `instructor.ilike.%${escapedSearch}%`,
    ];
    if (matchingVenueIds.length > 0) {
      searchClauses.push(`place_id.in.(${matchingVenueIds.join(",")})`);
    }
    query = query.or(searchClauses.join(","));
  }

  query = applyFederatedPortalScopeToQuery(query, {
    portalId,
    portalExclusive,
    publicOnlyWhenNoPortal: true,
    sourceIds: sourceAccess.sourceIds || [],
    sourceColumn: "source_id",
  });
  query = applyPortalCategoryFilters(query, portalContentFilters, {
    userCategoriesActive: true,
  });
  query = applyFeedGate(query)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(120);

  const { data } = await query;
  const rows = ((data || []) as StudioRow[]);
  const cityScopedRows = filterByPortalCity(
    rows as Array<{ venue?: { city?: string | null } | null }>,
    portalCity,
    { allowMissingCity: true },
  ) as StudioRow[];
  const contentScopedRows = filterByPortalContentScope(
    cityScopedRows,
    portalContentFilters,
  ) as StudioRow[];

  const studioMap = new Map<
    number,
    {
      venue: NonNullable<StudioRow["venue"]>;
      classes: StudioRow[];
      categories: Set<string>;
    }
  >();

  for (const row of contentScopedRows) {
    if (!row.venue || !row.place_id) continue;
    let entry = studioMap.get(row.place_id);
    if (!entry) {
      entry = {
        venue: row.venue,
        classes: [],
        categories: new Set(),
      };
      studioMap.set(row.place_id, entry);
    }
    entry.classes.push(row);
    if (row.class_category) {
      entry.categories.add(row.class_category);
    }
  }

  const studios: StudiosResponse["studios"] = [];
  const categoryCounts: Record<string, number> = {};

  for (const [placeId, entry] of studioMap) {
    const nextClass = entry.classes[0];
    studios.push({
      place_id: placeId,
      name: entry.venue.name,
      slug: entry.venue.slug,
      neighborhood: entry.venue.neighborhood,
      lat: entry.venue.lat,
      lng: entry.venue.lng,
      image_url: entry.venue.image_url,
      class_count: entry.classes.length,
      categories: Array.from(entry.categories).sort(),
      next_class: nextClass
        ? {
            title: nextClass.title,
            start_date: nextClass.start_date,
            start_time: nextClass.start_time,
          }
        : null,
    });
  }

  studios.sort((left, right) => right.class_count - left.class_count);

  for (const row of contentScopedRows) {
    if (row.class_category) {
      categoryCounts[row.class_category] =
        (categoryCounts[row.class_category] || 0) + 1;
    }
  }

  const studiosPayload: StudiosResponse = {
    studios,
    category_counts: categoryCounts,
    total_count: contentScopedRows.length,
  };

  return {
    studios: studiosPayload,
    requestKey: buildClassesStudiosRequestKey({
      category,
      dateWindow,
      skillLevel,
      search,
    }),
  };
}
