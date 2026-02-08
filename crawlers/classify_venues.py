"""
Venue classification and cleanup script.

1. Deactivates junk entries (city names, placeholders, out-of-area)
2. Reclassifies organization-like types to 'organization'
3. Classifies untyped and 'venue' typed entries using rules + LLM
"""

import os
import re
import json
import time
import argparse
from typing import Optional
from collections import Counter
from dotenv import load_dotenv
from anthropic import Anthropic
from db import get_client
from config import get_config

load_dotenv()

# ─── DEACTIVATION RULES ─────────────────────────────────────────────────────

# Patterns that indicate junk venue names
JUNK_PATTERNS = [
    # City/state names used as venues
    r'^[\w\s]+,\s*(AL|AZ|CA|CO|CT|DE|FL|GA|HI|IA|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|NC|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|TN|TX|UT|VA|VT|WA|WI|WV)\.?$',
    # City, State full names
    r'^[\w\s]+,\s*(Alabama|Arizona|California|Colorado|Florida|Georgia|Hawaii|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Massachusetts|Maryland|Michigan|Minnesota|Mississippi|Missouri|Nebraska|New Jersey|New York|North Carolina|Ohio|Oklahoma|Oregon|Pennsylvania|South Carolina|Tennessee|Texas|Virginia|Washington)$',
    # Generic placeholders
    r'^(Online|Virtual Event|TBA|Unknown Venue|Event Location|Eventbrite|Farmers market)$',
    # Email-based "venues"
    r'^(email|Email)\s',
    r'^Online!\s',
    # "In Store" type placeholders
    r'^In Store$',
]
JUNK_REGEXES = [re.compile(p, re.IGNORECASE) for p in JUNK_PATTERNS]

# Specific venue names to deactivate
JUNK_NAMES = {
    "Solid Waste Services",
    "Wrigleyville's Best Bars (Full List Below)",
    "Auxiliary Office",
    "Beth Inman's residence",
    "Boardroom of the 1984 Building",
    "City Commission",
    "Historic Preservation Commission",
    "City Hall",
}

# Out-of-market cities (not Atlanta/Nashville metro)
OUT_OF_MARKET_CITIES = {
    "Brooklyn, NY", "New York, NY", "Philadelphia, PA", "Williamsport, Pennsylvania",
    "Mexico City, Mexico", "Dyersville, Iowa", "Dallas",
}


# ─── ORGANIZATION RECLASSIFICATION ──────────────────────────────────────────

# Types that should become 'organization'
ORG_TYPES = {"institution", "nonprofit", "government", "city", "neighborhood"}

# Types that need case-by-case review — skip auto-reclassification
# "retail" has some venues (Avalon, Lenox Square) and some non-venues (CVS, Home Depot)


# ─── VENUE TYPE MAPPING (rules-based) ────────────────────────────────────────

# Keywords in venue name → venue_type
NAME_TYPE_RULES = [
    # Bars/nightlife
    (r'\b(Bar|Pub|Tavern|Lounge|Saloon|Taproom|Tap Room|Cantina|Taqueria)\b', 'bar'),
    (r'\b(Brewery|Brewing|Brew\s?Pub|Brewpub|Lager|Ale\s?House)\b', 'brewery'),
    (r'\b(Wine Bar|Wine Room|Winery|Vineyard)\b', 'bar'),
    (r'\b(Distillery)\b', 'bar'),
    (r'\b(Nightclub|Night Club|Dance Club)\b', 'nightclub'),
    # Food
    (r'\b(Restaurant|Grill|Grille|Cafe|Café|Diner|Bistro|Eatery|Kitchen|BBQ|Pizza|Pizzeria|Burger|Taco|Sushi|Ramen|Pho)\b', 'restaurant'),
    (r'\b(Coffee|Espresso|Roast|Roasters)\b', 'coffee_shop'),
    (r'\b(Bakery|Bakeshop|Doughnuts|Donut)\b', 'restaurant'),
    # Venues
    (r'\b(Theatre|Theater|Playhouse|Stage|Repertory)\b', 'theater'),
    (r'\b(Gallery|Art\s+Center|Arts\s+Center|Art\s+Studio)\b', 'gallery'),
    (r'\b(Museum)\b', 'museum'),
    (r'\b(Arena|Coliseum|Stadium|Amphitheater|Amphitheatre)\b', 'arena'),
    (r'\b(Cinema|Cinemas|Movie|Movies|Film|Cinemark|Regal|AMC)\b', 'cinema'),
    # Music
    (r'\b(Blues Club|Music Hall|Music House|Concert Hall|Bandshell)\b', 'music_venue'),
    # Recreation
    (r'\b(Bowling|Arcade|Karting|Escape Room|Trampoline|Adventure Park|Axe Throwing)\b', 'recreation'),
    (r'\b(Yoga|Fitness|Gym|CrossFit|Pilates)\b', 'fitness'),
    # Community
    (r'\b(Church|Chapel|Cathedral|Mosque|Synagogue|Temple)\b', 'church'),
    (r'\b(Library)\b', 'library'),
    (r'\b(Recreation Center|Rec Center|Community Center)\b', 'community_center'),
    (r'\b(Park|Garden|Gardens|Nature Center|Botanical)\b', 'park'),
    # Education/Orgs
    (r'\b(University|College|School)\b', 'organization'),
    (r'\b(Foundation|Alliance|Coalition|Association|Society|Council)\b', 'organization'),
]

# Compile
NAME_TYPE_COMPILED = [(re.compile(pattern, re.IGNORECASE), vtype) for pattern, vtype in NAME_TYPE_RULES]


def classify_by_name(name: str) -> Optional[str]:
    """Try to classify venue type from its name."""
    for pattern, vtype in NAME_TYPE_COMPILED:
        if pattern.search(name):
            return vtype
    return None


def should_deactivate(venue: dict) -> Optional[str]:
    """Check if a venue should be deactivated. Returns reason or None."""
    name = venue.get("name", "")

    # Check junk patterns
    for regex in JUNK_REGEXES:
        if regex.match(name):
            return f"junk pattern: {name}"

    # Check specific names
    if name in JUNK_NAMES:
        return f"junk name: {name}"

    # Check out-of-market cities
    city = venue.get("city", "")
    if city in OUT_OF_MARKET_CITIES:
        return f"out of market: {city}"

    # Pure address names with no other data
    address_pattern = re.compile(r'^\d+\s+[\w\s]+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Pkwy|Hwy|Circle|Ct|Pl|Cir|Pike)\b', re.IGNORECASE)
    if address_pattern.match(name) and not venue.get("website") and not venue.get("venue_type"):
        return f"address-only name, no website/type: {name}"

    return None


# ─── LLM CLASSIFICATION ────────────────────────────────────────────────────

CLASSIFY_PROMPT = """You are a venue classifier for a city events & nightlife app covering Atlanta and Nashville metro areas.

Given a list of venues, classify each one into the correct category.

CATEGORIES:
- bar: Bars, pubs, taverns, lounges
- restaurant: Restaurants, cafes, diners, fast food
- coffee_shop: Coffee shops, tea houses
- brewery: Breweries, brewpubs
- music_venue: Concert halls, live music venues, listening rooms
- theater: Theaters, playhouses, performing arts venues
- comedy_club: Comedy clubs, improv theaters
- nightclub: Nightclubs, dance clubs
- gallery: Art galleries, exhibition spaces
- museum: Museums
- cinema: Movie theaters
- arena: Arenas, stadiums, amphitheaters, sports venues
- park: Parks, gardens, nature centers, outdoor recreation
- recreation: Bowling, arcades, escape rooms, trampoline parks, games
- fitness: Gyms, yoga studios, climbing gyms
- church: Churches, religious venues
- library: Libraries
- community_center: Community centers, rec centers
- event_space: Event venues, banquet halls, conference centers, hotels that host events
- food_hall: Food halls, market halls
- farmers_market: Farmers markets, outdoor markets
- bookstore: Bookstores
- convention_center: Convention/expo centers
- organization: Nonprofits, schools, colleges, government offices, neighborhood associations, advocacy groups, media orgs — things that host events but aren't destinations themselves
- DEACTIVATE: Not a real venue — junk data, placeholder text, out of area, duplicate stage name, generic location

For each venue, respond with ONLY the venue ID and category, one per line:
ID:category

Example:
123:bar
456:restaurant
789:DEACTIVATE
"""


def classify_with_llm(venues: list[dict]) -> dict[int, str]:
    """Classify a batch of venues using Claude Haiku."""
    cfg = get_config()
    client = Anthropic(api_key=cfg.llm.anthropic_api_key)

    # Format venue list
    lines = []
    for v in venues:
        parts = [f"ID:{v['id']} Name:{v['name']}"]
        if v.get('city'):
            parts.append(f"City:{v['city']}")
        if v.get('website'):
            parts.append(f"Web:{v['website'][:60]}")
        if v.get('address'):
            parts.append(f"Addr:{v['address'][:60]}")
        if v.get('venue_type'):
            parts.append(f"CurrentType:{v['venue_type']}")
        lines.append(" | ".join(parts))

    venue_text = "\n".join(lines)

    response = client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=2048,
        temperature=0,
        system=CLASSIFY_PROMPT,
        messages=[{"role": "user", "content": venue_text}],
    )

    # Parse response
    results = {}
    for line in response.content[0].text.strip().split("\n"):
        line = line.strip()
        if ":" in line:
            parts = line.split(":", 1)
            try:
                vid = int(parts[0].strip())
                vtype = parts[1].strip().lower()
                results[vid] = vtype
            except (ValueError, IndexError):
                continue

    return results


# ─── MAIN ──────────────────────────────────────────────────────────────────

def run_cleanup(dry_run: bool = False, use_llm: bool = True):
    client = get_client()

    # Get ALL active venues
    result = client.table("venues").select(
        "id,name,slug,venue_type,website,address,city,state,neighborhood"
    ).eq("active", True).order("name").execute()
    venues = result.data or []

    stats = {
        "deactivated": 0,
        "org_reclassified": 0,
        "rule_classified": 0,
        "llm_classified": 0,
        "llm_deactivated": 0,
        "already_ok": 0,
    }

    # ── Step 1: Deactivate junk ──
    print("=" * 60)
    print("STEP 1: Deactivate junk entries")
    print("=" * 60)

    for v in venues:
        reason = should_deactivate(v)
        if reason:
            print(f"  DEACTIVATE [{v['id']}] {v['name'][:50]} — {reason}")
            if not dry_run:
                client.table("venues").update({"active": False}).eq("id", v["id"]).execute()
            stats["deactivated"] += 1

    print(f"\n  Total deactivated: {stats['deactivated']}")

    # ── Step 2: Reclassify org types ──
    print(f"\n{'=' * 60}")
    print("STEP 2: Reclassify organization-like types → organization")
    print("=" * 60)

    for v in venues:
        if v.get("venue_type") in ORG_TYPES:
            print(f"  RECLASSIFY [{v['id']}] {v['name'][:50]} — {v['venue_type']} → organization")
            if not dry_run:
                client.table("venues").update({"venue_type": "organization"}).eq("id", v["id"]).execute()
            stats["org_reclassified"] += 1

    print(f"\n  Total reclassified: {stats['org_reclassified']}")

    # ── Step 3: Rule-based classification for untyped/generic ──
    print(f"\n{'=' * 60}")
    print("STEP 3: Rule-based classification")
    print("=" * 60)

    needs_llm = []

    for v in venues:
        # Skip already-handled venues
        if should_deactivate(v):
            continue
        if v.get("venue_type") and v["venue_type"] not in ("venue", ""):
            continue

        # Try rules
        classified = classify_by_name(v["name"])
        if classified:
            print(f"  CLASSIFY [{v['id']}] {v['name'][:50]} → {classified}")
            if not dry_run:
                client.table("venues").update({"venue_type": classified}).eq("id", v["id"]).execute()
            stats["rule_classified"] += 1
        else:
            needs_llm.append(v)

    print(f"\n  Rule-classified: {stats['rule_classified']}")
    print(f"  Needs LLM: {len(needs_llm)}")

    # ── Step 4: LLM classification for remaining ──
    if use_llm and needs_llm:
        print(f"\n{'=' * 60}")
        print("STEP 4: LLM classification")
        print("=" * 60)

        # Process in batches of 30
        batch_size = 30
        for i in range(0, len(needs_llm), batch_size):
            batch = needs_llm[i:i + batch_size]
            print(f"\n  Batch {i // batch_size + 1} ({len(batch)} venues)...")

            try:
                results = classify_with_llm(batch)

                for v in batch:
                    vid = v["id"]
                    if vid in results:
                        new_type = results[vid]
                        if new_type == "deactivate":
                            print(f"    DEACTIVATE [{vid}] {v['name'][:50]}")
                            if not dry_run:
                                client.table("venues").update({"active": False}).eq("id", vid).execute()
                            stats["llm_deactivated"] += 1
                        else:
                            print(f"    CLASSIFY [{vid}] {v['name'][:50]} → {new_type}")
                            if not dry_run:
                                client.table("venues").update({"venue_type": new_type}).eq("id", vid).execute()
                            stats["llm_classified"] += 1
                    else:
                        print(f"    SKIP [{vid}] {v['name'][:50]} — no LLM result")

            except Exception as e:
                print(f"    LLM error: {e}")

            time.sleep(1)  # Rate limit

    # ── Summary ──
    print(f"\n{'=' * 60}")
    print("SUMMARY")
    print("=" * 60)
    print(f"Deactivated (rules):     {stats['deactivated']}")
    print(f"Deactivated (LLM):       {stats['llm_deactivated']}")
    print(f"Org reclassified:        {stats['org_reclassified']}")
    print(f"Rule-classified:         {stats['rule_classified']}")
    print(f"LLM-classified:          {stats['llm_classified']}")
    total = sum(stats.values())
    print(f"Total changes:           {total}")

    return stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Classify and clean up venue data")
    parser.add_argument("--dry-run", action="store_true", help="Don't update database")
    parser.add_argument("--no-llm", action="store_true", help="Skip LLM classification")

    args = parser.parse_args()
    run_cleanup(dry_run=args.dry_run, use_llm=not args.no_llm)
