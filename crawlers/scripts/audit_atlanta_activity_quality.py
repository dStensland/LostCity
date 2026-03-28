#!/usr/bin/env python3
"""
Audit the Atlanta-owned activity overlay layer and optionally write a markdown report.

Usage:
    python3 scripts/audit_atlanta_activity_quality.py
    python3 scripts/audit_atlanta_activity_quality.py --write-report
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from db import get_client  # noqa: E402
from seed_atlanta_activity_overlays import ATLANTA_ACTIVITY_OVERLAYS  # noqa: E402
from seed_atlanta_activity_overlays_wave2 import ATLANTA_ACTIVITY_OVERLAYS_WAVE2  # noqa: E402
from seed_atlanta_activity_overlays_urban_air import URBAN_AIR_ACTIVITY_OVERLAYS  # noqa: E402
from seed_atlanta_activity_overlays_wave3 import ATLANTA_ACTIVITY_OVERLAYS_WAVE3  # noqa: E402
from seed_atlanta_activity_overlays_wave4 import ATLANTA_ACTIVITY_OVERLAYS_WAVE4  # noqa: E402
from seed_atlanta_activity_overlays_wave5_catch_air import CATCH_AIR_OVERLAYS  # noqa: E402
from seed_atlanta_activity_overlays_wave6_family_fun import ATLANTA_ACTIVITY_OVERLAYS_WAVE6  # noqa: E402
from seed_atlanta_activity_overlays_wave7_family_outings import ATLANTA_ACTIVITY_OVERLAYS_WAVE7  # noqa: E402
from seed_atlanta_activity_overlays_wave8_water_farm_fun import ATLANTA_ACTIVITY_OVERLAYS_WAVE8  # noqa: E402
from seed_atlanta_activity_overlays_wave9_trampoline_and_farms import ATLANTA_ACTIVITY_OVERLAYS_WAVE9  # noqa: E402
from seed_atlanta_activity_overlays_wave10_destinations import ATLANTA_ACTIVITY_OVERLAYS_WAVE10  # noqa: E402


REPORT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "reports",
    f"atlanta_activity_quality_audit_{date.today().isoformat()}.md",
)

BRAND_GROUPS = {
    "sparkles": ["sparkles-family-fun-center-kennesaw", "sparkles-kennesaw"],
    "puttshack": [
        "puttshack",
        "puttshack-atlanta",
        "puttshack-atlanta-dunwoody",
        "puttshack-atlanta-midtown",
    ],
}

OVERLAY_MAPS = [
    ATLANTA_ACTIVITY_OVERLAYS,
    ATLANTA_ACTIVITY_OVERLAYS_WAVE2,
    URBAN_AIR_ACTIVITY_OVERLAYS,
    ATLANTA_ACTIVITY_OVERLAYS_WAVE3,
    ATLANTA_ACTIVITY_OVERLAYS_WAVE4,
    CATCH_AIR_OVERLAYS,
    ATLANTA_ACTIVITY_OVERLAYS_WAVE6,
    ATLANTA_ACTIVITY_OVERLAYS_WAVE7,
    ATLANTA_ACTIVITY_OVERLAYS_WAVE8,
    ATLANTA_ACTIVITY_OVERLAYS_WAVE9,
    ATLANTA_ACTIVITY_OVERLAYS_WAVE10,
]


def _target_slugs() -> list[str]:
    resolved = {
        "central-rock-gym-atlanta" if slug == "stone-summit" else slug
        for overlay_map in OVERLAY_MAPS
        for slug in overlay_map.keys()
    }
    return sorted(resolved)


def build_audit() -> dict:
    client = get_client()
    target_slugs = _target_slugs()
    venues = (
        client.table("places")
        .select("id,slug,name,city,website,place_type")
        .in_("slug", target_slugs)
        .execute()
        .data
    )
    by_id = {row["id"]: row for row in venues}
    features = (
        client.table("venue_features")
        .select("place_id,slug,title,feature_type,description,price_note,url,sort_order,is_active")
        .in_("venue_id", list(by_id.keys()))
        .eq("is_active", True)
        .execute()
        .data
    )

    weak_rows = []
    for venue in sorted(venues, key=lambda row: row["slug"]):
        issues = []
        website = venue.get("website")
        if not venue.get("city"):
            issues.append("missing_city")
        if not website:
            issues.append("missing_website")
        elif website.startswith("http://"):
            issues.append("http_url")
        if venue.get("place_type") in {"arena", "event_space"}:
            issues.append(f"weak_type={venue['venue_type']}")
        if issues:
            weak_rows.append(
                {
                    "slug": venue["slug"],
                    "place_type": venue.get("place_type"),
                    "city": venue.get("city"),
                    "website": website,
                    "issues": issues,
                }
            )

    counts = defaultdict(int)
    missing_price_rows = []
    for feature in features:
        venue_slug = by_id[feature["venue_id"]]["slug"]
        counts[venue_slug] += 1
        if not feature.get("price_note"):
            missing_price_rows.append(
                {
                    "venue_slug": venue_slug,
                    "slug": feature["slug"],
                    "title": feature["title"],
                }
            )

    duplicate_groups = {}
    for brand, slugs in BRAND_GROUPS.items():
        rows = (
            client.table("places")
            .select("slug,name,city,place_type,website,active")
            .in_("slug", slugs)
            .eq("is_active", True)
            .order("slug")
            .execute()
            .data
        )
        city_counts: defaultdict[str | None, int] = defaultdict(int)
        has_generic_shell = False
        for row in rows:
            city_counts[row.get("city")] += 1
            if not row.get("city"):
                has_generic_shell = True
        has_same_city_duplicates = any(count > 1 and city is not None for city, count in city_counts.items())
        if has_generic_shell or has_same_city_duplicates:
            duplicate_groups[brand] = rows

    return {
        "logical_target_count": len(target_slugs),
        "active_feature_row_count": len(features),
        "missing_url_rows": sum(1 for row in features if not row.get("url")),
        "missing_description_rows": sum(1 for row in features if not row.get("description")),
        "missing_price_rows": missing_price_rows,
        "weak_rows": weak_rows,
        "targets_not_three_rows": sorted(
            [{"slug": slug, "count": count} for slug, count in counts.items() if count != 3],
            key=lambda row: row["slug"],
        ),
        "duplicate_groups": duplicate_groups,
    }


def render_markdown(audit: dict) -> str:
    lines = [
        "# Atlanta Activity Quality Audit",
        "",
        f"Date: {date.today().isoformat()}",
        "Scope: Atlanta-owned activity overlay layer backing Hooky family federation",
        "",
        "## Current Snapshot",
        "",
        f"- Logical activity targets: `{audit['logical_target_count']}`",
        f"- Active `venue_features` rows: `{audit['active_feature_row_count']}`",
        f"- Missing feature URLs: `{audit['missing_url_rows']}`",
        f"- Missing feature descriptions: `{audit['missing_description_rows']}`",
        f"- Missing feature `price_note`: `{len(audit['missing_price_rows'])}`",
        f"- Weak venue rows: `{len(audit['weak_rows'])}`",
        f"- Targets not on the standard 3-row overlay shape: `{len(audit['targets_not_three_rows'])}`",
        "",
        "## Remaining Data Debt",
        "",
        "### Duplicate venue families",
        "",
    ]

    if audit["duplicate_groups"]:
        for brand, rows in audit["duplicate_groups"].items():
            lines.append(f"- `{brand}`")
            for row in rows:
                lines.append(
                    f"  - `{row['slug']}` | city=`{row.get('city')}` | type=`{row.get('place_type')}` | website=`{row.get('website')}`"
                )
    else:
        lines.append("- none")

    lines.extend(["", "### Missing price-note rows", ""])
    if audit["missing_price_rows"]:
        for row in audit["missing_price_rows"]:
            lines.append(f"- `{row['venue_slug']}` -> `{row['slug']}`")
    else:
        lines.append("- none")

    lines.extend(["", "### Weak venue rows", ""])
    if audit["weak_rows"]:
        for row in audit["weak_rows"]:
            lines.append(f"- `{row['slug']}` -> {', '.join(row['issues'])}")
    else:
        lines.append("- none")

    lines.extend(["", "### Targets not on the 3-row standard", ""])
    if audit["targets_not_three_rows"]:
        for row in audit["targets_not_three_rows"]:
            lines.append(f"- `{row['slug']}` -> `{row['count']}` active rows")
    else:
        lines.append("- none")

    lines.extend(
        [
            "",
            "## Recommendation",
            "",
            "The overlay layer is now structurally clean. The next quality gains should come from canonical venue cleanup and turning this audit into a routine scorecard after each major overlay change.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit the Atlanta activity overlay layer")
    parser.add_argument(
        "--write-report",
        action="store_true",
        help="Write the markdown report to crawlers/reports",
    )
    args = parser.parse_args()

    audit = build_audit()
    markdown = render_markdown(audit)
    print(markdown)

    if args.write_report:
        with open(REPORT_PATH, "w", encoding="utf-8") as handle:
            handle.write(markdown + "\n")
        print(f"\nWrote report to {REPORT_PATH}")


if __name__ == "__main__":
    main()
