#!/usr/bin/env python3
"""
Validate the portal federation rollout against a target database.

This checks the Phase 2 federation contract:
  - event and non-event materialized views exist
  - source sharing/subscription tables have entity-family columns
  - a few strategic portal/family combinations have live access rows

Usage:
  python3 database/validate_portal_federation_rollout.py --target production
  python3 database/validate_portal_federation_rollout.py --target staging
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

EXPECTED_MATVIEWS = {
    "portal_source_access",
    "portal_source_entity_access",
}

EXPECTED_SHARING_COLUMNS = {
    "shared_entity_families",
}

EXPECTED_SUBSCRIPTION_COLUMNS = {
    "subscribed_entity_families",
}

EXPECTED_LIVE_ACCESS = {
    ("atlanta-families", "programs"),
    ("arts-atlanta", "exhibitions"),
    ("arts-atlanta", "open_calls"),
    ("yonder", "destination_details"),
}

UNSUPPORTED_ENTITY_FAMILIES = {
    "opportunities",
}


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
            matviews = _fetch_all(
                cur,
                """
                select matviewname
                from pg_matviews
                where schemaname = 'public'
                  and matviewname in ('portal_source_access', 'portal_source_entity_access')
                order by matviewname
                """,
            )
            sharing_columns = _fetch_all(
                cur,
                """
                select column_name
                from information_schema.columns
                where table_schema='public'
                  and table_name='source_sharing_rules'
                  and column_name in ('shared_entity_families')
                order by column_name
                """,
            )
            subscription_columns = _fetch_all(
                cur,
                """
                select column_name
                from information_schema.columns
                where table_schema='public'
                  and table_name='source_subscriptions'
                  and column_name in ('subscribed_entity_families')
                order by column_name
                """,
            )
            live_access_rows = _fetch_all(
                cur,
                """
                select p.slug, psa.entity_family, count(*)::int as source_count
                from portal_source_entity_access psa
                join portals p on p.id = psa.portal_id
                where (p.slug, psa.entity_family) in (
                  ('atlanta-families', 'programs'),
                  ('arts-atlanta', 'exhibitions'),
                  ('arts-atlanta', 'open_calls'),
                  ('yonder', 'destination_details')
                )
                group by p.slug, psa.entity_family
                order by p.slug, psa.entity_family
                """,
            )
            unsupported_families = _fetch_all(
                cur,
                """
                with configured_families as (
                  select unnest(shared_entity_families) as entity_family
                  from source_sharing_rules
                  union all
                  select unnest(subscribed_entity_families) as entity_family
                  from source_subscriptions
                  union all
                  select entity_family
                  from portal_source_entity_access
                )
                select distinct entity_family
                from configured_families
                where entity_family in ('opportunities')
                order by entity_family
                """,
            )
    finally:
        conn.close()

    found_matviews = {row["matviewname"] for row in matviews}
    found_sharing_columns = {row["column_name"] for row in sharing_columns}
    found_subscription_columns = {row["column_name"] for row in subscription_columns}
    found_live_access = {
        (row["slug"], row["entity_family"]) for row in live_access_rows if row["source_count"] > 0
    }
    found_unsupported_families = {
        row["entity_family"] for row in unsupported_families
    }

    missing_matviews = sorted(EXPECTED_MATVIEWS - found_matviews)
    missing_sharing_columns = sorted(EXPECTED_SHARING_COLUMNS - found_sharing_columns)
    missing_subscription_columns = sorted(EXPECTED_SUBSCRIPTION_COLUMNS - found_subscription_columns)
    missing_live_access = sorted(EXPECTED_LIVE_ACCESS - found_live_access)
    unsupported_entity_families = sorted(
        found_unsupported_families & UNSUPPORTED_ENTITY_FAMILIES
    )

    ok = not (
        missing_matviews
        or missing_sharing_columns
        or missing_subscription_columns
        or missing_live_access
        or unsupported_entity_families
    )

    return {
        "target": target,
        "ok": ok,
        "matviews_found": sorted(found_matviews),
        "missing_matviews": missing_matviews,
        "sharing_columns_found": sorted(found_sharing_columns),
        "missing_sharing_columns": missing_sharing_columns,
        "subscription_columns_found": sorted(found_subscription_columns),
        "missing_subscription_columns": missing_subscription_columns,
        "live_access_rows": live_access_rows,
        "missing_live_access": [
            {"slug": slug, "entity_family": entity_family}
            for slug, entity_family in missing_live_access
        ],
        "unsupported_entity_families": unsupported_entity_families,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate the portal federation rollout on a target database.",
    )
    parser.add_argument(
        "--target",
        choices=("production", "staging"),
        default="production",
        help="Which database target to validate.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit JSON report.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = build_report(args.target)

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"Portal Federation Rollout Validation: {report['target']}")
        if "error" in report:
            print(f"ERROR: {report['error']}")
            if args.target == "staging":
                print("Staging is optional for this rollout; production is the canonical gate.")
            return 1
        print(f"matviews found: {report['matviews_found']}")
        print(f"missing matviews: {report['missing_matviews']}")
        print(f"sharing columns found: {report['sharing_columns_found']}")
        print(f"missing sharing columns: {report['missing_sharing_columns']}")
        print(f"subscription columns found: {report['subscription_columns_found']}")
        print(f"missing subscription columns: {report['missing_subscription_columns']}")
        print(f"live access rows: {report['live_access_rows']}")
        print(f"missing live access: {report['missing_live_access']}")
        print(f"unsupported entity families: {report['unsupported_entity_families']}")

    return 0 if report.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
