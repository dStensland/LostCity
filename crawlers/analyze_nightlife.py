"""
Analyze nightlife events coverage in the database.
Identify gaps in new nightlife subcategories and recommend sources to fill them.
"""

import sys
from datetime import datetime, timedelta
from collections import Counter, defaultdict
from db import get_client

def analyze_nightlife():
    """Analyze nightlife event coverage and identify gaps."""
    client = get_client()
    today = datetime.now().strftime("%Y-%m-%d")
    
    print("=" * 80)
    print("NIGHTLIFE DATA DIAGNOSTIC")
    print("=" * 80)
    print()
    
    # 1. Events with category='nightlife'
    print("1. EVENTS WITH CATEGORY='nightlife'")
    print("-" * 80)
    
    nightlife_events = client.table("events").select(
        "id,title,start_date,tags,genres,venue_id"
    ).eq("category", "nightlife").gte("start_date", today).execute()
    
    print(f"Total nightlife events (future): {len(nightlife_events.data)}")
    
    # Count by genre (subcategory)
    genre_counts = Counter()
    for event in nightlife_events.data:
        genres = event.get("genres") or []
        if genres:
            for genre in genres:
                genre_counts[genre] += 1
        else:
            genre_counts["(no genres)"] += 1
    
    print("\nGenre breakdown:")
    for genre, count in sorted(genre_counts.items(), key=lambda x: -x[1]):
        print(f"  {genre}: {count}")
    
    print()
    
    # 2. Nightlife mode compound filter
    print("2. NIGHTLIFE MODE COMPOUND FILTER")
    print("-" * 80)
    
    # Get nightlife venue types
    nightlife_venue_types = [
        "bar", "club", "nightclub", "lounge", "rooftop", "karaoke",
        "sports_bar", "brewery", "cocktail_bar", "wine_bar"
    ]
    
    # Get venue IDs with nightlife types
    venues_result = client.table("venues").select("id,name,venue_type").in_(
        "venue_type", nightlife_venue_types
    ).execute()
    
    nightlife_venue_ids = [v["id"] for v in venues_result.data]
    print(f"Nightlife venues: {len(nightlife_venue_ids)}")
    
    # Events at nightlife venues OR starting after 7pm
    compound_events = client.table("events").select(
        "id,title,category,start_time,venue_id,genres"
    ).gte("start_date", today).or_(
        f"venue_id.in.({','.join(map(str, nightlife_venue_ids))}),start_time.gte.19:00:00"
    ).in_("category", ["music", "comedy", "dance", "gaming", "nightlife"]).execute()
    
    print(f"Events captured by nightlife_mode filter: {len(compound_events.data)}")
    
    category_counts = Counter(e.get("category") for e in compound_events.data)
    print("\nCategory breakdown:")
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")
    
    print()
    
    # 3. Venue type analysis
    print("3. VENUE TYPE ANALYSIS")
    print("-" * 80)
    
    venue_type_counts = Counter(v.get("venue_type") for v in venues_result.data)
    print("Nightlife venue type counts:")
    for vtype, count in sorted(venue_type_counts.items(), key=lambda x: -x[1]):
        print(f"  {vtype}: {count}")
    
    print()
    
    # 4. Nightlife crawler sources
    print("4. NIGHTLIFE CRAWLER SOURCES")
    print("-" * 80)
    
    sources_result = client.table("sources").select(
        "id,name,slug,is_active"
    ).execute()
    
    # Check which sources have events with nightlife category or genres
    nightlife_sources = set()
    for event in nightlife_events.data:
        source_result = client.table("events").select("source_id").eq("id", event["id"]).single().execute()
        if source_result.data:
            nightlife_sources.add(source_result.data["source_id"])
    
    active_nightlife_sources = []
    for source in sources_result.data:
        if source["id"] in nightlife_sources and source.get("is_active"):
            active_nightlife_sources.append(source)
    
    print(f"Active sources producing nightlife events: {len(active_nightlife_sources)}")
    if active_nightlife_sources:
        print("\nTop nightlife sources:")
        for source in active_nightlife_sources[:20]:
            print(f"  - {source['name']} ({source['slug']})")
    
    print()
    
    # 5. GAP ANALYSIS for new subcategories
    print("5. GAP ANALYSIS - NEW SUBCATEGORIES")
    print("-" * 80)
    
    new_subcategories = {
        "dj": "DJ sets and dance music nights",
        "drag": "Drag shows and performances",
        "trivia": "Trivia nights",
        "karaoke": "Karaoke nights",
        "bar-games": "Darts, pool, cornhole, etc.",
        "poker": "Poker nights and tournaments",
        "party": "General dance parties and themed nights",
        "bingo": "Bingo nights",
        "pub-crawl": "Organized pub crawls",
        "specials": "Happy hour, taco tuesday, wing nights, etc.",
        "latin-night": "Latin dance nights, salsa, bachata",
        "line-dancing": "Country line dancing nights",
        "strip": "Strip clubs and adult entertainment",
        "burlesque": "Burlesque shows",
        "lifestyle": "Lifestyle/alternative events",
        "revue": "Variety shows and cabaret"
    }
    
    print("Subcategory coverage (events with genre in genres[]):")
    gaps = []
    for subcat, description in new_subcategories.items():
        # Count events with this genre
        events_with_genre = [
            e for e in nightlife_events.data 
            if subcat in (e.get("genres") or [])
        ]
        count = len(events_with_genre)
        print(f"  {subcat}: {count} events - {description}")
        if count < 5:
            gaps.append((subcat, description, count))
    
    print()
    
    # 6. RECOMMENDATIONS
    print("6. RECOMMENDATIONS - ATLANTA VENUES/SOURCES TO FILL GAPS")
    print("-" * 80)
    
    recommendations = {
        "bingo": [
            "Sister Louisa's Church (weekly drag bingo)",
            "The Glenwood (bingo nights)",
            "Joystick Gamebar (bingo events)",
            "Blake's on the Park (drag bingo)"
        ],
        "pub-crawl": [
            "Atlanta Pub Crawl (organized events)",
            "Bar Crawl Nation Atlanta",
            "Midtown pub crawl events"
        ],
        "specials": [
            "General bar/restaurant crawl for recurring specials",
            "Trivia nights at various bars (many already covered)",
            "Happy hour specials (could be venue metadata rather than events)"
        ],
        "latin-night": [
            "Havana Club Atlanta (salsa nights)",
            "MJQ Concourse (latin nights)",
            "Opera Nightclub (reggaeton/latin nights)",
            "Tongue & Groove (latin saturdays)"
        ],
        "line-dancing": [
            "Wild Bill's (country bar in Duluth)",
            "Cowboys Concert Hall (country/line dancing)",
            "Buckhead Saloon (country nights)"
        ],
        "karaoke": [
            "10 Atlanta (karaoke bar Midtown)",
            "Trader Vic's (karaoke nights)",
            "Tongue & Groove (karaoke events)",
            "Various bars with weekly karaoke"
        ],
        "bar-games": [
            "The Painted Duck (bocce, darts, foosball)",
            "Ormsby's (bocce, skee-ball)",
            "Joystick Gamebar (arcade games)",
            "The Highlander (pool hall)",
            "Highland Tap (pool, darts)"
        ],
        "poker": [
            "Free poker leagues (Atlanta Poker Club)",
            "Freeroll Atlanta (already a source?)",
            "Various bars hosting weekly poker"
        ],
        "party": [
            "MJQ Concourse (dance parties)",
            "Believe Music Hall (EDM events)",
            "District Atlanta (nightclub events)",
            "Opera (nightclub parties)",
            "Gold Room (hip-hop nights)"
        ],
        "burlesque": [
            "The Jungle (burlesque shows)",
            "The Earl (burlesque events)",
            "Various venues hosting burlesque troupes"
        ],
        "strip": [
            "Adult entertainment venues (may need sensitivity flag)",
            "Clermont Lounge (iconic dive)",
            "Tattletale Lounge",
            "Pink Pony"
        ],
        "lifestyle": [
            "Trapeze Atlanta",
            "The Chamber (alternative/fetish events)",
            "Various alternative lifestyle venues"
        ]
    }
    
    for subcat, description, current_count in gaps:
        if subcat in recommendations:
            print(f"\n{subcat.upper()} (currently {current_count} events)")
            print(f"Description: {description}")
            print("Recommended sources:")
            for rec in recommendations[subcat]:
                print(f"  - {rec}")
    
    print()
    print("=" * 80)
    print("END OF DIAGNOSTIC")
    print("=" * 80)

if __name__ == "__main__":
    analyze_nightlife()
