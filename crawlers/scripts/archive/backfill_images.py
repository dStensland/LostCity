"""
Backfill images and genres for existing events that don't have them.
Fetches movie posters for film events and artist images/genres for music events.
"""

import logging
from db import get_client, update_event
from posters import get_poster_for_film_event
from artist_images import get_info_for_music_event

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def backfill_film_images(dry_run: bool = False, limit: int = 500) -> tuple[int, int]:
    """Backfill movie posters for film events without images."""
    client = get_client()

    # Get film events without images
    result = client.table('events').select('id, title, image_url').eq('category', 'film').is_('image_url', 'null').limit(limit).execute()

    events = result.data or []
    logger.info(f"Found {len(events)} film events without images")

    updated = 0
    skipped = 0

    for event in events:
        title = event['title']
        poster_url = get_poster_for_film_event(title, None)

        if poster_url:
            if dry_run:
                logger.info(f"[DRY RUN] Would update: {title[:50]} -> {poster_url[:50]}...")
            else:
                update_event(event['id'], {'image_url': poster_url})
                logger.info(f"Updated: {title[:50]}")
            updated += 1
        else:
            logger.debug(f"No poster found for: {title[:50]}")
            skipped += 1

    return updated, skipped


def backfill_music_images(dry_run: bool = False, limit: int = 500, include_genres: bool = True) -> tuple[int, int]:
    """Backfill artist images and genres for music events."""
    client = get_client()

    # Get music events without images OR without genres
    if include_genres:
        # Get events missing image OR genres (not in a series)
        result = client.table('events').select('id, title, image_url, genres, series_id').eq('category', 'music').is_('series_id', 'null').limit(limit).execute()
        events = [e for e in (result.data or []) if not e.get('image_url') or not e.get('genres')]
    else:
        result = client.table('events').select('id, title, image_url').eq('category', 'music').is_('image_url', 'null').limit(limit).execute()
        events = result.data or []

    logger.info(f"Found {len(events)} music events to process")

    updated = 0
    skipped = 0

    for event in events:
        title = event['title']
        existing_image = event.get('image_url')
        existing_genres = event.get('genres')

        info = get_info_for_music_event(title, existing_image, existing_genres)

        updates = {}
        if info.image_url and not existing_image:
            updates['image_url'] = info.image_url
        if include_genres and info.genres and not existing_genres:
            updates['genres'] = info.genres

        if updates:
            if dry_run:
                logger.info(f"[DRY RUN] Would update {title[:40]}: {list(updates.keys())}")
                if info.genres:
                    logger.info(f"  Genres: {info.genres}")
            else:
                update_event(event['id'], updates)
                logger.info(f"Updated {title[:40]}: {list(updates.keys())}")
            updated += 1
        else:
            logger.debug(f"No updates for: {title[:50]}")
            skipped += 1

    return updated, skipped


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Backfill images for events")
    parser.add_argument('--dry-run', '-n', action='store_true', help="Don't actually update, just show what would happen")
    parser.add_argument('--category', '-c', choices=['film', 'music', 'all'], default='all', help="Which category to backfill")
    parser.add_argument('--limit', '-l', type=int, default=500, help="Max events to process per category")

    args = parser.parse_args()

    if args.category in ('film', 'all'):
        logger.info("=== Backfilling FILM images ===")
        updated, skipped = backfill_film_images(dry_run=args.dry_run, limit=args.limit)
        logger.info(f"Film: {updated} updated, {skipped} skipped")

    if args.category in ('music', 'all'):
        logger.info("=== Backfilling MUSIC images ===")
        updated, skipped = backfill_music_images(dry_run=args.dry_run, limit=args.limit)
        logger.info(f"Music: {updated} updated, {skipped} skipped")

    logger.info("Done!")
