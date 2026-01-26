"""
Fetch logos for event producers from their websites or Instagram.
Can be run standalone or as part of the daily crawl.
"""

import re
import argparse
import requests
from typing import Optional
from db import get_client


def fetch_logo_from_website(website_url: str) -> Optional[str]:
    """Try to extract logo URL from website."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; LostCityBot/1.0)"
        }
        response = requests.get(website_url, headers=headers, timeout=10)
        if not response.ok:
            return None

        html = response.text
        base_url = f"{response.url.split('/')[0]}//{response.url.split('/')[2]}"

        # Try different logo sources in order of preference
        patterns = [
            # Apple touch icon (usually high quality)
            r'<link[^>]*rel=["\']apple-touch-icon["\'][^>]*href=["\']([^"\']+)["\']',
            r'<link[^>]*href=["\']([^"\']+)["\'][^>]*rel=["\']apple-touch-icon["\']',
            # Open Graph image
            r'<meta[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']',
            r'<meta[^>]*content=["\']([^"\']+)["\'][^>]*property=["\']og:image["\']',
            # Twitter image
            r'<meta[^>]*name=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']',
            # Large favicon
            r'<link[^>]*rel=["\']icon["\'][^>]*sizes=["\'](?:192|180|152|144|120|96)[^"\']*["\'][^>]*href=["\']([^"\']+)["\']',
            # Any favicon
            r'<link[^>]*rel=["\'](?:shortcut )?icon["\'][^>]*href=["\']([^"\']+)["\']',
        ]

        for pattern in patterns:
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                logo_url = match.group(1)
                # Convert relative URLs to absolute
                if logo_url.startswith("/"):
                    logo_url = base_url + logo_url
                elif not logo_url.startswith("http"):
                    logo_url = base_url + "/" + logo_url
                return logo_url

        # Fallback: try standard favicon.ico
        favicon_url = f"{base_url}/favicon.ico"
        try:
            favicon_res = requests.head(favicon_url, timeout=5)
            if favicon_res.ok:
                return favicon_url
        except:
            pass

        return None
    except Exception as e:
        print(f"  Error fetching website {website_url}: {e}")
        return None


def fetch_instagram_avatar(instagram_handle: str) -> Optional[str]:
    """Try to get Instagram profile pic."""
    try:
        # Clean the handle
        handle = instagram_handle.lstrip("@").rstrip("/")
        if "/" in handle:
            handle = handle.split("/")[-1]

        profile_url = f"https://www.instagram.com/{handle}/"

        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }
        response = requests.get(profile_url, headers=headers, timeout=10)
        if not response.ok:
            return None

        html = response.text

        # Try to find og:image which is usually the profile pic
        match = re.search(
            r'<meta[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']',
            html,
            re.IGNORECASE
        )
        if match:
            return match.group(1)

        return None
    except Exception as e:
        print(f"  Error fetching Instagram {instagram_handle}: {e}")
        return None


def fetch_logos(overwrite: bool = False, producer_ids: list[str] = None, dry_run: bool = False):
    """Fetch logos for producers missing them."""
    client = get_client()

    # Build query
    query = client.table("event_producers").select(
        "id, name, website, instagram, logo_url"
    ).eq("hidden", False)

    if producer_ids:
        query = query.in_("id", producer_ids)

    if not overwrite:
        query = query.is_("logo_url", "null")

    result = query.order("name").execute()
    producers = result.data or []

    if not producers:
        print("No producers to update")
        return {"success": 0, "failed": 0, "skipped": 0}

    print(f"Found {len(producers)} producers to process")

    success = 0
    failed = 0
    skipped = 0

    for producer in producers:
        name = producer["name"]

        # Skip if already has logo and not overwriting
        if producer.get("logo_url") and not overwrite:
            print(f"  [{name}] Skipped - already has logo")
            skipped += 1
            continue

        logo_url = None

        # Try website first
        if producer.get("website"):
            print(f"  [{name}] Trying website: {producer['website']}")
            logo_url = fetch_logo_from_website(producer["website"])

        # Fall back to Instagram
        if not logo_url and producer.get("instagram"):
            print(f"  [{name}] Trying Instagram: {producer['instagram']}")
            logo_url = fetch_instagram_avatar(producer["instagram"])

        if logo_url:
            print(f"  [{name}] Found logo: {logo_url[:60]}...")

            if not dry_run:
                try:
                    client.table("event_producers").update({
                        "logo_url": logo_url
                    }).eq("id", producer["id"]).execute()
                    success += 1
                except Exception as e:
                    print(f"  [{name}] Failed to update: {e}")
                    failed += 1
            else:
                print(f"  [{name}] Would update (dry run)")
                success += 1
        else:
            print(f"  [{name}] No logo found")
            failed += 1

    print(f"\nResults: {success} success, {failed} failed, {skipped} skipped")
    return {"success": success, "failed": failed, "skipped": skipped}


def main():
    parser = argparse.ArgumentParser(description="Fetch logos for event producers")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing logos")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually update database")
    parser.add_argument("--producer", type=str, help="Specific producer ID to update")

    args = parser.parse_args()

    producer_ids = [args.producer] if args.producer else None

    fetch_logos(
        overwrite=args.overwrite,
        producer_ids=producer_ids,
        dry_run=args.dry_run
    )


if __name__ == "__main__":
    main()
