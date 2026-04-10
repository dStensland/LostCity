"""Flagship watchlist — defines the ~30 most important Atlanta sources and
alerts when any drops to 0 active events in the next 30 days.

This is the first line of defense against silent crawler failures.
Run standalone:  python3 watchlist.py
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Flagship source definitions
# ---------------------------------------------------------------------------

FLAGSHIP_SOURCES: list[dict] = [
    # Theater
    {"slug": "alliance-theatre", "name": "Alliance Theatre", "category": "theater", "min_events_30d": 5},
    {"slug": "dads-garage", "name": "Dad's Garage", "category": "theater", "min_events_30d": 10},
    {"slug": "7-stages", "name": "7 Stages", "category": "theater", "min_events_30d": 3},
    {"slug": "theatrical-outfit", "name": "Theatrical Outfit", "category": "theater", "min_events_30d": 5},
    {"slug": "horizon-theatre", "name": "Horizon Theatre", "category": "theater", "min_events_30d": 3},
    {"slug": "center-for-puppetry-arts", "name": "Center for Puppetry Arts", "category": "theater", "min_events_30d": 5},
    # Music
    {"slug": "terminal-west", "name": "Terminal West", "category": "music", "min_events_30d": 10},
    {"slug": "variety-playhouse", "name": "Variety Playhouse", "category": "music", "min_events_30d": 10},
    {"slug": "eddies-attic", "name": "Eddie's Attic", "category": "music", "min_events_30d": 15},
    {"slug": "tabernacle", "name": "Tabernacle", "category": "music", "min_events_30d": 8},
    {"slug": "the-masquerade", "name": "The Masquerade", "category": "music", "min_events_30d": 10},
    {"slug": "the-earl", "name": "The Earl", "category": "music", "min_events_30d": 8},
    {"slug": "city-winery-atlanta", "name": "City Winery Atlanta", "category": "music", "min_events_30d": 10},
    {"slug": "aisle5", "name": "Aisle 5", "category": "music", "min_events_30d": 8},
    {"slug": "the-eastern", "name": "The Eastern", "category": "music", "min_events_30d": 5},
    {"slug": "buckhead-theatre", "name": "Buckhead Theatre", "category": "music", "min_events_30d": 5},
    {"slug": "fox-theatre", "name": "Fox Theatre", "category": "music", "min_events_30d": 3},
    {"slug": "coca-cola-roxy", "name": "Coca-Cola Roxy", "category": "music", "min_events_30d": 5},
    # Film
    {"slug": "plaza-theatre", "name": "Plaza Theatre", "category": "film", "min_events_30d": 3},
    {"slug": "tara-theatre", "name": "Tara Theatre", "category": "film", "min_events_30d": 3},
    {"slug": "starlight-drive-in", "name": "Starlight Drive-In", "category": "film", "min_events_30d": 3},
    {"slug": "landmark-midtown", "name": "Landmark Midtown Art Cinema", "category": "film", "min_events_30d": 3},
    # Arts
    {"slug": "high-museum-of-art", "name": "High Museum of Art", "category": "arts", "min_events_30d": 5},
    {"slug": "atlanta-contemporary", "name": "Atlanta Contemporary", "category": "arts", "min_events_30d": 3},
    {"slug": "atlanta-botanical-garden", "name": "Atlanta Botanical Garden", "category": "arts", "min_events_30d": 5},
    # Family
    {"slug": "georgia-aquarium", "name": "Georgia Aquarium", "category": "family", "min_events_30d": 3},
    {"slug": "fernbank-museum", "name": "Fernbank Museum", "category": "family", "min_events_30d": 3},
    {"slug": "childrens-museum-of-atlanta", "name": "Children's Museum of Atlanta", "category": "family", "min_events_30d": 3},
    # Sports
    {"slug": "truist-park", "name": "Truist Park", "category": "sports", "min_events_30d": 5},
    {"slug": "state-farm-arena", "name": "State Farm Arena", "category": "sports", "min_events_30d": 3},
    # Civic
    {"slug": "hands-on-atlanta", "name": "Hands On Atlanta", "category": "civic", "min_events_30d": 20},
    {"slug": "atlanta-community-food-bank", "name": "Atlanta Community Food Bank", "category": "civic", "min_events_30d": 10},
]

# ---------------------------------------------------------------------------
# Alert dataclass
# ---------------------------------------------------------------------------


@dataclass
class WatchlistAlert:
    slug: str
    name: str
    category: str
    severity: str  # "critical" or "warning"
    expected_min: int
    actual_count: int
    message: str


# ---------------------------------------------------------------------------
# Database query
# ---------------------------------------------------------------------------


def _count_future_events(slug: str) -> int:
    """Count active events in the next 30 days for a source slug.

    Returns -1 if the source is not found in the database.
    Requires a live Supabase connection; not suitable for unit tests without
    monkeypatching.
    """
    from db.client import get_client

    client = get_client()

    # Resolve source id from slug
    source_resp = (
        client.table("sources")
        .select("id")
        .eq("slug", slug)
        .limit(1)
        .execute()
    )
    if not source_resp.data:
        logger.warning("watchlist: source slug '%s' not found in sources table", slug)
        return -1

    source_id = source_resp.data[0]["id"]

    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=30)

    resp = (
        client.table("events")
        .select("id", count="exact")
        .eq("source_id", source_id)
        .eq("is_active", True)
        .gte("start_date", now.strftime("%Y-%m-%d"))
        .lte("start_date", cutoff.strftime("%Y-%m-%d"))
        .execute()
    )
    return resp.count if resp.count is not None else 0


# ---------------------------------------------------------------------------
# Status check
# ---------------------------------------------------------------------------


def get_watchlist_status() -> list[WatchlistAlert]:
    """Check all flagship sources and return a list of WatchlistAlerts.

    - 0 events  -> severity "critical"
    - > 0 but < min -> severity "warning"
    - >= min    -> no alert
    """
    alerts: list[WatchlistAlert] = []

    for source in FLAGSHIP_SOURCES:
        slug = source["slug"]
        name = source["name"]
        category = source["category"]
        min_events = source["min_events_30d"]

        count = _count_future_events(slug)

        if count == 0:
            alerts.append(
                WatchlistAlert(
                    slug=slug,
                    name=name,
                    category=category,
                    severity="critical",
                    expected_min=min_events,
                    actual_count=count,
                    message=f"CRITICAL: {name} ({slug}) has 0 events in next 30 days",
                )
            )
        elif 0 < count < min_events:
            alerts.append(
                WatchlistAlert(
                    slug=slug,
                    name=name,
                    category=category,
                    severity="warning",
                    expected_min=min_events,
                    actual_count=count,
                    message=(
                        f"WARNING: {name} ({slug}) has {count} events "
                        f"(expected >= {min_events}) in next 30 days"
                    ),
                )
            )
        # count >= min_events or count == -1 (source not found) -> no alert

    return alerts


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    print(f"Checking {len(FLAGSHIP_SOURCES)} flagship sources...\n")
    alerts = get_watchlist_status()

    if not alerts:
        print("All flagship sources are healthy.")
    else:
        for alert in alerts:
            print(alert.message)

    criticals = [a for a in alerts if a.severity == "critical"]
    warnings = [a for a in alerts if a.severity == "warning"]
    print(f"\n{len(criticals)} critical, {len(warnings)} warnings, "
          f"{len(FLAGSHIP_SOURCES) - len(alerts)} healthy")
