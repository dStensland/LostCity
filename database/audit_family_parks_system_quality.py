#!/usr/bin/env python3
"""
Audit broad Family park-system import quality on a target database.

This focuses on the official system-level park map sources rather than the
portal-visible Family feed. It is intended to surface cleanup work such as:

- suspicious non-family rows (golf-only, etc.)
- missing addresses or cities
- rows without active features
- venue-type drift
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


def _fetch_all(cur: RealDictCursor, sql: str, params: tuple | None = None) -> list[dict]:
    cur.execute(sql, params or ())
    return [dict(row) for row in cur.fetchall()]


def build_report(target: str) -> dict:
    database_url, error = _database_url_for_target(target)
    if error:
        return {"target": target, "ok": False, "error": error}

    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            systems = _fetch_all(
                cur,
                """
                with system_rows as (
                  select
                    v.id as venue_id,
                    v.name,
                    v.slug,
                    v.address,
                    v.city,
                    v.venue_type,
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
                )
                select
                  system_slug,
                  count(*)::int as venue_count,
                  count(*) filter (where address is null or btrim(address) = '')::int as missing_address,
                  count(*) filter (where city is null or btrim(city) = '')::int as missing_city,
                  count(*) filter (where lower(name) ~ '(golf|disc golf)')::int as suspicious_golf,
                  count(*) filter (
                    where not exists (
                      select 1
                      from venue_features f
                      where f.venue_id = system_rows.venue_id
                        and f.is_active = true
                    )
                  )::int as venues_without_features
                from system_rows
                where system_slug is not null
                group by system_slug
                order by venue_count desc, system_slug asc
                """,
            )

            suspicious_rows = _fetch_all(
                cur,
                """
                with system_rows as (
                  select
                    v.id as venue_id,
                    v.name,
                    v.slug,
                    v.address,
                    v.city,
                    v.venue_type,
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
                )
                select
                  system_slug,
                  venue_id,
                  name,
                  slug,
                  address,
                  city,
                  venue_type
                from system_rows
                where system_slug is not null
                  and (
                    lower(name) ~ '(golf|disc golf)'
                    or address is null
                    or btrim(address) = ''
                    or city is null
                    or btrim(city) = ''
                  )
                order by system_slug asc, name asc
                """,
            )
    finally:
        conn.close()

    return {
        "target": target,
        "ok": True,
        "systems": systems,
        "suspicious_rows": suspicious_rows,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit broad Family park-system source quality.")
    parser.add_argument("--target", choices=("production", "staging"), default="production")
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = build_report(args.target)
    if args.json:
        print(json.dumps(report, indent=2))
        return 0 if report.get("ok") else 1

    if not report.get("ok"):
        print(f"ERROR: {report['error']}")
        return 1

    print(f"Family Parks System Quality Audit: {report['target']}")
    for row in report["systems"]:
        print(
            f"  - {row['system_slug']}: {row['venue_count']} venues, "
            f"missing_address={row['missing_address']}, missing_city={row['missing_city']}, "
            f"golf_rows={row['suspicious_golf']}, no_features={row['venues_without_features']}"
        )

    if report["suspicious_rows"]:
        print("suspicious rows:")
        for row in report["suspicious_rows"][:50]:
            print(
                f"  - {row['system_slug']}: {row['name']} | "
                f"{row['address'] or 'NO ADDRESS'} | {row['city'] or 'NO CITY'}"
            )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
