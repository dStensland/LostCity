"""
Setup content expansion tables (organizations, festivals).
Run the SQL migration first, then use this to seed data.
"""

from db import get_client


ORGANIZATIONS = [
    # Art Centers
    {"id": "atlanta-contemporary", "name": "Atlanta Contemporary", "slug": "atlanta-contemporary", "org_type": "arts_nonprofit", "website": "https://atlantacontemporary.org", "categories": ["art", "learning"], "neighborhood": "Westside"},
    {"id": "callanwolde", "name": "Callanwolde Fine Arts Center", "slug": "callanwolde", "org_type": "arts_nonprofit", "website": "https://callanwolde.org", "categories": ["art", "music", "learning"], "neighborhood": "Druid Hills"},
    {"id": "spruill-arts", "name": "Spruill Center for the Arts", "slug": "spruill-arts", "org_type": "arts_nonprofit", "website": "https://spruillarts.org", "categories": ["art", "learning"], "neighborhood": "Dunwoody"},
    {"id": "hammonds-house", "name": "Hammonds House Museum", "slug": "hammonds-house", "org_type": "arts_nonprofit", "website": "https://hammondshouse.org", "categories": ["art", "community"], "neighborhood": "West End"},
    {"id": "eyedrum", "name": "Eyedrum", "slug": "eyedrum", "org_type": "arts_nonprofit", "website": "https://eyedrum.org", "categories": ["art", "music", "community"], "neighborhood": "Downtown"},
    {"id": "woodruff-arts", "name": "Woodruff Arts Center", "slug": "woodruff-arts", "org_type": "arts_nonprofit", "website": "https://woodruffcenter.org", "categories": ["art", "music", "theater"], "neighborhood": "Midtown"},

    # Arts Alliances
    {"id": "decatur-arts", "name": "Decatur Arts Alliance", "slug": "decatur-arts", "org_type": "arts_nonprofit", "website": "https://decaturartsalliance.org", "categories": ["art", "community", "festival"], "neighborhood": "Decatur"},
    {"id": "atlanta-celebrates-photo", "name": "Atlanta Celebrates Photography", "slug": "atlanta-celebrates-photo", "org_type": "arts_nonprofit", "website": "https://acpinfo.org", "categories": ["art", "film"], "neighborhood": None},

    # Film Organizations
    {"id": "atlanta-film-society", "name": "Atlanta Film Society", "slug": "atlanta-film-society", "org_type": "film_society", "website": "https://atlantafilmsociety.org", "categories": ["film"], "neighborhood": "Midtown"},
    {"id": "out-on-film", "name": "Out On Film", "slug": "out-on-film", "org_type": "film_society", "website": "https://outonfilm.org", "categories": ["film", "community"], "neighborhood": "Midtown"},
    {"id": "atlanta-jewish-film", "name": "Atlanta Jewish Film Festival", "slug": "atlanta-jewish-film", "org_type": "film_society", "website": "https://ajff.org", "categories": ["film", "community"], "neighborhood": None},
    {"id": "bronzelens", "name": "BronzeLens Film Festival", "slug": "bronzelens", "org_type": "film_society", "website": "https://bronzelens.com", "categories": ["film", "community"], "neighborhood": None},

    # Music Organizations
    {"id": "atlanta-symphony", "name": "Atlanta Symphony Orchestra", "slug": "atlanta-symphony", "org_type": "arts_nonprofit", "website": "https://aso.org", "categories": ["music"], "neighborhood": "Midtown"},
    {"id": "georgia-symphony", "name": "Georgia Symphony Orchestra", "slug": "georgia-symphony", "org_type": "arts_nonprofit", "website": "https://georgiasymphony.org", "instagram": "georgiasymphony", "description": "For over 70 years, the Georgia Symphony has engaged audiences through imaginative programming, visionary leadership, and critically acclaimed performances.", "categories": ["music"], "neighborhood": "Marietta", "city": "Marietta"},
    {"id": "atlanta-opera", "name": "Atlanta Opera", "slug": "atlanta-opera", "org_type": "arts_nonprofit", "website": "https://atlantaopera.org", "categories": ["music", "theater"], "neighborhood": "Midtown"},
    {"id": "atlanta-ballet", "name": "Atlanta Ballet", "slug": "atlanta-ballet", "org_type": "arts_nonprofit", "website": "https://atlantaballet.com", "categories": ["theater", "fitness"], "neighborhood": "Midtown"},

    # Community Organizations
    {"id": "atlanta-beltline-inc", "name": "Atlanta BeltLine Inc", "slug": "atlanta-beltline-inc", "org_type": "community_group", "website": "https://beltline.org", "categories": ["art", "community", "fitness"], "neighborhood": None},
    {"id": "trees-atlanta", "name": "Trees Atlanta", "slug": "trees-atlanta", "org_type": "community_group", "website": "https://treesatlanta.org", "categories": ["community", "fitness"], "neighborhood": None},
    {"id": "park-pride", "name": "Park Pride", "slug": "park-pride", "org_type": "community_group", "website": "https://parkpride.org", "categories": ["community"], "neighborhood": None},
    {"id": "atlanta-audubon", "name": "Atlanta Audubon Society", "slug": "atlanta-audubon", "org_type": "community_group", "website": "https://atlantaaudubon.org", "categories": ["community", "learning"], "neighborhood": None},

    # Running & Fitness
    {"id": "atlanta-track-club", "name": "Atlanta Track Club", "slug": "atlanta-track-club", "org_type": "running_club", "website": "https://atlantatrackclub.org", "categories": ["fitness", "community"], "neighborhood": None},
    {"id": "november-project-atl", "name": "November Project Atlanta", "slug": "november-project-atl", "org_type": "running_club", "website": "https://november-project.com/atlanta", "categories": ["fitness", "community"], "neighborhood": None},

    # Food & Drink
    {"id": "taste-of-atlanta", "name": "Taste of Atlanta", "slug": "taste-of-atlanta", "org_type": "food_festival", "website": "https://tasteofatlanta.com", "categories": ["food_drink", "festival"], "neighborhood": "Midtown"},

    # Cultural Organizations
    {"id": "atlanta-pride", "name": "Atlanta Pride Committee", "slug": "atlanta-pride", "org_type": "community_group", "website": "https://atlantapride.org", "categories": ["community", "festival"], "neighborhood": "Midtown"},
    {"id": "japan-fest", "name": "JapanFest Atlanta", "slug": "japan-fest", "org_type": "cultural_org", "website": "https://japanfest.org", "categories": ["community", "festival"], "neighborhood": "Duluth"},

    # Literary
    {"id": "atlanta-writers-club", "name": "Atlanta Writers Club", "slug": "atlanta-writers-club", "org_type": "community_group", "website": "https://atlantawritersclub.org", "categories": ["words", "community"], "neighborhood": None},
    {"id": "decatur-book-fest", "name": "AJC Decatur Book Festival", "slug": "decatur-book-fest", "org_type": "community_group", "website": "https://decaturbookfestival.com", "categories": ["words", "festival"], "neighborhood": "Decatur"},
]

FESTIVALS = [
    {"id": "shaky-knees", "name": "Shaky Knees", "slug": "shaky-knees", "website": "https://shakykneesfestival.com", "typical_month": 5, "typical_duration_days": 3, "location": "Central Park", "categories": ["music", "festival"], "free": False},
    {"id": "music-midtown", "name": "Music Midtown", "slug": "music-midtown", "website": "https://musicmidtown.com", "typical_month": 9, "typical_duration_days": 2, "location": "Piedmont Park", "categories": ["music", "festival"], "free": False},
    {"id": "atlanta-jazz-fest", "name": "Atlanta Jazz Festival", "slug": "atlanta-jazz-fest", "website": "https://atlantafestivals.com", "typical_month": 5, "typical_duration_days": 3, "location": "Piedmont Park", "categories": ["music", "festival"], "free": True},
    {"id": "dragon-con", "name": "Dragon Con", "slug": "dragon-con", "website": "https://dragoncon.org", "typical_month": 9, "typical_duration_days": 4, "location": "Downtown Hotels", "categories": ["community", "festival"], "free": False},
    {"id": "decatur-book-festival", "name": "Decatur Book Festival", "slug": "decatur-book-festival", "website": "https://decaturbookfestival.com", "typical_month": 10, "typical_duration_days": 2, "location": "Decatur Square", "categories": ["words", "festival"], "free": True},
    {"id": "atlanta-film-festival", "name": "Atlanta Film Festival", "slug": "atlanta-film-festival", "website": "https://atlantafilmfestival.com", "typical_month": 4, "typical_duration_days": 10, "location": "Various", "categories": ["film", "festival"], "free": False},
    {"id": "atl-pride", "name": "Atlanta Pride Festival", "slug": "atl-pride", "website": "https://atlantapride.org", "typical_month": 10, "typical_duration_days": 2, "location": "Piedmont Park", "categories": ["community", "festival"], "free": True},
    {"id": "inman-park-festival", "name": "Inman Park Festival", "slug": "inman-park-festival", "website": "https://inmanparkfestival.org", "typical_month": 4, "typical_duration_days": 2, "location": "Inman Park", "categories": ["art", "community", "festival"], "free": True},
    {"id": "candler-park-fall-fest", "name": "Candler Park Fall Fest", "slug": "candler-park-fall-fest", "website": "https://fallfest.candlerpark.org", "typical_month": 10, "typical_duration_days": 2, "location": "Candler Park", "categories": ["music", "community", "festival"], "free": True},
    {"id": "l5p-halloween", "name": "Little 5 Points Halloween", "slug": "l5p-halloween", "website": "https://l5phalloween.com", "typical_month": 10, "typical_duration_days": 1, "location": "Little Five Points", "categories": ["community", "festival"], "free": True},
    {"id": "taste-of-atlanta-fest", "name": "Taste of Atlanta", "slug": "taste-of-atlanta-fest", "website": "https://tasteofatlanta.com", "typical_month": 10, "typical_duration_days": 3, "location": "Midtown", "categories": ["food_drink", "festival"], "free": False},
    {"id": "dogwood-festival", "name": "Atlanta Dogwood Festival", "slug": "dogwood-festival", "website": "https://dogwood.org", "typical_month": 4, "typical_duration_days": 3, "location": "Piedmont Park", "categories": ["art", "music", "festival"], "free": True},
    {"id": "sweet-auburn-fest", "name": "Sweet Auburn Springfest", "slug": "sweet-auburn-fest", "website": "https://sweetauburn.com", "typical_month": 5, "typical_duration_days": 2, "location": "Auburn Avenue", "categories": ["music", "community", "festival"], "free": True},
    {"id": "one-musicfest", "name": "ONE Musicfest", "slug": "one-musicfest", "website": "https://onemusicfest.com", "typical_month": 10, "typical_duration_days": 2, "location": "Piedmont Park", "categories": ["music", "festival"], "free": False},
]


def check_table_exists(client, table_name: str) -> bool:
    """Check if a table exists by trying to query it."""
    try:
        client.table(table_name).select("*").limit(1).execute()
        return True
    except Exception:
        return False


def seed_event_producers(dry_run: bool = False) -> int:
    """Seed event_producers table."""
    client = get_client()

    if not check_table_exists(client, "event_producers"):
        print("ERROR: event_producers table doesn't exist.")
        print("Please run migration 010_content_expansion.sql first.")
        return 0

    added = 0
    for org in ORGANIZATIONS:
        # Check if exists by id or slug
        existing = client.table("event_producers").select("id").eq("id", org["id"]).execute()
        if existing.data:
            print(f"  [SKIP] {org['name']} (exists)")
            continue

        if dry_run:
            print(f"  [DRY RUN] Would add: {org['name']}")
        else:
            try:
                client.table("event_producers").insert(org).execute()
                print(f"  [ADDED] {org['name']}")
                added += 1
            except Exception as e:
                print(f"  [ERROR] {org['name']}: {e}")

    return added


def seed_festivals(dry_run: bool = False) -> int:
    """Seed festivals table."""
    client = get_client()

    if not check_table_exists(client, "festivals"):
        print("ERROR: festivals table doesn't exist.")
        print("Please run migration 010_content_expansion.sql first.")
        return 0

    added = 0
    for fest in FESTIVALS:
        # Check if exists by id
        existing = client.table("festivals").select("id").eq("id", fest["id"]).execute()
        if existing.data:
            print(f"  [SKIP] {fest['name']} (exists)")
            continue

        if dry_run:
            print(f"  [DRY RUN] Would add: {fest['name']}")
        else:
            try:
                client.table("festivals").insert(fest).execute()
                print(f"  [ADDED] {fest['name']}")
                added += 1
            except Exception as e:
                print(f"  [ERROR] {fest['name']}: {e}")

    return added


def main(dry_run: bool = False):
    print("\n" + "=" * 60)
    print("SEEDING CONTENT EXPANSION TABLES")
    print("=" * 60)

    print(f"\n--- EVENT PRODUCERS ({len(ORGANIZATIONS)}) ---")
    org_count = seed_event_producers(dry_run)

    print(f"\n--- FESTIVALS ({len(FESTIVALS)}) ---")
    fest_count = seed_festivals(dry_run)

    print("\n" + "=" * 60)
    print(f"COMPLETE: {org_count} event producers, {fest_count} festivals added")
    print("=" * 60)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    main(dry_run=args.dry_run)
