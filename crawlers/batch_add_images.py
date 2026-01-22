#!/usr/bin/env python3
"""
Batch script to add image extraction to all crawlers.
"""

import os
import re
import sys

SOURCES_DIR = "sources"


def update_playwright_crawler(filepath: str) -> bool:
    """Update a Playwright-based crawler to extract images."""
    with open(filepath, "r") as f:
        content = f.read()

    # Skip if already has image extraction
    if "extract_images_from_page" in content or "extract_movie_images" in content:
        return False

    # Skip if no "image_url": None
    if '"image_url": None' not in content:
        return False

    modified = False
    lines = content.split("\n")
    new_lines = []

    # Track state
    added_import = False
    in_crawl_function = False
    added_image_extraction = False
    page_var_name = "page"

    for i, line in enumerate(lines):
        # Add import after other imports
        if not added_import and line.startswith("from dedupe import"):
            new_lines.append(line)
            new_lines.append("from utils import extract_images_from_page")
            added_import = True
            modified = True
            continue

        # Detect page variable and add image extraction after page loads
        if not added_image_extraction and "wait_for_timeout" in line and "page" in content:
            new_lines.append(line)
            # Check if next few lines don't already have image extraction
            remaining = "\n".join(lines[i+1:i+5])
            if "image_map" not in remaining and "extract_images" not in remaining:
                # Find indentation
                indent = len(line) - len(line.lstrip())
                indent_str = " " * indent
                new_lines.append("")
                new_lines.append(f"{indent_str}# Extract images from page")
                new_lines.append(f"{indent_str}image_map = extract_images_from_page(page)")
                added_image_extraction = True
                modified = True
            continue

        # Replace "image_url": None with image lookup
        if '"image_url": None' in line and added_image_extraction:
            # Find the title variable used in this context
            # Look back for title assignment
            title_var = "title"
            for j in range(max(0, i-20), i):
                if '"title":' in lines[j]:
                    match = re.search(r'"title":\s*(\w+)', lines[j])
                    if match:
                        title_var = match.group(1)
                        break

            # Get indentation
            indent = len(line) - len(line.lstrip())
            indent_str = " " * indent

            # Replace with image lookup
            new_line = line.replace(
                '"image_url": None',
                f'"image_url": image_map.get({title_var}, image_map.get({title_var}.split(" - ")[0] if " - " in {title_var} else {title_var}))'
            )
            # Simpler approach - just use dict.get with title
            new_line = line.replace(
                '"image_url": None',
                f'"image_url": image_map.get({title_var})'
            )
            new_lines.append(new_line)
            modified = True
            continue

        new_lines.append(line)

    if modified:
        with open(filepath, "w") as f:
            f.write("\n".join(new_lines))
        return True
    return False


def update_beautifulsoup_crawler(filepath: str) -> bool:
    """Update a BeautifulSoup-based crawler to extract images."""
    with open(filepath, "r") as f:
        content = f.read()

    # Skip if already has image extraction
    if "extract_image_url" in content:
        return False

    # Skip if no "image_url": None
    if '"image_url": None' not in content:
        return False

    modified = False
    lines = content.split("\n")
    new_lines = []

    added_import = False

    for i, line in enumerate(lines):
        # Add import after other imports
        if not added_import and line.startswith("from dedupe import"):
            new_lines.append(line)
            new_lines.append("from utils import extract_image_url")
            added_import = True
            modified = True
            continue

        # Replace "image_url": None with extract_image_url call
        if '"image_url": None' in line:
            # Try to find soup variable and base_url
            new_line = line.replace(
                '"image_url": None',
                '"image_url": extract_image_url(soup) if soup else None'
            )
            new_lines.append(new_line)
            modified = True
            continue

        new_lines.append(line)

    if modified:
        with open(filepath, "w") as f:
            f.write("\n".join(new_lines))
        return True
    return False


def main():
    updated_count = 0
    skipped_count = 0
    error_count = 0

    for filename in sorted(os.listdir(SOURCES_DIR)):
        if not filename.endswith(".py") or filename == "__init__.py":
            continue

        filepath = os.path.join(SOURCES_DIR, filename)

        try:
            with open(filepath, "r") as f:
                content = f.read()

            # Determine crawler type
            is_playwright = "playwright" in content or "sync_playwright" in content
            is_beautifulsoup = "BeautifulSoup" in content or "from bs4" in content

            if is_playwright:
                if update_playwright_crawler(filepath):
                    print(f"✓ Updated (Playwright): {filename}")
                    updated_count += 1
                else:
                    skipped_count += 1
            elif is_beautifulsoup:
                if update_beautifulsoup_crawler(filepath):
                    print(f"✓ Updated (BeautifulSoup): {filename}")
                    updated_count += 1
                else:
                    skipped_count += 1
            else:
                skipped_count += 1

        except Exception as e:
            print(f"✗ Error processing {filename}: {e}")
            error_count += 1

    print(f"\nSummary: {updated_count} updated, {skipped_count} skipped, {error_count} errors")


if __name__ == "__main__":
    main()
