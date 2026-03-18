#!/usr/bin/env python3
"""
Audit destination-first Family content coverage for a target database.

This report focuses on venues already linked to the Family portal through
events or programs, then measures how much destination richness is attached
to those venues through venue_destination_details, venue_features, and
venue_specials.

Usage:
  python3 database/audit_family_destination_content.py --target production
  python3 database/audit_family_destination_content.py --target production --json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import dotenv_values


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"

DEFAULT_PORTAL_SLUG = "atlanta-families"

FAMILY_VENUE_TYPES = (
    "park",
    "library",
    "museum",
    "garden",
    "community_center",
    "recreation",
    "aquatic_center",
    "pool",
    "campground",
    "trail",
    "trailhead",
    "visitor_center",
    "plaza",
)


def _database_url_for_target(target: str) -> tuple[str | None, str | None]:
    env = dotenv_values(ENV_PATH)
    if target == "staging":
        value = env.get("STAGING_DATABASE_URL") or env.get("DATABASE_URL_STAGING")
        if not value:
            return None, "Missing STAGING_DATABASE_URL (or DATABASE_URL_STAGING) in .env"
        return value, None

    value = env.get("DATABASE_URL")
    if not value:
        return None, "Missing DATABASE_URL in .env"
    return value, None


def _fetch_all(
    cur: RealDictCursor,
    sql: str,
    params: tuple | None = None,
) -> list[dict]:
    cur.execute(sql, params or ())
    return [dict(row) for row in cur.fetchall()]


def build_report(target: str, portal_slug: str) -> dict:
    database_url, error = _database_url_for_target(target)
    if error:
        return {"target": target, "portal_slug": portal_slug, "ok": False, "error": error}

    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            portal = _fetch_all(
                cur,
                """
                select id, slug, name
                from portals
                where slug = %s
                limit 1
                """,
                (portal_slug,),
            )
            if not portal:
                return {
                    "target": target,
                    "portal_slug": portal_slug,
                    "ok": False,
                    "error": f"Portal slug '{portal_slug}' not found",
                }

            portal_id = portal[0]["id"]

            family_venue_summary = _fetch_all(
                cur,
                """
                with family_venues as (
                  select distinct e.venue_id
                  from portal_source_access psa
                  join events e on e.source_id = psa.source_id
                  where psa.portal_id = %s
                    and e.venue_id is not null
                    and coalesce(e.is_active, true) = true
                    and e.start_date >= current_date
                  union
                  select distinct venue_id
                  from programs
                  where portal_id = %s
                    and venue_id is not null
                    and status = 'active'
                )
                select
                  count(*)::int as venue_count,
                  count(*) filter (where v.venue_type = any(%s))::int as target_type_count,
                  count(*) filter (
                    where v.venue_type = any(%s)
                      and exists (
                        select 1
                        from venue_destination_details d
                        where d.venue_id = v.id
                      )
                  )::int as with_destination_details,
                  count(*) filter (
                    where v.venue_type = any(%s)
                      and exists (
                        select 1
                        from venue_features f
                        where f.venue_id = v.id
                          and f.is_active = true
                      )
                  )::int as with_features,
                  count(*) filter (
                    where v.venue_type = any(%s)
                      and exists (
                        select 1
                        from venue_specials s
                        where s.venue_id = v.id
                          and s.is_active = true
                      )
                  )::int as with_specials
                from family_venues fv
                join venues v on v.id = fv.venue_id
                """,
                (
                    portal_id,
                    portal_id,
                    list(FAMILY_VENUE_TYPES),
                    list(FAMILY_VENUE_TYPES),
                    list(FAMILY_VENUE_TYPES),
                    list(FAMILY_VENUE_TYPES),
                ),
            )

            venue_type_breakdown = _fetch_all(
                cur,
                """
                with family_venues as (
                  select distinct e.venue_id
                  from portal_source_access psa
                  join events e on e.source_id = psa.source_id
                  where psa.portal_id = %s
                    and e.venue_id is not null
                    and coalesce(e.is_active, true) = true
                    and e.start_date >= current_date
                  union
                  select distinct venue_id
                  from programs
                  where portal_id = %s
                    and venue_id is not null
                    and status = 'active'
                )
                select
                  coalesce(v.venue_type, 'unknown') as venue_type,
                  count(*)::int as venue_count,
                  count(*) filter (
                    where exists (
                      select 1
                      from venue_destination_details d
                      where d.venue_id = v.id
                    )
                  )::int as with_destination_details,
                  count(*) filter (
                    where exists (
                      select 1
                      from venue_features f
                      where f.venue_id = v.id
                        and f.is_active = true
                    )
                  )::int as with_features,
                  count(*) filter (
                    where exists (
                      select 1
                      from venue_specials s
                      where s.venue_id = v.id
                        and s.is_active = true
                    )
                  )::int as with_specials
                from family_venues fv
                join venues v on v.id = fv.venue_id
                where v.venue_type = any(%s)
                group by coalesce(v.venue_type, 'unknown')
                order by venue_count desc, venue_type asc
                """,
                (portal_id, portal_id, list(FAMILY_VENUE_TYPES)),
            )

            city_breakdown = _fetch_all(
                cur,
                """
                with family_venues as (
                  select distinct e.venue_id
                  from portal_source_access psa
                  join events e on e.source_id = psa.source_id
                  where psa.portal_id = %s
                    and e.venue_id is not null
                    and coalesce(e.is_active, true) = true
                    and e.start_date >= current_date
                  union
                  select distinct venue_id
                  from programs
                  where portal_id = %s
                    and venue_id is not null
                    and status = 'active'
                )
                select
                  coalesce(v.city, 'unknown') as city,
                  count(*)::int as venue_count,
                  count(*) filter (
                    where exists (
                      select 1
                      from venue_destination_details d
                      where d.venue_id = v.id
                    )
                  )::int as with_destination_details,
                  count(*) filter (
                    where exists (
                      select 1
                      from venue_features f
                      where f.venue_id = v.id
                        and f.is_active = true
                    )
                  )::int as with_features
                from family_venues fv
                join venues v on v.id = fv.venue_id
                where v.venue_type = any(%s)
                group by coalesce(v.city, 'unknown')
                order by venue_count desc, city asc
                limit 15
                """,
                (portal_id, portal_id, list(FAMILY_VENUE_TYPES)),
            )

            destination_detail_coverage = _fetch_all(
                cur,
                """
                with family_venues as (
                  select distinct e.venue_id
                  from portal_source_access psa
                  join events e on e.source_id = psa.source_id
                  where psa.portal_id = %s
                    and e.venue_id is not null
                    and coalesce(e.is_active, true) = true
                    and e.start_date >= current_date
                  union
                  select distinct venue_id
                  from programs
                  where portal_id = %s
                    and venue_id is not null
                    and status = 'active'
                )
                select
                  count(*)::int as rows,
                  count(*) filter (where d.destination_type is not null)::int as with_destination_type,
                  count(*) filter (where d.commitment_tier is not null)::int as with_commitment_tier,
                  count(*) filter (where d.family_suitability is not null)::int as with_family_suitability,
                  count(*) filter (where d.parking_type is not null)::int as with_parking_type,
                  count(*) filter (where d.accessibility_notes is not null and btrim(d.accessibility_notes) <> '')::int as with_accessibility_notes,
                  count(*) filter (where d.practical_notes is not null and btrim(d.practical_notes) <> '')::int as with_practical_notes,
                  count(*) filter (where d.weather_fit_tags is not null and array_length(d.weather_fit_tags, 1) > 0)::int as with_weather_fit_tags,
                  count(*) filter (where d.best_time_of_day is not null)::int as with_best_time_of_day
                from venue_destination_details d
                join family_venues fv on fv.venue_id = d.venue_id
                join venues v on v.id = d.venue_id
                where v.venue_type = any(%s)
                """,
                (portal_id, portal_id, list(FAMILY_VENUE_TYPES)),
            )

            feature_wedges = _fetch_all(
                cur,
                """
                with family_venues as (
                  select distinct e.venue_id
                  from portal_source_access psa
                  join events e on e.source_id = psa.source_id
                  where psa.portal_id = %s
                    and e.venue_id is not null
                    and coalesce(e.is_active, true) = true
                    and e.start_date >= current_date
                  union
                  select distinct venue_id
                  from programs
                  where portal_id = %s
                    and venue_id is not null
                    and status = 'active'
                ),
                relevant_features as (
                  select
                    f.*,
                    case
                      when lower(coalesce(f.slug, '') || ' ' || coalesce(f.title, '') || ' ' || coalesce(f.description, ''))
                        ~ '(splash|sprayground|spray|water play|play fountain|wading|pool|aquatic)'
                        then 'water_play'
                      when lower(coalesce(f.slug, '') || ' ' || coalesce(f.title, '') || ' ' || coalesce(f.description, ''))
                        ~ '(playground|play area|tot lot|nature play)'
                        then 'playground'
                      when lower(coalesce(f.slug, '') || ' ' || coalesce(f.title, '') || ' ' || coalesce(f.description, ''))
                        ~ '(story ?walk|storybook|book trail)'
                        then 'story_walk'
                      when lower(coalesce(f.slug, '') || ' ' || coalesce(f.title, '') || ' ' || coalesce(f.description, ''))
                        ~ '(creek|stream play|waterfall overlook|boardwalk)'
                        then 'micro_adventure'
                      else 'other_family'
                    end as wedge
                  from venue_features f
                  join family_venues fv on fv.venue_id = f.venue_id
                  join venues v on v.id = f.venue_id
                  where f.is_active = true
                    and v.venue_type = any(%s)
                )
                select
                  wedge,
                  count(*)::int as feature_count,
                  count(distinct venue_id)::int as venue_count,
                  count(*) filter (where feature_type = 'amenity')::int as amenity_count,
                  count(*) filter (where is_free = true)::int as free_count
                from relevant_features
                group by wedge
                order by feature_count desc, wedge asc
                """,
                (portal_id, portal_id, list(FAMILY_VENUE_TYPES)),
            )

            specials_summary = _fetch_all(
                cur,
                """
                with family_venues as (
                  select distinct e.venue_id
                  from portal_source_access psa
                  join events e on e.source_id = psa.source_id
                  where psa.portal_id = %s
                    and e.venue_id is not null
                    and coalesce(e.is_active, true) = true
                    and e.start_date >= current_date
                  union
                  select distinct venue_id
                  from programs
                  where portal_id = %s
                    and venue_id is not null
                    and status = 'active'
                )
                select
                  count(*)::int as active_specials,
                  count(*) filter (
                    where lower(
                      coalesce(s.title, '') || ' ' || coalesce(s.description, '') || ' ' || coalesce(s.price_note, '')
                    )
                      ~ '(free|discount|reduced|admission)'
                  )::int as free_or_low_cost_specials,
                  count(distinct s.venue_id)::int as special_venues
                from venue_specials s
                join family_venues fv on fv.venue_id = s.venue_id
                join venues v on v.id = s.venue_id
                where s.is_active = true
                  and v.venue_type = any(%s)
                """,
                (portal_id, portal_id, list(FAMILY_VENUE_TYPES)),
            )

            gap_candidates = _fetch_all(
                cur,
                """
                with family_activity as (
                  select
                    e.venue_id,
                    count(*)::int as family_events,
                    0::int as family_programs
                  from portal_source_access psa
                  join events e on e.source_id = psa.source_id
                  where psa.portal_id = %s
                    and e.venue_id is not null
                    and coalesce(e.is_active, true) = true
                    and e.start_date >= current_date
                  group by e.venue_id
                  union all
                  select
                    p.venue_id,
                    0::int as family_events,
                    count(*)::int as family_programs
                  from programs p
                  where p.portal_id = %s
                    and p.venue_id is not null
                    and p.status = 'active'
                  group by p.venue_id
                )
                select
                  v.id as venue_id,
                  v.name,
                  v.slug,
                  coalesce(v.venue_type, 'unknown') as venue_type,
                  sum(a.family_events)::int as family_events,
                  sum(a.family_programs)::int as family_programs,
                  exists (
                    select 1
                    from venue_destination_details d
                    where d.venue_id = v.id
                  ) as has_destination_details,
                  exists (
                    select 1
                    from venue_features f
                    where f.venue_id = v.id
                      and f.is_active = true
                  ) as has_features,
                  exists (
                    select 1
                    from venue_specials s
                    where s.venue_id = v.id
                      and s.is_active = true
                  ) as has_specials
                from family_activity a
                join venues v on v.id = a.venue_id
                where v.venue_type = any(%s)
                group by v.id, v.name, v.slug, v.venue_type
                having not exists (
                  select 1
                  from venue_destination_details d
                  where d.venue_id = v.id
                )
                   or not exists (
                     select 1
                     from venue_features f
                     where f.venue_id = v.id
                       and f.is_active = true
                   )
                order by
                  sum(a.family_programs) desc,
                  sum(a.family_events) desc,
                  v.name asc
                limit 25
                """,
                (portal_id, portal_id, list(FAMILY_VENUE_TYPES)),
            )

            source_gap_candidates = _fetch_all(
                cur,
                """
                with family_rows as (
                  select
                    s.slug as source_slug,
                    s.name as source_name,
                    e.venue_id,
                    1 as event_count,
                    0 as program_count
                  from portal_source_access psa
                  join events e on e.source_id = psa.source_id
                  join sources s on s.id = e.source_id
                  where psa.portal_id = %s
                    and e.venue_id is not null
                    and coalesce(e.is_active, true) = true
                    and e.start_date >= current_date
                  union all
                  select
                    s.slug as source_slug,
                    s.name as source_name,
                    p.venue_id,
                    0 as event_count,
                    1 as program_count
                  from programs p
                  join sources s on s.id = p.source_id
                  where p.portal_id = %s
                    and p.venue_id is not null
                    and p.status = 'active'
                )
                select
                  fr.source_slug,
                  fr.source_name,
                  count(*)::int as family_rows,
                  count(distinct fr.venue_id)::int as venue_count,
                  count(distinct fr.venue_id) filter (
                    where exists (
                      select 1
                      from venue_destination_details d
                      where d.venue_id = fr.venue_id
                    )
                  )::int as venues_with_destination_details,
                  count(distinct fr.venue_id) filter (
                    where exists (
                      select 1
                      from venue_features f
                      where f.venue_id = fr.venue_id
                        and f.is_active = true
                    )
                  )::int as venues_with_features
                from family_rows fr
                join venues v on v.id = fr.venue_id
                where v.venue_type = any(%s)
                group by fr.source_slug, fr.source_name
                having count(*) >= 10
                order by family_rows desc, fr.source_slug asc
                limit 25
                """,
                (portal_id, portal_id, list(FAMILY_VENUE_TYPES)),
            )

            broad_map_systems = _fetch_all(
                cur,
                """
                with system_destinations as (
                  select
                    d.venue_id,
                    case
                      when d.metadata->>'source_slug' is not null then d.metadata->>'source_slug'
                      when d.metadata->>'jurisdiction' = 'cobb-county' then 'cobb-parks-family-map'
                      when d.metadata->>'jurisdiction' = 'dekalb-county' then 'dekalb-parks-family-map'
                      when d.metadata->>'jurisdiction' = 'gwinnett-county' then 'gwinnett-parks-family-map'
                      when d.metadata->>'source_type' = 'family_system_overlay'
                        and lower(coalesce(d.metadata->>'city', '')) = 'atlanta'
                        then 'atlanta-parks-family-map'
                      else null
                    end as system_slug
                  from venue_destination_details d
                  join venues v on v.id = d.venue_id
                  where v.venue_type = any(%s)
                    and (
                      d.metadata->>'source_slug' is not null
                      or d.metadata->>'jurisdiction' in ('cobb-county', 'dekalb-county', 'gwinnett-county')
                      or (
                        d.metadata->>'source_type' = 'family_system_overlay'
                        and lower(coalesce(d.metadata->>'city', '')) = 'atlanta'
                      )
                    )
                )
                select
                  sd.system_slug,
                  count(*)::int as destination_rows,
                  count(distinct sd.venue_id)::int as venue_count,
                  count(distinct sd.venue_id) filter (
                    where exists (
                      select 1
                      from venue_features f
                      where f.venue_id = sd.venue_id
                        and f.is_active = true
                    )
                  )::int as venues_with_features,
                  count(distinct sd.venue_id) filter (
                    where exists (
                      select 1
                      from venue_features f
                      where f.venue_id = sd.venue_id
                        and f.is_active = true
                        and lower(
                          coalesce(f.slug, '') || ' ' || coalesce(f.title, '') || ' ' || coalesce(f.description, '')
                        ) ~ '(splash|sprayground|spray|water play|play fountain|wading|pool|aquatic)'
                    )
                  )::int as water_play_venues,
                  count(distinct sd.venue_id) filter (
                    where exists (
                      select 1
                      from venue_features f
                      where f.venue_id = sd.venue_id
                        and f.is_active = true
                        and lower(
                          coalesce(f.slug, '') || ' ' || coalesce(f.title, '') || ' ' || coalesce(f.description, '')
                        ) ~ '(playground|play area|tot lot|nature play)'
                    )
                  )::int as playground_venues
                from system_destinations sd
                where sd.system_slug is not null
                group by sd.system_slug
                order by venue_count desc, sd.system_slug asc
                """,
                (list(FAMILY_VENUE_TYPES),),
            )
    finally:
        conn.close()

    summary = family_venue_summary[0] if family_venue_summary else {}
    detail = destination_detail_coverage[0] if destination_detail_coverage else {}
    specials = specials_summary[0] if specials_summary else {}

    return {
        "target": target,
        "portal": portal[0],
        "ok": True,
        "family_venue_summary": summary,
        "venue_type_breakdown": venue_type_breakdown,
        "city_breakdown": city_breakdown,
        "destination_detail_coverage": detail,
        "feature_wedges": feature_wedges,
        "specials_summary": specials,
        "gap_candidates": gap_candidates,
        "source_gap_candidates": source_gap_candidates,
        "broad_map_systems": broad_map_systems,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit Family destination-first content coverage on a target database.",
    )
    parser.add_argument(
        "--target",
        choices=("production", "staging"),
        default="production",
        help="Which database target to audit.",
    )
    parser.add_argument(
        "--portal-slug",
        default=DEFAULT_PORTAL_SLUG,
        help="Portal slug to audit (defaults to atlanta-families).",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit the report as JSON.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = build_report(args.target, args.portal_slug)

    if args.json:
        print(json.dumps(report, indent=2))
        return 0 if report.get("ok") else 1

    print(f"Family Destination Audit: {report.get('target')}")
    if "error" in report:
        print(f"ERROR: {report['error']}")
        return 1

    summary = report["family_venue_summary"]
    detail = report["destination_detail_coverage"]
    specials = report["specials_summary"]

    print(
        f"portal: {report['portal']['slug']} ({report['portal']['name']})"
    )
    print(
        "family venues: "
        f"{summary.get('venue_count', 0)} total, "
        f"{summary.get('target_type_count', 0)} target-type destinations"
    )
    print(
        "destination coverage: "
        f"{summary.get('with_destination_details', 0)} with destination_details, "
        f"{summary.get('with_features', 0)} with features, "
        f"{summary.get('with_specials', 0)} with specials"
    )
    print(
        "detail depth: "
        f"{detail.get('with_family_suitability', 0)} family_suitability, "
        f"{detail.get('with_parking_type', 0)} parking_type, "
        f"{detail.get('with_practical_notes', 0)} practical_notes, "
        f"{detail.get('with_weather_fit_tags', 0)} weather_fit_tags"
    )
    print(
        "specials: "
        f"{specials.get('active_specials', 0)} active, "
        f"{specials.get('free_or_low_cost_specials', 0)} free-or-low-cost"
    )

    print("top feature wedges:")
    for row in report["feature_wedges"][:8]:
        print(
            f"  - {row['wedge']}: {row['feature_count']} features across "
            f"{row['venue_count']} venues"
        )

    print("top metro cities:")
    for row in report["city_breakdown"][:10]:
        print(
            f"  - {row['city']}: {row['venue_count']} venues, "
            f"details={row['with_destination_details']}, "
            f"features={row['with_features']}"
        )

    print("top gap candidates:")
    for row in report["gap_candidates"][:10]:
        print(
            f"  - {row['name']} ({row['venue_type']}): "
            f"{row['family_programs']} programs, {row['family_events']} events, "
            f"details={row['has_destination_details']}, "
            f"features={row['has_features']}, specials={row['has_specials']}"
        )

    print("top source gap candidates:")
    for row in report["source_gap_candidates"][:10]:
        print(
            f"  - {row['source_slug']}: {row['family_rows']} family rows across "
            f"{row['venue_count']} venues, "
            f"details={row['venues_with_destination_details']}, "
            f"features={row['venues_with_features']}"
        )

    print("broad map systems:")
    for row in report.get("broad_map_systems", [])[:10]:
        print(
            f"  - {row['system_slug']}: {row['venue_count']} venues, "
            f"details={row['destination_rows']}, "
            f"features={row['venues_with_features']}, "
            f"water_play={row['water_play_venues']}, "
            f"playground={row['playground_venues']}"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
