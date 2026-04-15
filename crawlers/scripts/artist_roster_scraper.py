"""
Scrape visual artist profiles from gallery websites.

For each gallery:
1. Fetch artist roster page or exhibition detail pages
2. Extract artist names, bios, images, websites
3. Create artist records via get_or_create_artist(discipline="visual_artist")

Run: cd crawlers && PYTHONPATH=. python3 scripts/artist_roster_scraper.py [--dry-run] [--gallery SLUG]
"""

import argparse
import logging
import time

import requests
from bs4 import BeautifulSoup

from artists import get_or_create_artist, normalize_artist_name, validate_artist_name
from db import get_client

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)
_DELAY = 1.0


def _make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": _USER_AGENT})
    return session


# -----------------------------------------------------------------------
# Gallery-specific scrapers
# -----------------------------------------------------------------------

def scrape_kai_lin_art(session: requests.Session) -> list[dict]:
    """Scrape artist roster from kailinart.com."""
    artists = []
    url = "https://www.kailinart.com/artists"
    try:
        resp = session.get(url, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        for link in soup.find_all("a", href=True):
            href = link.get("href", "")
            if "/artists/" not in href or href.endswith("/artists") or href.endswith("/artists/"):
                continue

            name = link.get_text(strip=True)
            if not name or not validate_artist_name(name):
                continue

            artist_url = href if href.startswith("http") else f"https://www.kailinart.com{href}"

            img = link.find("img")
            image_url = img.get("src") if img else None

            artists.append({
                "name": normalize_artist_name(name),
                "website": artist_url,
                "image_url": image_url,
            })

            time.sleep(_DELAY)

    except Exception as e:
        logger.warning("Failed to scrape Kai Lin Art artists: %s", e)

    return artists


def scrape_atlanta_contemporary(session: requests.Session) -> list[dict]:
    """Scrape artist archive from atlantacontemporary.org."""
    artists = []
    url = "https://atlantacontemporary.org/exhibitions"
    try:
        resp = session.get(url, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        for ex in soup.find_all(["h2", "h3", "h4"]):
            text = ex.get_text(strip=True)
            if ":" in text:
                name_part = text.split(":")[0].strip()
                if validate_artist_name(name_part):
                    artists.append({
                        "name": normalize_artist_name(name_part),
                    })

    except Exception as e:
        logger.warning("Failed to scrape Atlanta Contemporary: %s", e)

    return artists


def scrape_exhibition_artists_from_db() -> list[dict]:
    """Extract unique artist names from exhibition_artists table."""
    client = get_client()
    result = client.table("exhibition_artists").select(
        "artist_name"
    ).is_("artist_id", "null").execute()

    seen = set()
    artists = []
    for row in result.data or []:
        name = normalize_artist_name(row.get("artist_name", ""))
        if not name or name.lower() in seen:
            continue
        if not validate_artist_name(name):
            continue
        seen.add(name.lower())
        artists.append({"name": name})

    return artists


GALLERY_SCRAPERS = {
    "kai-lin-art": scrape_kai_lin_art,
    "atlanta-contemporary": scrape_atlanta_contemporary,
}


def main():
    parser = argparse.ArgumentParser(description="Scrape artist rosters from galleries")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--gallery", help="Scrape only this gallery (slug)")
    parser.add_argument("--include-db", action="store_true",
                        help="Also process names from exhibition_artists table")
    args = parser.parse_args()

    session = _make_session()
    all_artists: list[dict] = []

    galleries = GALLERY_SCRAPERS
    if args.gallery:
        if args.gallery not in galleries:
            logger.error("Unknown gallery: %s. Available: %s",
                         args.gallery, ", ".join(galleries.keys()))
            return
        galleries = {args.gallery: galleries[args.gallery]}

    for slug, scraper in galleries.items():
        logger.info("Scraping %s...", slug)
        artists = scraper(session)
        logger.info("  Found %d artists", len(artists))
        all_artists.extend(artists)

    if args.include_db:
        logger.info("Processing exhibition_artists table...")
        db_artists = scrape_exhibition_artists_from_db()
        logger.info("  Found %d valid artist names", len(db_artists))
        all_artists.extend(db_artists)

    # Deduplicate by normalized name
    seen = set()
    unique = []
    for a in all_artists:
        key = a["name"].lower()
        if key not in seen:
            seen.add(key)
            unique.append(a)

    logger.info("")
    logger.info("Total unique artists: %d", len(unique))

    if args.dry_run:
        for a in unique[:20]:
            logger.info("  %s", a["name"])
        if len(unique) > 20:
            logger.info("  ... and %d more", len(unique) - 20)
        logger.info("DRY RUN — no records created.")
        return

    created = 0
    failed = 0

    for a in unique:
        try:
            extra_fields = {}
            if a.get("bio"):
                extra_fields["bio"] = a["bio"][:500]
            if a.get("image_url"):
                extra_fields["image_url"] = a["image_url"]
            if a.get("website"):
                extra_fields["website"] = a["website"]

            result = get_or_create_artist(
                a["name"],
                discipline="visual_artist",
                extra_fields=extra_fields or None,
            )
            if result:
                created += 1
        except ValueError as e:
            logger.debug("Skipped %s: %s", a["name"], e)
            failed += 1
        except Exception as e:
            logger.warning("Failed to create %s: %s", a["name"], e)
            failed += 1

    logger.info("")
    logger.info("=== Results ===")
    logger.info("Created/updated: %d", created)
    logger.info("Failed/skipped: %d", failed)


if __name__ == "__main__":
    main()
