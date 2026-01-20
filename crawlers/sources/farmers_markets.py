"""
Crawler for Atlanta Farmers Markets.
Generates recurring weekly events for each market based on their schedules.
"""

import logging
from datetime import datetime, timedelta

from db import get_venue_by_slug, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# Market schedules: (venue_slug, day_of_week (0=Mon), start_time, end_time, season_start, season_end, website)
# Season months are 1-12, None means year-round
MARKET_SCHEDULES = [
    {
        "venue_slug": "freedom-farmers-market",
        "name": "Freedom Farmers Market",
        "day_of_week": 5,  # Saturday
        "start_time": "08:30",
        "end_time": "12:00",
        "season_start": 3,  # March
        "season_end": 12,  # December
        "website": "https://freedomfarmersmkt.com",
        "description": "Shop 100+ vendors offering organic produce, pasture-raised meats, artisan cheeses, fresh bread, prepared foods, and more at Atlanta's largest organic farmers market.",
    },
    {
        "venue_slug": "grant-park-farmers-market",
        "name": "Grant Park Farmers Market",
        "day_of_week": 6,  # Sunday
        "start_time": "09:00",
        "end_time": "13:00",
        "season_start": 4,  # April
        "season_end": 11,  # November
        "website": "https://cfmatl.org/grant-park",
        "description": "Community farmers market featuring fresh local produce, baked goods, prepared foods, live music, and family activities in historic Grant Park.",
    },
    {
        "venue_slug": "piedmont-park-green-market",
        "name": "Piedmont Park Green Market",
        "day_of_week": 5,  # Saturday
        "start_time": "09:00",
        "end_time": "13:00",
        "season_start": None,  # Year-round
        "season_end": None,
        "website": "https://piedmontpark.org/green-market",
        "description": "Year-round Saturday market at Piedmont Park with Georgia-grown produce, local meats, artisan cheeses, baked goods, and prepared foods.",
    },
    {
        "venue_slug": "peachtree-road-farmers-market",
        "name": "Peachtree Road Farmers Market",
        "day_of_week": 5,  # Saturday
        "start_time": "08:00",
        "end_time": "12:00",
        "season_start": 4,  # April
        "season_end": 12,  # December
        "website": "https://peachtreeroadfarmersmarket.com",
        "description": "Buckhead's farmers market at the Cathedral of St. Philip featuring local farmers, artisan bakers, and specialty food vendors.",
    },
    {
        "venue_slug": "east-atlanta-village-farmers-market",
        "name": "East Atlanta Village Farmers Market",
        "day_of_week": 3,  # Thursday
        "start_time": "16:00",
        "end_time": "20:00",
        "season_start": 4,  # April
        "season_end": 10,  # October
        "website": "https://www.eastatlantavillage.com/farmers-market",
        "description": "Evening market in East Atlanta Village with local produce, prepared foods, crafts, and community vibes.",
    },
    {
        "venue_slug": "decatur-farmers-market",
        "name": "Decatur Farmers Market",
        "day_of_week": 2,  # Wednesday
        "start_time": "16:00",
        "end_time": "19:00",
        "season_start": 4,  # April
        "season_end": 11,  # November
        "website": "https://cfmatl.org/decatur",
        "description": "Award-winning farmers market in downtown Decatur with 50+ vendors offering produce, meats, dairy, baked goods, and more.",
    },
    {
        "venue_slug": "decatur-farmers-market",
        "name": "Decatur Farmers Market",
        "day_of_week": 5,  # Saturday (second market day)
        "start_time": "09:00",
        "end_time": "13:00",
        "season_start": 4,  # April
        "season_end": 11,  # November
        "website": "https://cfmatl.org/decatur",
        "description": "Award-winning Saturday farmers market in downtown Decatur with 50+ vendors offering produce, meats, dairy, baked goods, and more.",
    },
    {
        "venue_slug": "morningside-farmers-market",
        "name": "Morningside Farmers Market",
        "day_of_week": 5,  # Saturday
        "start_time": "08:00",
        "end_time": "11:30",
        "season_start": 4,  # April
        "season_end": 11,  # November
        "website": "https://morningsidemarket.com",
        "description": "Neighborhood Saturday market featuring local and organic produce, artisan foods, and community gathering.",
    },
    {
        "venue_slug": "west-end-farmers-market",
        "name": "West End Farmers Market",
        "day_of_week": 5,  # Saturday
        "start_time": "10:00",
        "end_time": "14:00",
        "season_start": 5,  # May
        "season_end": 10,  # October
        "website": "https://www.communityfarmersmarkets.com",
        "description": "Community-focused market in historic West End offering fresh produce, prepared foods, and local crafts.",
    },
    {
        "venue_slug": "ponce-city-farmers-market",
        "name": "Ponce City Farmers Market",
        "day_of_week": 5,  # Saturday
        "start_time": "09:00",
        "end_time": "13:00",
        "season_start": 4,  # April
        "season_end": 10,  # October
        "website": "https://poncecitymarket.com",
        "description": "Seasonal farmers market at Ponce City Market on the Beltline featuring local vendors and fresh produce.",
    },
]

# Sweet Auburn Curb Market has different hours - it's a daily market
SWEET_AUBURN = {
    "venue_slug": "sweet-auburn-curb-market",
    "name": "Sweet Auburn Curb Market",
    "website": "https://sweetauburncurbmarket.com",
    "description": "Atlanta's original municipal market since 1924. Open daily with fresh produce, meats, seafood, and diverse food vendors.",
    # Open Mon-Sat 8am-6pm, varies by vendor
}


def is_in_season(market: dict, date: datetime) -> bool:
    """Check if a market is in season for the given date."""
    season_start = market.get("season_start")
    season_end = market.get("season_end")

    if season_start is None and season_end is None:
        return True  # Year-round

    month = date.month

    if season_start <= season_end:
        return season_start <= month <= season_end
    else:
        # Wraps around year (e.g., Nov-Feb)
        return month >= season_start or month <= season_end


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    """Get the next occurrence of a specific weekday."""
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def generate_market_events(market: dict, weeks_ahead: int = 8) -> list[dict]:
    """Generate recurring events for a farmers market."""
    events = []
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    # Find the next occurrence of this market's day
    next_date = get_next_weekday(today, market["day_of_week"])

    for _ in range(weeks_ahead):
        if is_in_season(market, next_date):
            events.append(
                {
                    "venue_slug": market["venue_slug"],
                    "title": market["name"],
                    "description": market["description"],
                    "start_date": next_date.strftime("%Y-%m-%d"),
                    "start_time": market["start_time"],
                    "end_time": market["end_time"],
                    "source_url": market["website"],
                    "is_free": True,
                }
            )
        next_date += timedelta(days=7)

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Generate farmers market events for the next several weeks."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        logger.info("Generating farmers market events")

        all_events = []

        # Generate events for each market
        for market in MARKET_SCHEDULES:
            market_events = generate_market_events(market, weeks_ahead=8)
            all_events.extend(market_events)
            logger.debug(f"Generated {len(market_events)} events for {market['name']}")

        logger.info(f"Generated {len(all_events)} total farmers market events")

        for event_data in all_events:
            events_found += 1

            # Get venue ID
            venue = get_venue_by_slug(event_data["venue_slug"])
            if not venue:
                logger.warning(f"Venue not found: {event_data['venue_slug']}")
                continue

            venue_id = venue["id"]
            venue_name = venue["name"]

            content_hash = generate_content_hash(
                event_data["title"], venue_name, event_data["start_date"]
            )

            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": event_data["title"],
                "description": event_data.get("description"),
                "start_date": event_data["start_date"],
                "start_time": event_data.get("start_time"),
                "end_date": event_data["start_date"],
                "end_time": event_data.get("end_time"),
                "is_all_day": False,
                "category": "food_drink",
                "subcategory": "farmers_market",
                "category_id": "food_drink",
                "subcategory_id": "farmers_market",
                "tags": [
                    "farmers market",
                    "local",
                    "produce",
                    "outdoor",
                    "family-friendly",
                ],
                "price_min": None,
                "price_max": None,
                "price_note": "Free admission",
                "is_free": True,
                "source_url": event_data["source_url"],
                "ticket_url": None,
                "image_url": None,
                "raw_text": None,
                "extraction_confidence": 1.0,  # We know this data is accurate
                "is_recurring": True,
                "recurrence_rule": "FREQ=WEEKLY",
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.debug(
                    f"Added: {event_data['title']} on {event_data['start_date']}"
                )
            except Exception as e:
                logger.error(f"Failed to insert: {event_data['title']}: {e}")

    except Exception as e:
        logger.error(f"Failed to generate farmers market events: {e}")
        raise

    return events_found, events_new, events_updated
