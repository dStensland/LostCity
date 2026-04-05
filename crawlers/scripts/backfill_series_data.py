#!/usr/bin/env python3
"""
Backfill Series Data from Events
Enriches series records by inheriting descriptions and images from their linked events.

Usage:
  python3 backfill_series_data.py [--dry-run] [--descriptions] [--images]

Options:
  --dry-run       Show what would be updated without making changes
  --descriptions  Only backfill descriptions
  --images        Only backfill images
  (default: backfill both)
"""

from config import get_config
from supabase import create_client
import sys

def backfill_descriptions(client, dry_run=False):
    """Backfill series descriptions from linked events."""
    print("\n" + "=" * 80)
    print("BACKFILLING SERIES DESCRIPTIONS FROM EVENTS")
    print("=" * 80)
    
    # Get series missing descriptions
    series_missing_desc = client.table('series')\
        .select('id, title, series_type')\
        .is_('description', 'null')\
        .neq('series_type', 'festival_program')\
        .execute()
    
    series_list = series_missing_desc.data if series_missing_desc.data else []
    print(f"\nFound {len(series_list)} series missing descriptions")
    
    updated_count = 0
    skipped_count = 0
    
    for i, series in enumerate(series_list, 1):
        # Get first event with non-empty description
        events = client.table('events')\
            .select('description')\
            .eq('series_id', series['id'])\
            .not_.is_('description', 'null')\
            .neq('description', '')\
            .limit(1)\
            .execute()

        if events.data and events.data[0].get('description'):
            desc = events.data[0]['description']

            if dry_run:
                if updated_count < 10 or updated_count % 10 == 0:  # Show first 10, then every 10th
                    print(f"  [{i}/{len(series_list)}] Would update: {series['title']} ({series['series_type']})")
            else:
                client.table('series')\
                    .update({'description': desc})\
                    .eq('id', series['id'])\
                    .execute()
                if updated_count < 10 or updated_count % 10 == 0:
                    print(f"  [{i}/{len(series_list)}] ✓ Updated: {series['title']} ({series['series_type']})")

            updated_count += 1
        else:
            skipped_count += 1
    
    print("\nResults:")
    print(f"  Updated: {updated_count}")
    print(f"  Skipped (no event descriptions): {skipped_count}")
    
    return updated_count

def backfill_images(client, dry_run=False):
    """Backfill series images from linked events."""
    print("\n" + "=" * 80)
    print("BACKFILLING SERIES IMAGES FROM EVENTS")
    print("=" * 80)
    
    # Get series missing images
    series_missing_img = client.table('series')\
        .select('id, title, series_type')\
        .is_('image_url', 'null')\
        .neq('series_type', 'festival_program')\
        .execute()
    
    series_list = series_missing_img.data if series_missing_img.data else []
    print(f"\nFound {len(series_list)} series missing images")
    
    updated_count = 0
    skipped_count = 0
    
    for i, series in enumerate(series_list, 1):
        # Get first event with image_url
        events = client.table('events')\
            .select('image_url')\
            .eq('series_id', series['id'])\
            .not_.is_('image_url', 'null')\
            .limit(1)\
            .execute()

        if events.data and events.data[0].get('image_url'):
            img_url = events.data[0]['image_url']

            if dry_run:
                if updated_count < 10 or updated_count % 10 == 0:
                    print(f"  [{i}/{len(series_list)}] Would update: {series['title']} ({series['series_type']})")
            else:
                client.table('series')\
                    .update({'image_url': img_url})\
                    .eq('id', series['id'])\
                    .execute()
                if updated_count < 10 or updated_count % 10 == 0:
                    print(f"  [{i}/{len(series_list)}] ✓ Updated: {series['title']} ({series['series_type']})")

            updated_count += 1
        else:
            skipped_count += 1
    
    print("\nResults:")
    print(f"  Updated: {updated_count}")
    print(f"  Skipped (no event images): {skipped_count}")
    
    return updated_count

def main():
    args = sys.argv[1:]
    dry_run = '--dry-run' in args
    descriptions_only = '--descriptions' in args
    images_only = '--images' in args
    
    cfg = get_config()
    client = create_client(cfg.database.supabase_url, cfg.database.supabase_service_key)
    
    print("=" * 80)
    print("SERIES DATA BACKFILL FROM EVENTS")
    print("=" * 80)
    
    if dry_run:
        print("\n⚠️  DRY RUN MODE - No changes will be made")
    
    print(f"\nMode: {'Descriptions only' if descriptions_only else 'Images only' if images_only else 'Both'}")
    print()
    
    total_updated = 0
    
    if not images_only:
        total_updated += backfill_descriptions(client, dry_run)
    
    if not descriptions_only:
        total_updated += backfill_images(client, dry_run)
    
    print("\n" + "=" * 80)
    print("BACKFILL COMPLETE")
    print("=" * 80)
    print(f"Total series enriched: {total_updated}")
    
    if dry_run:
        print("\n💡 Run without --dry-run to apply changes")

if __name__ == "__main__":
    main()
