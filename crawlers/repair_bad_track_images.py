#!/usr/bin/env python3
"""
Repair flagged bad venue images for explore tracks.

Targets venues listed in web/content/explore_tracks_insufficient_flags.json where
flags include low-quality or broken images, then tries to replace with:
1) Venue website OG/hero image
2) Wikimedia (Wikipedia / Commons) fallback

Usage:
  python3 repair_bad_track_images.py --dry-run
  python3 repair_bad_track_images.py
  python3 repair_bad_track_images.py --limit 20
"""

from __future__ import annotations

import argparse
import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import requests
from dotenv import load_dotenv

from db import get_client
from enrich_artifact_images import SEARCH_OVERRIDES, search_commons_image, search_wikipedia_image
from scrape_venue_images import scrape_image_from_website

ROOT = Path(__file__).resolve().parent.parent
FLAGS_PATH = ROOT / "web" / "content" / "explore_tracks_content_audit.json"
REPORT_DIR = ROOT / "crawlers" / "reports"

TARGET_FLAGS = {"low_quality_image", "broken_or_unreachable_image"}
HTTP_TIMEOUT = 10
TOKEN_STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "city",
    "atlanta",
    "center",
}
GENERIC_TOKENS = {
    "park",
    "hall",
    "club",
    "museum",
    "theatre",
    "theater",
    "tower",
    "statue",
    "monument",
    "bridge",
    "house",
    "market",
    "station",
    "plaza",
    "gallery",
    "yards",
    "yard",
}
BAD_URL_PATTERNS = [
    "logo",
    "icon",
    "close.",
    "close_",
    "/close",
    "dummy",
    "transparent",
    "placeholder",
    "spacer",
    "pixel",
    "tracker",
    "tracking",
    "thumbnail",
    "slidder",
    "slider",
    "sprite",
    "favicon",
    "avatar",
    "hero-thumbnail",
    "campus-aerial",
]
GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places:searchText"
GOOGLE_PHOTO_MAX_WIDTH = 1200
GOOGLE_QUERY_OVERRIDES = {
    "stone-mountain-park": "Stone Mountain Park",
    "sweet-auburn-curb-market": "Municipal Market Atlanta",
    "the-masquerade-hell": "The Masquerade Atlanta",
    "whiskey-blue": "Whiskey Blue Atlanta Buckhead",
    "zoo-atlanta": "Zoo Atlanta",
    "zesto-little-five": "Zesto - Little Five Points",
}
GOOGLE_PLACE_NAME_ALIASES = {
    "sweet-auburn-curb-market": ["municipal market"],
    "the-masquerade-hell": ["the masquerade"],
    "whiskey-blue": ["rose and rye", "whiskey blue"],
}
WIKIMEDIA_QUERY_OVERRIDES = {
    "1100-peachtree": "1100 Peachtree Atlanta",
    "3344-peachtree": "Sovereign Atlanta building",
    "anti-gravity-monument": "Gravity Research Foundation Monument",
}


def load_bad_image_targets(flags_path: Path) -> dict[str, dict[str, Any]]:
    payload = json.loads(flags_path.read_text())
    targets: dict[str, dict[str, Any]] = {}

    # New/full audit format.
    rows = payload.get("venue_audit_rows") or []
    for row in rows:
        venue = row.get("venue") or {}
        track = row.get("track") or {}
        slug = (venue.get("slug") or "").strip()
        if not slug:
            continue

        flags = set(row.get("flags") or [])
        image_flags = sorted(flags.intersection(TARGET_FLAGS))
        if not image_flags:
            continue

        if slug not in targets:
            targets[slug] = {
                "venue_slug": slug,
                "venue_name": venue.get("name"),
                "tracks": set(),
                "flags": set(),
            }

        targets[slug]["tracks"].add(track.get("slug") or "unknown-track")
        targets[slug]["flags"].update(image_flags)

    # Backward-compatible format.
    legacy_rows = payload.get("insufficient_rows") or []
    for row in legacy_rows:
        slug = (row.get("venue_slug") or "").strip()
        if not slug:
            continue
        flags = set(row.get("flags") or [])
        image_flags = sorted(flags.intersection(TARGET_FLAGS))
        if not image_flags:
            continue
        if slug not in targets:
            targets[slug] = {
                "venue_slug": slug,
                "venue_name": row.get("venue_name"),
                "tracks": set(),
                "flags": set(),
            }
        targets[slug]["tracks"].add(row.get("track_slug") or "unknown-track")
        targets[slug]["flags"].update(image_flags)

    for target in targets.values():
        target["tracks"] = sorted(target["tracks"])
        target["flags"] = sorted(target["flags"])

    return targets


def fetch_venues(slugs: list[str]) -> dict[str, dict[str, Any]]:
    client = get_client()
    rows = (
        client.table("venues")
        .select("id, name, slug, website, address, city, state, image_url, hero_image_url")
        .in_("slug", slugs)
        .execute()
        .data
        or []
    )
    return {row["slug"]: row for row in rows if row.get("slug")}


def ensure_protocol(url: str) -> str:
    trimmed = (url or "").strip()
    if not trimmed:
        return ""
    if trimmed.startswith(("http://", "https://")):
        return trimmed
    return f"https://{trimmed}"


def check_image_url(url: str) -> tuple[bool, str]:
    if not url:
        return False, "empty"

    headers = {
        "User-Agent": "LostCityBot/1.0 (https://lostcity.app; contact@lostcity.app)",
        "Accept": "image/*,*/*;q=0.8",
    }

    try:
        head = requests.head(url, timeout=HTTP_TIMEOUT, allow_redirects=True, headers=headers)
        status = head.status_code
        content_type = (head.headers.get("content-type") or "").lower()

        if status in (401, 403, 405) or not content_type.startswith("image/"):
            get_resp = requests.get(url, timeout=HTTP_TIMEOUT, allow_redirects=True, stream=True, headers=headers)
            status = get_resp.status_code
            content_type = (get_resp.headers.get("content-type") or "").lower()

        if status >= 400:
            return False, f"http_{status}"
        if not content_type.startswith("image/"):
            return False, f"non_image:{content_type or 'unknown'}"
        return True, "ok"
    except Exception as exc:
        return False, f"request_error:{type(exc).__name__}"


def slug_tokens(slug: str) -> list[str]:
    tokens = []
    for token in (slug or "").lower().split("-"):
        t = token.strip()
        if len(t) < 4:
            continue
        if t in TOKEN_STOPWORDS:
            continue
        tokens.append(t)
    return tokens


def candidate_has_bad_pattern(url: str) -> Optional[str]:
    lowered = (url or "").lower()
    for pattern in BAD_URL_PATTERNS:
        if pattern in lowered:
            return pattern
    if lowered.endswith(".svg") or ".svg?" in lowered:
        return "svg"
    return None


def candidate_matches_slug(slug: str, url: str) -> bool:
    lowered = (url or "").lower()
    tokens = slug_tokens(slug)
    if not tokens:
        return True

    meaningful = [t for t in tokens if t not in GENERIC_TOKENS]
    probe = meaningful or tokens
    return any(token in lowered for token in probe)


def tokenize_text(text: str) -> set[str]:
    cleaned = "".join(ch.lower() if ch.isalnum() else " " for ch in (text or ""))
    tokens = {
        part
        for part in cleaned.split()
        if len(part) >= 3 and part not in TOKEN_STOPWORDS
    }
    return tokens


def build_google_query(venue: dict[str, Any]) -> str:
    name = (venue.get("name") or "").strip()
    address = (venue.get("address") or "").strip()
    city = (venue.get("city") or "").strip() or "Atlanta"
    state = (venue.get("state") or "").strip() or "GA"
    if address:
        return f"{name}, {address}"
    return f"{name}, {city}, {state}"


def google_search_places(query: str, google_api_key: str) -> list[dict[str, Any]]:
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": google_api_key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.photos",
    }
    payload = {
        "textQuery": query,
        "maxResultCount": 5,
        "locationBias": {
            "circle": {
                "center": {"latitude": 33.749, "longitude": -84.388},
                "radius": 50000,
            }
        },
    }
    try:
        resp = requests.post(GOOGLE_PLACES_URL, headers=headers, json=payload, timeout=10)
        if resp.status_code != 200:
            return []
        places = (resp.json() or {}).get("places") or []
        return places
    except Exception:
        return []


def google_match_confident(venue: dict[str, Any], place: dict[str, Any]) -> bool:
    venue_name_tokens = tokenize_text(venue.get("name") or "")
    place_name_tokens = tokenize_text(((place.get("displayName") or {}).get("text")) or "")

    if not venue_name_tokens or not place_name_tokens:
        return False

    overlap = venue_name_tokens.intersection(place_name_tokens)
    meaningful = {
        token
        for token in venue_name_tokens
        if token not in GENERIC_TOKENS and token not in {"atlanta", "georgia"}
    }

    if meaningful and not meaningful.intersection(place_name_tokens):
        return False

    if not overlap:
        return False

    city = (venue.get("city") or "").strip().lower()
    formatted_address = (place.get("formattedAddress") or "").lower()
    if city and city not in formatted_address and "atlanta" not in formatted_address:
        return False

    return True


def google_alias_match(slug: str, place: dict[str, Any]) -> bool:
    aliases = GOOGLE_PLACE_NAME_ALIASES.get(slug) or []
    if not aliases:
        return False
    name = (((place.get("displayName") or {}).get("text")) or "").lower()
    address = (place.get("formattedAddress") or "").lower()
    haystack = f"{name} {address}"
    return any(alias in haystack for alias in aliases)


def google_resolve_photo_url(photo_name: str, google_api_key: str) -> Optional[str]:
    endpoint = f"https://places.googleapis.com/v1/{photo_name}/media"
    params = {"maxWidthPx": GOOGLE_PHOTO_MAX_WIDTH, "key": google_api_key}
    try:
        resp = requests.get(endpoint, params=params, timeout=10, allow_redirects=False)
        if resp.status_code in (301, 302, 303, 307, 308):
            return resp.headers.get("Location")
        resp = requests.get(endpoint, params=params, timeout=10, allow_redirects=True)
        if resp.status_code == 200:
            return resp.url
    except Exception:
        return None
    return None


def build_google_candidate(venue: dict[str, Any], google_api_key: str) -> tuple[Optional[str], str]:
    if not google_api_key:
        return None, "google_key_missing"

    slug = venue.get("slug") or ""
    query = GOOGLE_QUERY_OVERRIDES.get(slug) or build_google_query(venue)
    places = google_search_places(query, google_api_key)
    if not places:
        return None, "google_no_place_match"

    matched_places = [
        p for p in places if google_match_confident(venue, p) or google_alias_match(slug, p)
    ]
    if not matched_places:
        return None, "google_place_name_mismatch"

    # Prefer matches that actually have photos.
    matched_places.sort(key=lambda p: len(p.get("photos") or []), reverse=True)
    for place in matched_places:
        photos = place.get("photos") or []
        if not photos:
            continue

        photos = sorted(
            photos,
            key=lambda p: int(p.get("widthPx") or 0) * int(p.get("heightPx") or 0),
            reverse=True,
        )
        for photo in photos[:5]:
            photo_name = photo.get("name")
            if not photo_name:
                continue
            url = google_resolve_photo_url(photo_name, google_api_key)
            if url:
                return url, "google_ok"

    if any(place.get("photos") for place in matched_places):
        return None, "google_photo_resolution_failed"
    return None, "google_no_photos"


def build_wikimedia_candidate(venue: dict[str, Any]) -> Optional[str]:
    slug = venue.get("slug") or ""
    name = venue.get("name") or ""
    city = venue.get("city") or "Atlanta"

    override = None
    if slug in WIKIMEDIA_QUERY_OVERRIDES:
        override = WIKIMEDIA_QUERY_OVERRIDES[slug]
    elif slug in SEARCH_OVERRIDES:
        override = SEARCH_OVERRIDES.get(slug)
    else:
        return None

    if override is None:
        return None

    search_term = override or f"{name} {city} Georgia"

    url = search_wikipedia_image(search_term)
    if url:
        return url

    return search_commons_image(name)


def find_best_replacement(
    venue: dict[str, Any], google_api_key: str
) -> tuple[Optional[str], Optional[str], list[dict[str, str]]]:
    current_urls = {
        (venue.get("image_url") or "").strip(),
        (venue.get("hero_image_url") or "").strip(),
    }
    current_urls.discard("")

    checked: list[dict[str, str]] = []

    website = ensure_protocol(venue.get("website") or "")
    if website:
        candidate = scrape_image_from_website(website)
        if candidate and candidate not in current_urls:
            bad_pattern = candidate_has_bad_pattern(candidate)
            if bad_pattern:
                checked.append({"source": "website", "url": candidate, "status": f"rejected_pattern:{bad_pattern}"})
            elif not candidate_matches_slug(venue.get("slug") or "", candidate):
                checked.append({"source": "website", "url": candidate, "status": "rejected_token_mismatch"})
            else:
                ok, reason = check_image_url(candidate)
                checked.append({"source": "website", "url": candidate, "status": reason})
                if ok:
                    return candidate, "website", checked

    google_candidate, google_status = build_google_candidate(venue, google_api_key)
    if google_candidate and google_candidate not in current_urls:
        ok, reason = check_image_url(google_candidate)
        checked.append({"source": "google_places", "url": google_candidate, "status": reason})
        if ok:
            return google_candidate, "google_places", checked
    elif google_status and google_status != "google_key_missing":
        checked.append({"source": "google_places", "url": "", "status": google_status})

    wiki_candidate = build_wikimedia_candidate(venue)
    if wiki_candidate and wiki_candidate not in current_urls:
        bad_pattern = candidate_has_bad_pattern(wiki_candidate)
        if bad_pattern:
            checked.append({"source": "wikimedia", "url": wiki_candidate, "status": f"rejected_pattern:{bad_pattern}"})
        elif not candidate_matches_slug(venue.get("slug") or "", wiki_candidate):
            checked.append({"source": "wikimedia", "url": wiki_candidate, "status": "rejected_token_mismatch"})
        else:
            ok, reason = check_image_url(wiki_candidate)
            checked.append({"source": "wikimedia", "url": wiki_candidate, "status": reason})
            if ok:
                return wiki_candidate, "wikimedia", checked

    return None, None, checked


def update_venue_image(venue_id: int, image_url: str, dry_run: bool) -> None:
    if dry_run:
        return
    client = get_client()
    client.table("venues").update(
        {
            "image_url": image_url,
            "hero_image_url": image_url,
        }
    ).eq("id", venue_id).execute()


def write_report(report: dict[str, Any]) -> Path:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    output = REPORT_DIR / f"image_repair_pass_{ts}.json"
    output.write_text(json.dumps(report, indent=2))
    return output


def run(dry_run: bool, limit: int) -> int:
    targets = load_bad_image_targets(FLAGS_PATH)
    target_slugs = sorted(targets.keys())

    if limit > 0:
        target_slugs = target_slugs[:limit]

    venues_by_slug = fetch_venues(target_slugs)

    google_api_key = os.getenv("GOOGLE_PLACES_API_KEY", "").strip()

    print(f"Loaded {len(targets)} unique flagged venues with bad images")
    print(f"Processing {len(target_slugs)} venues in this pass\n")
    print(f"Google Places fallback: {'enabled' if google_api_key else 'disabled'}\n")

    repaired = 0
    unresolved = 0
    missing_in_db = 0
    rows: list[dict[str, Any]] = []

    for idx, slug in enumerate(target_slugs, start=1):
        target = targets[slug]
        venue = venues_by_slug.get(slug)

        if not venue:
            print(f"[{idx}/{len(target_slugs)}] MISSING: {slug} not found in DB")
            rows.append(
                {
                    "slug": slug,
                    "venue_name": target.get("venue_name"),
                    "status": "missing_in_db",
                    "flags": target.get("flags", []),
                    "tracks": target.get("tracks", []),
                }
            )
            missing_in_db += 1
            continue

        print(f"[{idx}/{len(target_slugs)}] {venue['name']} ({slug})")
        candidate, source, checked = find_best_replacement(venue, google_api_key)

        if candidate:
            update_venue_image(venue["id"], candidate, dry_run)
            print(f"  REPAIRED via {source}: {candidate[:90]}...")
            repaired += 1
            rows.append(
                {
                    "slug": slug,
                    "venue_id": venue["id"],
                    "venue_name": venue["name"],
                    "status": "repaired" if not dry_run else "would_repair",
                    "source": source,
                    "new_image_url": candidate,
                    "old_image_url": venue.get("image_url"),
                    "old_hero_image_url": venue.get("hero_image_url"),
                    "flags": target.get("flags", []),
                    "tracks": target.get("tracks", []),
                    "candidates_checked": checked,
                }
            )
        else:
            print("  UNRESOLVED: no valid replacement candidate found")
            unresolved += 1
            rows.append(
                {
                    "slug": slug,
                    "venue_id": venue["id"],
                    "venue_name": venue["name"],
                    "status": "unresolved",
                    "old_image_url": venue.get("image_url"),
                    "old_hero_image_url": venue.get("hero_image_url"),
                    "flags": target.get("flags", []),
                    "tracks": target.get("tracks", []),
                    "candidates_checked": checked,
                }
            )

        time.sleep(0.4)

    report = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "dry_run": dry_run,
        "input": str(FLAGS_PATH),
        "target_flags": sorted(TARGET_FLAGS),
        "totals": {
            "flagged_unique": len(targets),
            "processed": len(target_slugs),
            "repaired": repaired,
            "unresolved": unresolved,
            "missing_in_db": missing_in_db,
        },
        "rows": rows,
    }
    output = write_report(report)

    print("\nResults")
    print("-------")
    print(f"Repaired:      {repaired}")
    print(f"Unresolved:    {unresolved}")
    print(f"Missing in DB: {missing_in_db}")
    print(f"Report:        {output}")

    return 0


def main() -> int:
    load_dotenv(ROOT / ".env", override=False)
    load_dotenv(ROOT / "crawlers" / ".env", override=False)
    load_dotenv(ROOT / "web" / ".env.local", override=False)

    parser = argparse.ArgumentParser(description="Repair flagged bad images for explore-track venues")
    parser.add_argument("--dry-run", action="store_true", help="Preview replacements only")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of venues to process")
    args = parser.parse_args()

    return run(dry_run=args.dry_run, limit=args.limit)


if __name__ == "__main__":
    raise SystemExit(main())
