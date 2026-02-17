"""
Seed realistic engagement data for synthetic users across upcoming events.

Creates RSVPs (going/interested), venue recommendations, and saved items
spread across the next 30 days of events, classes, series, and festivals.

Run: python3 seed_engagement.py
"""

import os
import sys
import random
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))
from config import DatabaseConfig

cfg = DatabaseConfig()

from supabase import create_client

sb = create_client(cfg.supabase_url, cfg.supabase_service_key)

# ── Persona preferences (simplified from seed-personas.json) ────────────────

PERSONAS = {
    # Power users (18 RSVPs, 8 recs, 10 saves)
    "gpburdell": ["music", "comedy", "sports", "nightlife", "tech"],
    "sleve": ["food_drink", "sports", "music", "comedy"],
    "bobsondug": ["music", "nightlife", "comedy", "art"],
    "threestacksjr": ["music", "nightlife", "art", "community"],
    "freaknikw": ["music", "nightlife", "comedy", "community"],
    "clermontl": ["nightlife", "comedy", "music", "food_drink"],
    "varsitymac": ["food_drink", "sports", "comedy", "community"],
    "coach": ["music", "food_drink", "art", "comedy", "nightlife", "community"],
    # Regular users (10 RSVPs, 4 recs, 5 saves)
    "miketruk": ["fitness", "outdoor", "sports", "community"],
    "toddb": ["comedy", "food_drink", "music", "nightlife"],
    "karld": ["food_drink", "nightlife", "music"],
    "onsons": ["art", "music", "community", "film"],
    "willied": ["tours", "community", "music"],
    "dwigt": ["comedy", "nightlife", "music"],
    "reymcs": ["sports", "music", "food_drink"],
    "raulc": ["art", "community", "music", "film"],
    "kevnog": ["music", "nightlife", "comedy"],
    "anatolism": ["music", "art", "film"],
    "shownf": ["food_drink", "music", "community"],
    "glenmix": ["sports", "music", "nightlife"],
    "deanw": ["comedy", "music", "food_drink"],
    "colapiii": ["art", "food_drink", "music"],
    "deltah": ["music", "nightlife", "dance"],
    "poncedelenox": ["food_drink", "art", "community"],
    "edgefontaine": ["music", "nightlife", "art", "comedy"],
    "l5pcinco": ["music", "nightlife", "art", "comedy"],
    "decaturstevens": ["food_drink", "comedy", "music", "community"],
    "ptreebattle": ["art", "food_drink", "theater"],
    "waffleh": ["food_drink", "comedy", "community"],
    "sweetwaterp": ["food_drink", "outdoor", "music"],
    "piedmontp": ["fitness", "outdoor", "community"],
    "midtownming": ["nightlife", "food_drink", "art"],
    # Casual users (5 RSVPs, 2 recs, 3 saves)
    "timsand": ["sports", "music"],
    "mikes": ["comedy", "music"],
    "tonysm": ["food_drink", "sports"],
    "mariomcr": ["music", "nightlife"],
    "darryld": ["sports", "comedy"],
    "scottd": ["music", "outdoor"],
    "jeromyg": ["music", "comedy"],
    "bigchickenm": ["food_drink", "sports", "comedy"],
    "martapeople": ["community", "music", "art"],
}

POWER_USERS = {"gpburdell", "sleve", "bobsondug", "threestacksjr", "freaknikw", "clermontl", "varsitymac", "coach"}
CASUAL_USERS = {"timsand", "mikes", "tonysm", "mariomcr", "darryld", "scottd", "jeromyg", "bigchickenm", "martapeople"}

RSVP_COUNTS = {"power": 18, "regular": 10, "casual": 5}
REC_COUNTS = {"power": 8, "regular": 4, "casual": 2}
SAVE_COUNTS = {"power": 10, "regular": 5, "casual": 3}

REC_NOTES = {
    "music": [
        "The sound here is incredible. Don't miss it.",
        "Best live music spot in the neighborhood.",
        "If you haven't seen a show here yet, you're sleeping.",
        "The vibe is always right. Go on a weeknight for the real experience.",
    ],
    "food_drink": [
        "Everything on the menu slaps. Trust me on the specials.",
        "This is the spot. Period.",
        "Come hungry, leave happy. Best in the city for what they do.",
        "Hidden gem status. Tell your friends (or don't).",
    ],
    "nightlife": [
        "The energy here is unmatched. Best night out in ATL.",
        "If you know, you know. Late night is the move.",
        "This place has soul. No pretense, just good times.",
    ],
    "comedy": [
        "I've ugly-laughed here more times than I can count.",
        "The lineup is always stacked. Great open mics too.",
        "Best comedy room in Atlanta, hands down.",
    ],
    "art": [
        "The exhibitions here are always thought-provoking.",
        "One of the most important creative spaces in Atlanta.",
        "Supporting local artists in the best possible way.",
    ],
    "sports": [
        "Game day here hits different.",
        "The atmosphere is electric. Best watch party spot.",
    ],
    "community": [
        "This is what makes Atlanta special.",
        "The kind of place that brings people together.",
    ],
    "fitness": [
        "The most peaceful place in the city.",
        "My weekly reset. Can't recommend enough.",
    ],
    "default": [
        "Highly recommend. You won't be disappointed.",
        "One of my favorite spots in Atlanta.",
        "Go here. Thank me later.",
        "The vibes are immaculate.",
    ],
}


def get_level(username):
    if username in POWER_USERS:
        return "power"
    if username in CASUAL_USERS:
        return "casual"
    return "regular"


def random_past_ts(days_back=7):
    offset = random.random() * days_back * 86400
    dt = datetime.utcnow() - timedelta(seconds=offset)
    return dt.isoformat() + "Z"


def pick_note(categories):
    for cat in categories:
        if cat in REC_NOTES:
            return random.choice(REC_NOTES[cat])
    return random.choice(REC_NOTES["default"])


def main():
    print("=== LostCity Engagement Seeder ===\n")

    # 1. Look up profile IDs
    usernames = list(PERSONAS.keys())
    result = sb.table("profiles").select("id, username").in_("username", usernames).execute()
    profile_map = {p["username"]: p["id"] for p in result.data}
    found = [u for u in usernames if u in profile_map]
    print(f"Found {len(found)}/{len(usernames)} profiles")

    if not found:
        print("ERROR: No profiles found. Run seed-personas.ts first.")
        return

    user_ids = [profile_map[u] for u in found]

    # 2. Clear existing engagement for these users
    print("\nClearing existing engagement data...")
    sb.table("event_rsvps").delete().in_("user_id", user_ids).execute()
    sb.table("recommendations").delete().in_("user_id", user_ids).execute()
    sb.table("saved_items").delete().in_("user_id", user_ids).execute()
    print("  Cleared RSVPs, recommendations, saved items")

    # 3. Fetch candidate events for the next 30 days
    today = datetime.now().strftime("%Y-%m-%d")
    end_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

    print(f"\nFetching events {today} → {end_date}...")

    # Fetch events by category, prioritizing ones with images
    categories = list(set(cat for cats in PERSONAS.values() for cat in cats))
    events_by_cat = {}

    for cat in categories:
        result = (
            sb.table("events")
            .select("id, category, start_date, title, venue_id, series_id, is_class, image_url")
            .eq("category", cat)
            .gte("start_date", today)
            .lte("start_date", end_date)
            .is_("canonical_event_id", "null")
            .not_.is_("image_url", "null")
            .order("start_date", desc=False)
            .limit(200)
            .execute()
        )
        events_by_cat[cat] = result.data or []
        # Also grab some without images for variety
        result2 = (
            sb.table("events")
            .select("id, category, start_date, title, venue_id, series_id, is_class, image_url")
            .eq("category", cat)
            .gte("start_date", today)
            .lte("start_date", end_date)
            .is_("canonical_event_id", "null")
            .is_("image_url", "null")
            .order("start_date", desc=False)
            .limit(50)
            .execute()
        )
        events_by_cat[cat].extend(result2.data or [])
        print(f"  {cat}: {len(events_by_cat[cat])} candidates")

    # Also fetch classes specifically
    class_result = (
        sb.table("events")
        .select("id, category, start_date, title, venue_id, series_id, is_class, image_url")
        .eq("is_class", True)
        .gte("start_date", today)
        .lte("start_date", end_date)
        .is_("canonical_event_id", "null")
        .order("start_date", desc=False)
        .limit(200)
        .execute()
    )
    classes = class_result.data or []
    print(f"  classes: {len(classes)} candidates")

    # Fetch venues with images for recommendations
    venue_result = (
        sb.table("venues")
        .select("id, name, venue_type, neighborhood")
        .not_.is_("image_url", "null")
        .not_.is_("neighborhood", "null")
        .limit(500)
        .execute()
    )
    venues = venue_result.data or []
    print(f"  venues for recs: {len(venues)} candidates")

    # Map venue types to persona categories for smart matching
    VENUE_CAT_MAP = {
        "music_venue": "music", "bar": "nightlife", "nightclub": "nightlife",
        "restaurant": "food_drink", "brewery": "food_drink", "coffee_shop": "food_drink",
        "food_hall": "food_drink", "comedy_club": "comedy", "gallery": "art",
        "museum": "art", "theater": "theater", "cinema": "film",
        "park": "outdoor", "garden": "outdoor", "sports_bar": "sports",
        "arena": "sports", "fitness_center": "fitness", "yoga_studio": "fitness",
        "community_center": "community", "bookstore": "community",
        "record_store": "music", "distillery": "food_drink", "winery": "food_drink",
    }
    venues_by_cat = {}
    for v in venues:
        cat = VENUE_CAT_MAP.get(v.get("venue_type", ""), "community")
        venues_by_cat.setdefault(cat, []).append(v)

    # 4. Seed RSVPs
    print("\n--- Seeding RSVPs ---")
    total_rsvps = 0
    all_rsvps = []

    for username in found:
        level = get_level(username)
        user_id = profile_map[username]
        cats = PERSONAS[username]
        count = RSVP_COUNTS[level]

        # Build a pool of relevant events
        pool = []
        for cat in cats:
            pool.extend(events_by_cat.get(cat, []))
        # Add some classes for variety (especially for fitness/art users)
        if any(c in cats for c in ["fitness", "art", "community", "food_drink"]):
            pool.extend(classes[:30])

        if not pool:
            continue

        # Dedupe by event ID
        seen = set()
        unique_pool = []
        for e in pool:
            if e["id"] not in seen:
                seen.add(e["id"])
                unique_pool.append(e)

        selected = random.sample(unique_pool, min(count, len(unique_pool)))

        for i, event in enumerate(selected):
            # Power users: all going. Others: 70% going, 30% interested
            if level == "power":
                status = "going"
            else:
                status = "going" if i < len(selected) * 0.7 else "interested"

            all_rsvps.append({
                "user_id": user_id,
                "event_id": event["id"],
                "status": status,
                "visibility": "public",
                "created_at": random_past_ts(5),
            })

        going = sum(1 for r in all_rsvps[-len(selected):] if r["status"] == "going")
        interested = len(selected) - going
        print(f"  @{username:20s} {going} going, {interested} interested")
        total_rsvps += len(selected)

    # Insert in batches to avoid timeouts
    if all_rsvps:
        # Dedupe: one RSVP per user+event
        rsvp_keys = set()
        deduped_rsvps = []
        for r in all_rsvps:
            key = (r["user_id"], r["event_id"])
            if key not in rsvp_keys:
                rsvp_keys.add(key)
                deduped_rsvps.append(r)

        batch_size = 100
        for i in range(0, len(deduped_rsvps), batch_size):
            batch = deduped_rsvps[i : i + batch_size]
            result = sb.table("event_rsvps").upsert(batch, on_conflict="user_id,event_id").execute()

        print(f"\n  Total RSVPs inserted: {len(deduped_rsvps)}")

    # 5. Seed venue recommendations
    print("\n--- Seeding Venue Recommendations ---")
    total_recs = 0
    all_recs = []

    for username in found:
        level = get_level(username)
        user_id = profile_map[username]
        cats = PERSONAS[username]
        count = REC_COUNTS[level]

        # Build a pool of relevant venues
        pool = []
        for cat in cats:
            pool.extend(venues_by_cat.get(cat, []))
        if not pool:
            pool = random.sample(venues, min(count * 2, len(venues)))

        seen = set()
        unique_pool = []
        for v in pool:
            if v["id"] not in seen:
                seen.add(v["id"])
                unique_pool.append(v)

        selected = random.sample(unique_pool, min(count, len(unique_pool)))

        for venue in selected:
            note = pick_note(cats)
            all_recs.append({
                "user_id": user_id,
                "venue_id": venue["id"],
                "note": note,
                "visibility": "public",
                "created_at": random_past_ts(14),
            })

        print(f"  @{username:20s} {len(selected)} venue recs")
        total_recs += len(selected)

    if all_recs:
        # Dedupe by user+venue
        rec_keys = set()
        deduped_recs = []
        for r in all_recs:
            key = (r["user_id"], r["venue_id"])
            if key not in rec_keys:
                rec_keys.add(key)
                deduped_recs.append(r)

        for i in range(0, len(deduped_recs), batch_size):
            batch = deduped_recs[i : i + batch_size]
            sb.table("recommendations").insert(batch).execute()

        print(f"\n  Total recommendations inserted: {len(deduped_recs)}")

    # 6. Seed saved items (mix of events and venues)
    print("\n--- Seeding Saved Items ---")
    total_saves = 0
    all_saves = []

    for username in found:
        level = get_level(username)
        user_id = profile_map[username]
        cats = PERSONAS[username]
        count = SAVE_COUNTS[level]

        # 60% event saves, 40% venue saves
        event_save_count = max(1, int(count * 0.6))
        venue_save_count = count - event_save_count

        # Pick events
        pool = []
        for cat in cats:
            pool.extend(events_by_cat.get(cat, []))
        if pool:
            seen = set()
            unique = [e for e in pool if not (e["id"] in seen or seen.add(e["id"]))]
            for event in random.sample(unique, min(event_save_count, len(unique))):
                all_saves.append({
                    "user_id": user_id,
                    "event_id": event["id"],
                    "created_at": random_past_ts(10),
                })

        # Pick venues
        vpool = []
        for cat in cats:
            vpool.extend(venues_by_cat.get(cat, []))
        if vpool:
            seen = set()
            unique = [v for v in vpool if not (v["id"] in seen or seen.add(v["id"]))]
            for venue in random.sample(unique, min(venue_save_count, len(unique))):
                all_saves.append({
                    "user_id": user_id,
                    "venue_id": venue["id"],
                    "created_at": random_past_ts(10),
                })

        total_saves += min(count, event_save_count + venue_save_count)
        print(f"  @{username:20s} {min(event_save_count, len(pool))} events, {min(venue_save_count, len(vpool))} venues saved")

    if all_saves:
        # Dedupe
        save_keys = set()
        deduped_saves = []
        for s in all_saves:
            key = (s["user_id"], s.get("event_id"), s.get("venue_id"))
            if key not in save_keys:
                save_keys.add(key)
                deduped_saves.append(s)

        for i in range(0, len(deduped_saves), batch_size):
            batch = deduped_saves[i : i + batch_size]
            sb.table("saved_items").insert(batch).execute()

        print(f"\n  Total saved items inserted: {len(deduped_saves)}")

    # 7. Summary
    print("\n" + "=" * 50)
    print("ENGAGEMENT SEEDING COMPLETE")
    print("=" * 50)

    # Verify counts
    rsvp_count = sb.table("event_rsvps").select("id", count="exact").execute()
    rec_count = sb.table("recommendations").select("id", count="exact").execute()
    save_count = sb.table("saved_items").select("id", count="exact").execute()

    print(f"  RSVPs:           {rsvp_count.count}")
    print(f"  Recommendations: {rec_count.count}")
    print(f"  Saved items:     {save_count.count}")


if __name__ == "__main__":
    main()
