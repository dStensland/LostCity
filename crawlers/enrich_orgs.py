#!/usr/bin/env python3
"""
Enrich organizations with missing logos, descriptions, and website metadata.

Usage:
    python enrich_orgs.py [--dry-run] [--limit N]

Examples:
    python enrich_orgs.py --dry-run --limit 20
    python enrich_orgs.py --limit 100
"""

import argparse
import time
import logging
from typing import Optional, Tuple
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from db import get_client

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Rate limiting
REQUEST_DELAY = 1.0  # seconds between requests


def extract_logo_url(soup: BeautifulSoup, base_url: str) -> Optional[str]:
    """
    Extract logo URL from HTML.

    Priority:
    1. <meta property="og:image">
    2. <link rel="icon" type="image/png"> (larger icons)
    3. <img> tags with "logo" in class/id/alt/src
    """
    # Try og:image first
    og_image = soup.find('meta', property='og:image')
    if og_image and og_image.get('content'):
        url = og_image['content']
        return urljoin(base_url, url)

    # Try apple-touch-icon (usually high quality)
    apple_icon = soup.find('link', rel='apple-touch-icon')
    if apple_icon and apple_icon.get('href'):
        href = apple_icon['href']
        # Only use if it's a PNG and reasonably sized
        if '.png' in href.lower():
            return urljoin(base_url, href)

    # Try link rel="icon" with PNG type
    icon_link = soup.find('link', rel='icon', type='image/png')
    if icon_link and icon_link.get('href'):
        href = icon_link['href']
        # Prefer larger icons (skip favicons)
        if 'favicon' not in href.lower():
            return urljoin(base_url, href)

    # Try img tags with "logo" in attributes
    logo_candidates = []
    for img in soup.find_all('img'):
        score = 0
        img_class = ' '.join(img.get('class', [])).lower()
        img_id = (img.get('id') or '').lower()
        img_alt = (img.get('alt') or '').lower()
        img_src = (img.get('src') or '').lower()

        # Score based on logo-related keywords
        if 'logo' in img_class:
            score += 3
        if 'logo' in img_id:
            score += 3
        if 'logo' in img_alt:
            score += 2
        if 'logo' in img_src:
            score += 2

        # Penalize small images (likely icons)
        if 'icon' in img_src or 'favicon' in img_src:
            score -= 5

        if score > 0 and img.get('src'):
            logo_candidates.append((score, img['src']))

    if logo_candidates:
        # Sort by score (highest first) and return best match
        logo_candidates.sort(reverse=True, key=lambda x: x[0])
        return urljoin(base_url, logo_candidates[0][1])

    return None


def extract_description(soup: BeautifulSoup) -> Optional[str]:
    """
    Extract description from meta tags.

    Priority:
    1. <meta name="description">
    2. <meta property="og:description">
    """
    # Try standard meta description
    meta_desc = soup.find('meta', attrs={'name': 'description'})
    if meta_desc and meta_desc.get('content'):
        content = meta_desc['content'].strip()
        if content and len(content) > 20:  # Ignore very short descriptions
            return content

    # Try og:description
    og_desc = soup.find('meta', property='og:description')
    if og_desc and og_desc.get('content'):
        content = og_desc['content'].strip()
        if content and len(content) > 20:
            return content

    return None


def fetch_website_metadata(url: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Fetch website and extract logo URL and description.

    Returns:
        Tuple of (logo_url, description)
    """
    try:
        # Add timeout and user agent
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        response = requests.get(url, timeout=10, headers=headers, allow_redirects=True)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')

        # Use final URL after redirects as base
        base_url = response.url

        logo_url = extract_logo_url(soup, base_url)
        description = extract_description(soup)

        return logo_url, description

    except requests.Timeout:
        logger.warning(f"Timeout fetching {url}")
        return None, None
    except requests.RequestException as e:
        logger.warning(f"Error fetching {url}: {e}")
        return None, None
    except Exception as e:
        logger.warning(f"Unexpected error parsing {url}: {e}")
        return None, None


def enrich_organizations(dry_run: bool = False, limit: int = 200) -> None:
    """
    Enrich organizations missing logos or descriptions.

    Args:
        dry_run: If True, only print what would be updated
        limit: Maximum number of organizations to process
    """
    client = get_client()

    # Query organizations missing key fields
    logger.info("Querying organizations with missing data...")

    result = client.table("organizations").select(
        "id, name, slug, website, logo_url, description"
    ).or_(
        "logo_url.is.null,description.is.null"
    ).not_.is_(
        "website", "null"
    ).limit(limit).execute()

    orgs = result.data or []

    logger.info(f"Found {len(orgs)} organizations with websites but missing logos/descriptions")

    if not orgs:
        logger.info("No organizations to enrich")
        return

    # Track statistics
    stats = {
        'total': len(orgs),
        'processed': 0,
        'logos_found': 0,
        'descriptions_found': 0,
        'updated': 0,
        'errors': 0,
    }

    for org in orgs:
        org_id = org['id']
        name = org['name']
        slug = org['slug']
        website = org['website']
        has_logo = org.get('logo_url') is not None
        has_description = org.get('description') is not None

        logger.info(f"\nProcessing: {name} ({slug})")
        logger.info(f"  Website: {website}")
        logger.info(f"  Has logo: {has_logo}, Has description: {has_description}")

        # Skip if already has both
        if has_logo and has_description:
            logger.info("  Skipping: already has both logo and description")
            continue

        # Fetch metadata
        logo_url, description = fetch_website_metadata(website)

        # Prepare update data (only update NULL fields)
        update_data = {}

        if logo_url and not has_logo:
            update_data['logo_url'] = logo_url
            stats['logos_found'] += 1
            logger.info(f"  Found logo: {logo_url[:100]}")

        if description and not has_description:
            # Truncate if too long
            if len(description) > 2000:
                description = description[:1997] + "..."
            update_data['description'] = description
            stats['descriptions_found'] += 1
            logger.info(f"  Found description: {description[:100]}...")

        # Update database
        if update_data:
            if dry_run:
                logger.info(f"  [DRY RUN] Would update: {list(update_data.keys())}")
            else:
                try:
                    client.table("organizations").update(update_data).eq("id", org_id).execute()
                    stats['updated'] += 1
                    logger.info(f"  Updated: {list(update_data.keys())}")
                except Exception as e:
                    stats['errors'] += 1
                    logger.error(f"  Error updating organization {org_id}: {e}")
        else:
            logger.info("  No new metadata found")

        stats['processed'] += 1

        # Rate limiting
        time.sleep(REQUEST_DELAY)

    # Print summary
    logger.info("\n" + "="*60)
    logger.info("SUMMARY")
    logger.info("="*60)
    logger.info(f"Total organizations: {stats['total']}")
    logger.info(f"Processed: {stats['processed']}")
    logger.info(f"Logos found: {stats['logos_found']}")
    logger.info(f"Descriptions found: {stats['descriptions_found']}")
    logger.info(f"Organizations updated: {stats['updated']}")
    logger.info(f"Errors: {stats['errors']}")

    if dry_run:
        logger.info("\n[DRY RUN MODE] No changes were made to the database")


def main():
    parser = argparse.ArgumentParser(
        description="Enrich organizations with missing logos and descriptions"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be updated without making changes"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=200,
        help="Maximum number of organizations to process (default: 200)"
    )

    args = parser.parse_args()

    enrich_organizations(dry_run=args.dry_run, limit=args.limit)


if __name__ == "__main__":
    main()
