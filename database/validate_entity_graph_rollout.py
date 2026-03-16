#!/usr/bin/env python3
"""
Validate the entity-graph rollout schema against a target database.

Usage:
  python3 database/validate_entity_graph_rollout.py --target production
  python3 database/validate_entity_graph_rollout.py --target staging

Staging is optional. If no staging database exists, production validation is
the canonical rollout gate.
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

EXPECTED_ENTITY_TABLES = {
    "exhibitions",
    "open_calls",
    "venue_destination_details",
}

EXPECTED_DESTINATION_DETAIL_COLUMNS = {
    "venue_id",
    "destination_type",
    "commitment_tier",
    "primary_activity",
    "best_seasons",
    "weather_fit_tags",
    "practical_notes",
    "family_suitability",
    "dog_friendly",
    "reservation_required",
    "permit_required",
    "fee_note",
    "source_url",
    "metadata",
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


def _fetch_all(cur: RealDictCursor, sql: str) -> list[dict]:
    cur.execute(sql)
    return [dict(row) for row in cur.fetchall()]


def build_report(target: str) -> dict:
    database_url, error = _database_url_for_target(target)
    if error:
        return {
            "target": target,
            "ok": False,
            "error": error,
        }

    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            organizations_id = _fetch_all(
                cur,
                """
                select column_name, data_type
                from information_schema.columns
                where table_schema='public'
                  and table_name='organizations'
                  and column_name='id'
                """,
            )
            entity_tables = _fetch_all(
                cur,
                """
                select table_name
                from information_schema.tables
                where table_schema='public'
                  and table_name in ('exhibitions', 'open_calls', 'venue_destination_details')
                order by table_name
                """,
            )
            programs_metadata = _fetch_all(
                cur,
                """
                select column_name, data_type
                from information_schema.columns
                where table_schema='public'
                  and table_name='programs'
                  and column_name='metadata'
                """,
            )
            destination_columns = _fetch_all(
                cur,
                """
                select column_name
                from information_schema.columns
                where table_schema='public'
                  and table_name='venue_destination_details'
                order by ordinal_position
                """,
            )
    finally:
        conn.close()

    found_tables = {row["table_name"] for row in entity_tables}
    found_destination_columns = {row["column_name"] for row in destination_columns}

    missing_tables = sorted(EXPECTED_ENTITY_TABLES - found_tables)
    missing_destination_columns = sorted(
        EXPECTED_DESTINATION_DETAIL_COLUMNS - found_destination_columns
    )

    ok = (
        bool(organizations_id)
        and bool(programs_metadata)
        and not missing_tables
        and not missing_destination_columns
    )

    return {
        "target": target,
        "ok": ok,
        "organizations_id": organizations_id,
        "entity_tables_found": sorted(found_tables),
        "missing_entity_tables": missing_tables,
        "programs_metadata": programs_metadata,
        "destination_detail_columns_found": sorted(found_destination_columns),
        "missing_destination_detail_columns": missing_destination_columns,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate the entity-graph rollout schema on a target database.",
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
        print(f"Entity Graph Rollout Validation: {report['target']}")
        if "error" in report:
            print(f"ERROR: {report['error']}")
            if args.target == "staging":
                print("Staging is optional for this rollout; production is the canonical gate.")
            return 1
        print(f"organizations.id: {report['organizations_id']}")
        print(f"entity tables found: {report['entity_tables_found']}")
        print(f"missing entity tables: {report['missing_entity_tables']}")
        print(f"programs.metadata: {report['programs_metadata']}")
        print(
            "missing destination detail columns: "
            f"{report['missing_destination_detail_columns']}"
        )

    return 0 if report.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
