"""
Data Health Diagnostic Script for LostCity
Generates comprehensive health reports for all entity types in the database.
"""

import sys
from typing import Optional, Dict, List, Tuple
from datetime import datetime
from db import get_client

# Color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def colorize(text: str, score: float) -> str:
    """Color-code text based on score (0-100)."""
    if score >= 80:
        return f"{Colors.GREEN}{text}{Colors.END}"
    elif score >= 50:
        return f"{Colors.YELLOW}{text}{Colors.END}"
    else:
        return f"{Colors.RED}{text}{Colors.END}"

def print_header(title: str):
    """Print a formatted section header."""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{title.center(80)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*80}{Colors.END}\n")

def print_subheader(title: str):
    """Print a formatted subsection header."""
    print(f"\n{Colors.BOLD}{title}{Colors.END}")
    print(f"{'-'*80}")

def get_total_count(client, table: str, filter_condition: Optional[Dict] = None) -> int:
    """Get total count for a table with optional filter."""
    try:
        query = client.table(table).select("id", count="exact")
        if filter_condition:
            for key, value in filter_condition.items():
                query = query.eq(key, value)
        result = query.limit(1).execute()
        return result.count or 0
    except Exception as e:
        print(f"Error counting {table}: {e}")
        return 0

def get_field_fill_rate(client, table: str, field: str, filter_condition: Optional[Dict] = None, exclude_filter: Optional[Dict] = None) -> float:
    """Get fill rate (0-100) for a specific field."""
    try:
        # Get total count
        total_query = client.table(table).select("id", count="exact")
        if filter_condition:
            for key, value in filter_condition.items():
                total_query = total_query.eq(key, value)
        if exclude_filter:
            for key, value in exclude_filter.items():
                total_query = total_query.neq(key, value)
        total_result = total_query.limit(1).execute()
        total = total_result.count or 0

        if total == 0:
            return 0.0

        # Get filled count (not null)
        filled_query = client.table(table).select("id", count="exact").not_.is_(field, "null")
        if filter_condition:
            for key, value in filter_condition.items():
                filled_query = filled_query.eq(key, value)
        if exclude_filter:
            for key, value in exclude_filter.items():
                filled_query = filled_query.neq(key, value)
        filled_result = filled_query.limit(1).execute()
        filled = filled_result.count or 0

        return (filled / total) * 100
    except Exception as e:
        print(f"Error calculating fill rate for {table}.{field}: {e}")
        return 0.0

def print_tag_health(client, table="events", filter_condition=None):
    """Analyze tag coverage quality for events."""
    print_subheader("Tag Health")

    query = client.table(table).select("tags, genres, category, is_class")
    if filter_condition:
        for key, value in filter_condition.items():
            query = query.eq(key, value)
    sample = query.limit(2000).execute()
    rows = sample.data or []
    total = len(rows)

    if total == 0:
        print("  No data available")
        return

    EXPERIENTIAL = {"date-night", "chill", "high-energy", "intimate", "rowdy"}

    has_tags = sum(1 for r in rows if r.get("tags"))
    has_3_plus = sum(1 for r in rows if r.get("tags") and len(r["tags"]) >= 3)
    has_exp = sum(1 for r in rows if r.get("tags") and set(r["tags"]) & EXPERIENTIAL)
    has_genres = sum(1 for r in rows if r.get("genres"))

    print(f"  Sample size:              {total}")
    print(f"  With any tags:            {has_tags/total*100:.1f}%")
    print(f"  With 3+ tags:             {has_3_plus/total*100:.1f}%")
    print(f"  With experiential tags:   {has_exp/total*100:.1f}%")
    print(f"  With genres:              {has_genres/total*100:.1f}%")


def check_venues_health(client) -> Dict:
    """Check health metrics for venues table."""
    print_header("DESTINATIONS (Venues) Health Report")

    total = get_total_count(client, "venues")
    print(f"Total venues: {total}")

    if total == 0:
        print("No venues found in database.")
        return {"score": 0, "total": 0}

    # Define field weights (must sum to 100)
    field_weights = {
        "name": 10,
        "slug": 10,
        "address": 10,
        "neighborhood": 8,
        "city": 8,
        "state": 5,
        "zip": 5,
        "lat": 12,
        "lng": 12,
        "venue_type": 10,
        "website": 7,
        "image_url": 8,
        "description": 5,
    }

    print_subheader("Field Fill Rates")

    fill_rates = {}
    weighted_score = 0.0

    for field, weight in field_weights.items():
        rate = get_field_fill_rate(client, "venues", field)
        fill_rates[field] = rate
        weighted_score += (rate * weight / 100)

        rate_str = f"{rate:.1f}%".rjust(6)
        colored_rate = colorize(rate_str, rate)
        print(f"  {field.ljust(20)} {colored_rate}")

    print_subheader("Quality Issues")

    # Missing coordinates
    missing_coords = total - get_total_count(client, "venues")  # placeholder
    try:
        coords_query = client.table("venues").select("id", count="exact")
        coords_query = coords_query.or_("lat.is.null,lng.is.null")
        coords_result = coords_query.limit(1).execute()
        missing_coords = coords_result.count or 0
    except Exception as e:
        print(f"  Error checking coordinates: {e}")

    print(f"  Missing coordinates (lat/lng): {missing_coords}")

    # Missing images
    missing_images = total - int(total * fill_rates.get("image_url", 0) / 100)
    print(f"  Missing images: {missing_images}")

    # Missing venue_type
    missing_type = total - int(total * fill_rates.get("venue_type", 0) / 100)
    print(f"  Missing venue_type: {missing_type}")

    # Missing neighborhood
    missing_neighborhood = total - int(total * fill_rates.get("neighborhood", 0) / 100)
    print(f"  Missing neighborhood: {missing_neighborhood}")

    # Missing description
    missing_description = total - int(total * fill_rates.get("description", 0) / 100)
    print(f"  Missing description: {missing_description}")

    print_subheader("Overall Health Score")
    score_str = f"{weighted_score:.1f}/100"
    colored_score = colorize(score_str, weighted_score)
    print(f"  Venues Health Score: {colored_score}")

    return {
        "score": weighted_score,
        "total": total,
        "fill_rates": fill_rates,
        "issues": {
            "missing_coords": missing_coords,
            "missing_images": missing_images,
            "missing_type": missing_type,
            "missing_neighborhood": missing_neighborhood,
        }
    }

def check_events_health(client) -> Dict:
    """Check health metrics for events table."""
    print_header("EVENTS Health Report")

    total = get_total_count(client, "events")
    print(f"Total events: {total}")

    if total == 0:
        print("No events found in database.")
        return {"score": 0, "total": 0}

    # Count future vs past events
    today = datetime.now().strftime("%Y-%m-%d")
    future_events = 0
    past_events = 0

    try:
        future_result = client.table("events").select("id", count="exact").gte("start_date", today).limit(1).execute()
        future_events = future_result.count or 0

        past_result = client.table("events").select("id", count="exact").lt("start_date", today).limit(1).execute()
        past_events = past_result.count or 0
    except Exception as e:
        print(f"Error counting future/past events: {e}")

    print(f"Future events: {future_events}")
    print(f"Past events: {past_events}")

    # Define field weights for events
    field_weights = {
        "title": 15,
        "description": 12,
        "start_date": 15,
        "start_time": 8,
        "venue_id": 12,
        "category": 10,
        "image_url": 10,
        "source_url": 8,
        "is_free": 5,
        "price_min": 3,
        "price_max": 2,
    }

    print_subheader("Field Fill Rates")

    fill_rates = {}
    weighted_score = 0.0

    for field, weight in field_weights.items():
        rate = get_field_fill_rate(client, "events", field)
        fill_rates[field] = rate
        weighted_score += (rate * weight / 100)

        rate_str = f"{rate:.1f}%".rjust(6)
        colored_rate = colorize(rate_str, rate)
        print(f"  {field.ljust(20)} {colored_rate}")

    print_subheader("Quality Issues")

    # Missing venues
    missing_venue = total - int(total * fill_rates.get("venue_id", 0) / 100)
    print(f"  Missing venue_id: {missing_venue}")

    # Missing descriptions
    missing_description = total - int(total * fill_rates.get("description", 0) / 100)
    print(f"  Missing descriptions: {missing_description}")

    # Missing images
    missing_images = total - int(total * fill_rates.get("image_url", 0) / 100)
    print(f"  Missing images: {missing_images}")

    # Missing category
    missing_category = total - int(total * fill_rates.get("category", 0) / 100)
    print(f"  Missing category: {missing_category}")

    print_tag_health(client, "events")

    print_subheader("Overall Health Score")
    score_str = f"{weighted_score:.1f}/100"
    colored_score = colorize(score_str, weighted_score)
    print(f"  Events Health Score: {colored_score}")

    return {
        "score": weighted_score,
        "total": total,
        "future": future_events,
        "past": past_events,
        "fill_rates": fill_rates,
    }

def check_classes_health(client) -> Dict:
    """Check health metrics for classes (events where is_class=true)."""
    print_header("CLASSES Health Report")

    total = get_total_count(client, "events", {"is_class": True})
    print(f"Total classes: {total}")

    if total == 0:
        print("No classes found in database.")
        return {"score": 0, "total": 0}

    # Define field weights for classes (focusing on class-specific fields)
    field_weights = {
        "title": 15,
        "description": 15,
        "start_date": 15,
        "venue_id": 15,
        "category": 10,
        "image_url": 10,
        "price_min": 10,
        "is_free": 10,
    }

    print_subheader("Field Fill Rates")

    fill_rates = {}
    weighted_score = 0.0

    for field, weight in field_weights.items():
        rate = get_field_fill_rate(client, "events", field, {"is_class": True})
        fill_rates[field] = rate
        weighted_score += (rate * weight / 100)

        rate_str = f"{rate:.1f}%".rjust(6)
        colored_rate = colorize(rate_str, rate)
        print(f"  {field.ljust(20)} {colored_rate}")

    print_tag_health(client, "events", {"is_class": True})

    print_subheader("Overall Health Score")
    score_str = f"{weighted_score:.1f}/100"
    colored_score = colorize(score_str, weighted_score)
    print(f"  Classes Health Score: {colored_score}")

    return {
        "score": weighted_score,
        "total": total,
        "fill_rates": fill_rates,
    }

def check_series_health(client) -> Dict:
    """Check health metrics for series table.

    Excludes festival_program series from scoring — those are internal
    modeling constructs (not user-discoverable) and would drag down the
    score with their intentionally sparse data.
    """
    print_header("SERIES Health Report")

    # Exclude festival_program — they're backend scaffolding, not discoverable
    total_all = get_total_count(client, "series")
    total_festival = get_total_count(client, "series", {"series_type": "festival_program"})
    total = total_all - total_festival
    print(f"Total series: {total}  (excludes {total_festival} festival programs)")

    if total == 0:
        print("No series found in database.")
        return {"score": 0, "total": 0}

    # Define field weights for series
    field_weights = {
        "title": 20,
        "series_type": 20,
        "description": 15,
        "image_url": 15,
        "category": 10,
        "genres": 20,
    }

    print_subheader("Field Fill Rates")

    fill_rates = {}
    weighted_score = 0.0

    for field, weight in field_weights.items():
        rate = get_field_fill_rate(client, "series", field, exclude_filter={"series_type": "festival_program"})
        fill_rates[field] = rate
        weighted_score += (rate * weight / 100)

        rate_str = f"{rate:.1f}%".rjust(6)
        colored_rate = colorize(rate_str, rate)
        print(f"  {field.ljust(20)} {colored_rate}")

    print_subheader("Overall Health Score")
    score_str = f"{weighted_score:.1f}/100"
    colored_score = colorize(score_str, weighted_score)
    print(f"  Series Health Score: {colored_score}")

    return {
        "score": weighted_score,
        "total": total,
        "fill_rates": fill_rates,
    }

def check_organizations_health(client) -> Dict:
    """Check health metrics for organizations table."""
    print_header("ORGANIZATIONS Health Report")

    total = get_total_count(client, "organizations")
    print(f"Total organizations: {total}")

    if total == 0:
        print("No organizations found in database.")
        return {"score": 0, "total": 0}

    # Define field weights for organizations
    field_weights = {
        "name": 15,
        "slug": 15,
        "description": 15,
        "org_type": 10,
        "city": 10,
        "website": 15,
        "logo_url": 10,
        "address": 5,
        "neighborhood": 5,
    }

    print_subheader("Field Fill Rates")

    fill_rates = {}
    weighted_score = 0.0

    for field, weight in field_weights.items():
        rate = get_field_fill_rate(client, "organizations", field)
        fill_rates[field] = rate
        weighted_score += (rate * weight / 100)

        rate_str = f"{rate:.1f}%".rjust(6)
        colored_rate = colorize(rate_str, rate)
        print(f"  {field.ljust(20)} {colored_rate}")

    print_subheader("Quality Issues")

    # Missing websites
    missing_website = total - int(total * fill_rates.get("website", 0) / 100)
    print(f"  Missing websites: {missing_website}")

    # Missing descriptions
    missing_description = total - int(total * fill_rates.get("description", 0) / 100)
    print(f"  Missing descriptions: {missing_description}")

    # Missing logo
    missing_logo = total - int(total * fill_rates.get("logo_url", 0) / 100)
    print(f"  Missing logo: {missing_logo}")

    print_subheader("Overall Health Score")
    score_str = f"{weighted_score:.1f}/100"
    colored_score = colorize(score_str, weighted_score)
    print(f"  Organizations Health Score: {colored_score}")

    return {
        "score": weighted_score,
        "total": total,
        "fill_rates": fill_rates,
    }

def check_festivals_health(client) -> Dict:
    """Check health metrics for festivals table."""
    print_header("FESTIVALS Health Report")

    total = get_total_count(client, "festivals")
    print(f"Total festivals: {total}")

    if total == 0:
        print("No festivals found in database.")
        return {"score": 0, "total": 0}

    # Check what columns exist in festivals table
    try:
        sample = client.table("festivals").select("*").limit(1).execute()
        available_fields = list(sample.data[0].keys()) if sample.data else []
        print(f"Available festival fields: {', '.join(available_fields)}")
    except Exception as e:
        print(f"Error fetching festival schema: {e}")
        return {"score": 0, "total": total}

    # Define field weights based on typical festival fields
    field_weights = {
        "name": 20,
        "slug": 15,
        "description": 15,
        "start_date": 15,
        "end_date": 10,
        "website": 10,
        "image_url": 10,
        "city": 5,
    }

    # Only check fields that exist
    field_weights = {k: v for k, v in field_weights.items() if k in available_fields}

    # Renormalize weights to sum to 100
    total_weight = sum(field_weights.values())
    if total_weight > 0:
        field_weights = {k: (v / total_weight) * 100 for k, v in field_weights.items()}

    print_subheader("Field Fill Rates")

    fill_rates = {}
    weighted_score = 0.0

    for field, weight in field_weights.items():
        rate = get_field_fill_rate(client, "festivals", field)
        fill_rates[field] = rate
        weighted_score += (rate * weight / 100)

        rate_str = f"{rate:.1f}%".rjust(6)
        colored_rate = colorize(rate_str, rate)
        print(f"  {field.ljust(20)} {colored_rate}")

    print_subheader("Overall Health Score")
    score_str = f"{weighted_score:.1f}/100"
    colored_score = colorize(score_str, weighted_score)
    print(f"  Festivals Health Score: {colored_score}")

    return {
        "score": weighted_score,
        "total": total,
        "fill_rates": fill_rates,
    }

def print_summary(results: Dict):
    """Print overall summary of all health checks."""
    print_header("OVERALL DATA HEALTH SUMMARY")

    print(f"{'Entity Type'.ljust(20)} {'Count'.rjust(10)} {'Health Score'.rjust(15)}")
    print('-' * 80)

    for entity_type, data in results.items():
        count = data.get("total", 0)
        score = data.get("score", 0)
        score_str = f"{score:.1f}/100"
        colored_score = colorize(score_str, score)
        print(f"{entity_type.ljust(20)} {str(count).rjust(10)} {colored_score.rjust(24)}")

    # Calculate overall system health
    total_score = sum(data.get("score", 0) for data in results.values())
    avg_score = total_score / len(results) if results else 0

    print('-' * 80)
    avg_score_str = f"{avg_score:.1f}/100"
    colored_avg = colorize(avg_score_str, avg_score)
    print(f"{'OVERALL SYSTEM HEALTH'.ljust(20)} {colored_avg.rjust(35)}")
    print()

def main():
    """Main execution function."""
    print(f"\n{Colors.BOLD}LostCity Data Health Diagnostic{Colors.END}")
    print(f"Run at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    try:
        client = get_client()
        print(f"{Colors.GREEN}✓ Connected to Supabase{Colors.END}")
    except Exception as e:
        print(f"{Colors.RED}✗ Failed to connect to Supabase: {e}{Colors.END}")
        sys.exit(1)

    results = {}

    # Run all health checks
    results["Venues"] = check_venues_health(client)
    results["Events"] = check_events_health(client)
    results["Classes"] = check_classes_health(client)
    results["Series"] = check_series_health(client)
    results["Organizations"] = check_organizations_health(client)
    results["Festivals"] = check_festivals_health(client)

    # Print summary
    print_summary(results)

    print(f"{Colors.GREEN}Data health diagnostic complete!{Colors.END}\n")

if __name__ == "__main__":
    main()
