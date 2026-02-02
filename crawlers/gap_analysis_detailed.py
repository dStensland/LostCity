#!/usr/bin/env python3
"""
Detailed gap analysis comparing actual coverage vs. expected coverage.
Identifies missing neighborhoods, underrepresented areas, and missing major venues.
"""

from datetime import datetime
from collections import defaultdict

# Expected ITP neighborhoods from web/config/neighborhoods.ts
ITP_NEIGHBORHOODS = [
    # Tier 1: High activity cores
    "Downtown", "Midtown", "Buckhead", "Old Fourth Ward", "East Atlanta Village",
    "Little Five Points", "Decatur", "West Midtown", "Ponce City Market Area", "Krog Street",
    
    # Tier 2: Active neighborhoods
    "Virginia-Highland", "Inman Park", "Grant Park", "Cabbagetown", "Reynoldstown",
    "Kirkwood", "Candler Park", "Edgewood", "West End", "Atlantic Station",
    "Ansley Park", "Morningside", "Druid Hills", "East Lake", "Summerhill",
    
    # Tier 3: Residential-heavy
    "Lake Claire", "Ormewood Park", "Poncey-Highland", "Castleberry Hill", "Sweet Auburn",
    "Pittsburgh", "Mechanicsville", "Vine City", "English Avenue", "Grove Park",
    "Collier Hills", "Brookwood Hills", "Adair Park", "Capitol View", "Peoplestown",
]

# Major venues that should have crawlers
EXPECTED_MAJOR_VENUES = {
    # Major Arenas & Stadiums
    "State Farm Arena": "state-farm-arena",
    "Mercedes-Benz Stadium": "mercedes-benz-stadium",
    "Truist Park": "truist-park",
    "Gateway Center Arena": "gateway-center-arena",
    
    # Large Concert Venues
    "Fox Theatre": "fox-theatre",
    "Coca-Cola Roxy": "coca-cola-roxy",
    "Tabernacle": "tabernacle",
    "Variety Playhouse": "variety-playhouse",
    "Terminal West": "terminal-west",
    "The Masquerade": "the-masquerade",
    "The Earl": "the-earl",
    "Center Stage": "center-stage",
    "Buckhead Theatre": "buckhead-theatre",
    
    # Theaters
    "Alliance Theatre": "alliance-theatre",
    "Fox Theatre": "fox-theatre",
    "Aurora Theatre": "aurora-theatre",
    "Dad's Garage": "dads-garage",
    "Horizon Theatre": "horizon-theatre",
    "Actor's Express": "actors-express",
    "7 Stages": "seven-stages",
    "Shakespeare Tavern": "shakespeare-tavern",
    
    # Museums
    "High Museum": "high-museum",
    "Atlanta Botanical Garden": "atlanta-botanical-garden",
    "Fernbank Museum": "fernbank",
    "Atlanta History Center": "atlanta-history-center",
    "Children's Museum of Atlanta": "childrens-museum",
    "Center for Civil and Human Rights": "civil-rights-center",
    "World of Coca-Cola": "world-of-coca-cola",
    
    # Comedy Venues
    "Punchline Comedy Club": "punchline",
    "Laughing Skull Lounge": "laughing-skull",
    "Uptown Comedy Corner": "uptown-comedy",
    
    # OTP Major Venues
    "Ameris Bank Amphitheatre": "ameris-bank-amphitheatre",
    "Cobb Energy Performing Arts Centre": "cobb-energy",
    "Gas South Arena": "gas-south",
    "City Springs Theatre": "city-springs",
    "Sandy Springs Performing Arts Center": "sandy-springs-pac",
}

# Key OTP cities that should have coverage
OTP_CITIES = [
    # North Fulton
    {"name": "Alpharetta", "tier": "high", "notes": "Major dining/shopping destination"},
    {"name": "Roswell", "tier": "high", "notes": "Historic district, arts scene"},
    {"name": "Johns Creek", "tier": "medium", "notes": "Family-oriented, parks"},
    {"name": "Milton", "tier": "low", "notes": "Equestrian events, parks"},
    
    # Cobb
    {"name": "Marietta", "tier": "high", "notes": "Historic square, theaters, museums"},
    {"name": "Smyrna", "tier": "medium", "notes": "Market Village, Battery Atlanta"},
    {"name": "Kennesaw", "tier": "medium", "notes": "KSU, Civil War history"},
    {"name": "Acworth", "tier": "low", "notes": "Historic downtown"},
    
    # Gwinnett
    {"name": "Duluth", "tier": "high", "notes": "Downtown, Gas South Arena"},
    {"name": "Lawrenceville", "tier": "medium", "notes": "Historic square"},
    {"name": "Snellville", "tier": "low", "notes": "Community events"},
    {"name": "Suwanee", "tier": "medium", "notes": "Town Center, arts"},
    
    # DeKalb
    {"name": "Decatur", "tier": "high", "notes": "Major events hub, festivals"},
    {"name": "Tucker", "tier": "low", "notes": "Community events"},
    {"name": "Stone Mountain", "tier": "medium", "notes": "Park attractions"},
    
    # South Metro
    {"name": "College Park", "tier": "medium", "notes": "Airport district, Gateway Center"},
    {"name": "East Point", "tier": "medium", "notes": "Arts district"},
    {"name": "Union City", "tier": "low", "notes": "Community events"},
    {"name": "Fairburn", "tier": "low", "notes": "Historic downtown"},
]

def analyze_gaps():
    """Perform detailed gap analysis."""
    from db import get_client
    client = get_client()
    
    print("=" * 80)
    print("LOSTCITY DETAILED GAP ANALYSIS")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print()
    
    # Get actual neighborhood coverage
    result = client.table('events').select('venue_id, venues(neighborhood)').execute()
    covered_neighborhoods = set()
    neighborhood_event_counts = defaultdict(int)
    
    for event in (result.data or []):
        if event.get('venues') and event['venues'].get('neighborhood'):
            hood = event['venues']['neighborhood']
            covered_neighborhoods.add(hood)
            neighborhood_event_counts[hood] += 1
    
    # Gap 1: Missing ITP Neighborhoods
    print("GAP ANALYSIS: ITP NEIGHBORHOODS")
    print("=" * 80)
    print()
    
    missing_tier1 = []
    missing_tier2 = []
    missing_tier3 = []
    low_coverage_tier1 = []
    low_coverage_tier2 = []
    
    for hood in ITP_NEIGHBORHOODS[:10]:  # Tier 1
        count = neighborhood_event_counts.get(hood, 0)
        if count == 0:
            missing_tier1.append(hood)
        elif count < 10:
            low_coverage_tier1.append((hood, count))
    
    for hood in ITP_NEIGHBORHOODS[10:25]:  # Tier 2
        count = neighborhood_event_counts.get(hood, 0)
        if count == 0:
            missing_tier2.append(hood)
        elif count < 5:
            low_coverage_tier2.append((hood, count))
    
    for hood in ITP_NEIGHBORHOODS[25:]:  # Tier 3
        count = neighborhood_event_counts.get(hood, 0)
        if count == 0:
            missing_tier3.append(hood)
    
    print("CRITICAL - Tier 1 (High Activity) Neighborhoods:")
    print("-" * 80)
    if missing_tier1:
        print(f"MISSING ({len(missing_tier1)}):")
        for hood in missing_tier1:
            print(f"  - {hood}")
    if low_coverage_tier1:
        print(f"\nLOW COVERAGE (<10 events):")
        for hood, count in low_coverage_tier1:
            print(f"  - {hood}: {count} events")
    if not missing_tier1 and not low_coverage_tier1:
        print("  All Tier 1 neighborhoods have good coverage!")
    print()
    
    print("HIGH - Tier 2 (Active) Neighborhoods:")
    print("-" * 80)
    if missing_tier2:
        print(f"MISSING ({len(missing_tier2)}):")
        for hood in missing_tier2:
            print(f"  - {hood}")
    if low_coverage_tier2:
        print(f"\nLOW COVERAGE (<5 events):")
        for hood, count in low_coverage_tier2:
            print(f"  - {hood}: {count} events")
    print()
    
    print("MEDIUM - Tier 3 (Residential) Neighborhoods:")
    print("-" * 80)
    if missing_tier3:
        print(f"MISSING ({len(missing_tier3)}):")
        for hood in missing_tier3:
            print(f"  - {hood}")
    else:
        print("  All Tier 3 neighborhoods have some coverage.")
    print()
    
    # Gap 2: OTP City Coverage
    print("GAP ANALYSIS: OTP CITIES")
    print("=" * 80)
    print()
    
    result = client.table('events').select('venue_id, venues(city)').execute()
    city_event_counts = defaultdict(int)
    for event in (result.data or []):
        if event.get('venues') and event['venues'].get('city'):
            city_event_counts[event['venues']['city']] += 1
    
    high_tier_missing = []
    medium_tier_low = []
    
    for city_info in OTP_CITIES:
        city = city_info['name']
        tier = city_info['tier']
        count = city_event_counts.get(city, 0)
        
        if tier == "high" and count < 10:
            if count == 0:
                high_tier_missing.append((city, city_info['notes']))
            else:
                medium_tier_low.append((city, count, city_info['notes']))
        elif tier == "medium" and count < 5:
            medium_tier_low.append((city, count, city_info['notes']))
    
    print("CRITICAL - High-Tier OTP Cities with Low/No Coverage:")
    print("-" * 80)
    if high_tier_missing:
        print("MISSING:")
        for city, notes in high_tier_missing:
            print(f"  - {city}: {notes}")
    if medium_tier_low:
        print("\nLOW COVERAGE:")
        for city, count, notes in medium_tier_low:
            print(f"  - {city}: {count} events - {notes}")
    print()
    
    # Gap 3: Missing Major Venues
    print("GAP ANALYSIS: MAJOR VENUE CRAWLERS")
    print("=" * 80)
    print()
    
    # Get list of implemented sources
    sources_result = client.table('sources').select('slug, name, is_active').execute()
    implemented_sources = {s['slug']: s for s in (sources_result.data or [])}
    
    missing_venues = []
    inactive_venues = []
    
    for venue_name, expected_slug in EXPECTED_MAJOR_VENUES.items():
        if expected_slug not in implemented_sources:
            missing_venues.append((venue_name, expected_slug))
        elif not implemented_sources[expected_slug]['is_active']:
            inactive_venues.append((venue_name, expected_slug))
    
    if missing_venues:
        print("MISSING MAJOR VENUE CRAWLERS:")
        print("-" * 80)
        for venue, slug in missing_venues:
            print(f"  - {venue} (expected slug: {slug})")
        print()
    
    if inactive_venues:
        print("INACTIVE MAJOR VENUE CRAWLERS:")
        print("-" * 80)
        for venue, slug in inactive_venues:
            print(f"  - {venue} (slug: {slug})")
        print()
    
    # Gap 4: Category Analysis
    print("GAP ANALYSIS: EVENT CATEGORIES")
    print("=" * 80)
    print()
    
    result = client.table('events').select('category').execute()
    category_counts = defaultdict(int)
    total = 0
    for event in (result.data or []):
        cat = event.get('category') or 'uncategorized'
        category_counts[cat] += 1
        total += 1
    
    print("Category Distribution:")
    print("-" * 80)
    for cat in ['music', 'theater', 'comedy', 'art', 'film', 'sports', 'food', 'nightlife', 'community', 'family']:
        count = category_counts.get(cat, 0)
        pct = (count / total * 100) if total > 0 else 0
        status = "LOW" if pct < 5 else "OK"
        print(f"  {cat:<15} {count:>5} events ({pct:>5.1f}%) [{status}]")
    
    print()
    print("UNDERREPRESENTED CATEGORIES (<5%):")
    underrep = [(cat, count) for cat, count in category_counts.items() 
                if (count / total * 100) < 5 and cat not in ['uncategorized']]
    for cat, count in sorted(underrep, key=lambda x: x[1]):
        print(f"  - {cat}: {count} events")
    print()
    
    # Summary
    print("PRIORITIZED GAPS TO FILL")
    print("=" * 80)
    print()
    
    print("CRITICAL PRIORITY:")
    print("-" * 80)
    if missing_tier1:
        print(f"1. Add coverage for {len(missing_tier1)} Tier 1 neighborhoods")
        for hood in missing_tier1[:3]:
            print(f"   - {hood}")
    if high_tier_missing:
        print(f"2. Add crawlers for {len(high_tier_missing)} high-tier OTP cities")
        for city, notes in high_tier_missing[:3]:
            print(f"   - {city}: {notes}")
    print()
    
    print("HIGH PRIORITY:")
    print("-" * 80)
    if missing_tier2:
        print(f"1. Add coverage for {len(missing_tier2)} Tier 2 neighborhoods")
    if medium_tier_low:
        print(f"2. Improve coverage for {len(medium_tier_low)} underrepresented OTP cities")
    print()
    
    print("MEDIUM PRIORITY:")
    print("-" * 80)
    if missing_venues:
        print(f"1. Add {len(missing_venues)} missing major venue crawlers")
    print("2. Expand underrepresented event categories (music, sports, family)")
    print()

if __name__ == "__main__":
    analyze_gaps()
