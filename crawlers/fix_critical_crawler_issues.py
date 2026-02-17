#!/usr/bin/env python3
"""
Quick fix script for critical crawler issues found in audit.
Run with: python3 fix_critical_crawler_issues.py --dry-run (to preview)
Run with: python3 fix_critical_crawler_issues.py (to apply fixes)
"""

import argparse
import re
from pathlib import Path

# Category fixes
CATEGORY_FIXES = {
    "sources/aclu_georgia.py": [
        ('"category": "activism"', '"category": "community"')
    ],
    "sources/atlanta_liberation_center.py": [
        ('"category": "activism"', '"category": "community"')
    ],
    "sources/georgia_equality.py": [
        ('"category": "activism"', '"category": "community"')
    ],
    "sources/glahr.py": [
        ('"category": "activism"', '"category": "community"')
    ],
    "sources/indivisible_atl.py": [
        ('"category": "activism"', '"category": "community"')
    ],
    "sources/home_depot_backyard.py": [
        ('"category": "food"', '"category": "food_drink"'),
        ('"category": "arts"', '"category": "art"')
    ],
}

# is_all_day fixes
IS_ALL_DAY_FIXES = {
    "sources/advancing_justice_atlanta.py": [
        ('"is_all_day": start_time is None', '"is_all_day": False  # Set explicitly, not inferred from missing time')
    ],
    "sources/hammonds_house.py": [
        ('"is_all_day": start_time is None', '"is_all_day": False  # Set explicitly, not inferred from missing time')
    ],
    "sources/keep_atlanta_beautiful.py": [
        ('"is_all_day": start_time is None', '"is_all_day": False  # Set explicitly, not inferred from missing time')
    ],
    "sources/second_helpings_atlanta.py": [
        ('"is_all_day": start_time is None', '"is_all_day": False  # Set explicitly, not inferred from missing time')
    ],
}

# Spelman needs manual review due to compound logic
MANUAL_REVIEW = {
    "sources/spelman_college.py": "Line 524: Complex is_all_day logic needs manual review",
    "sources/apex_museum.py": "Lines 108-177: Remove permanent exhibition creation entirely",
    "sources/fernbank_science_center.py": "Lines 143-144: Verify permanent exhibits are filtered",
}

def apply_fixes(file_path: str, replacements: list[tuple[str, str]], dry_run: bool) -> int:
    """Apply replacements to a file. Returns number of replacements made."""
    path = Path(file_path)

    if not path.exists():
        print(f"  ⚠️  File not found: {file_path}")
        return 0

    content = path.read_text()
    original_content = content
    replacements_made = 0

    for old, new in replacements:
        count = content.count(old)
        if count > 0:
            content = content.replace(old, new)
            replacements_made += count
            print(f"  ✓ Replaced {count}x: {old[:50]}... → {new[:50]}...")

    if replacements_made > 0 and not dry_run:
        path.write_text(content)
        print(f"  ✓ Wrote changes to {file_path}")
    elif replacements_made > 0 and dry_run:
        print(f"  [DRY RUN] Would write {replacements_made} changes to {file_path}")
    else:
        print(f"  ℹ️  No changes needed in {file_path}")

    return replacements_made

def main():
    parser = argparse.ArgumentParser(description="Fix critical crawler issues")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without applying")
    args = parser.parse_args()

    print("=" * 80)
    print("CRAWLER CRITICAL ISSUES FIX SCRIPT")
    print("=" * 80)
    if args.dry_run:
        print("🔍 DRY RUN MODE - No changes will be written")
    print()

    total_fixes = 0

    # Category fixes
    print("1. FIXING INVALID CATEGORIES")
    print("-" * 80)
    for file_path, replacements in CATEGORY_FIXES.items():
        print(f"\n{file_path}:")
        total_fixes += apply_fixes(file_path, replacements, args.dry_run)

    # is_all_day fixes
    print("\n2. FIXING is_all_day INFERENCE")
    print("-" * 80)
    for file_path, replacements in IS_ALL_DAY_FIXES.items():
        print(f"\n{file_path}:")
        total_fixes += apply_fixes(file_path, replacements, args.dry_run)

    # Manual review items
    print("\n3. MANUAL REVIEW REQUIRED")
    print("-" * 80)
    for file_path, note in MANUAL_REVIEW.items():
        print(f"⚠️  {file_path}")
        print(f"   {note}")

    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Automated fixes applied: {total_fixes}")
    print(f"Files requiring manual review: {len(MANUAL_REVIEW)}")

    if args.dry_run:
        print("\n🔍 This was a dry run. Re-run without --dry-run to apply changes.")
    else:
        print("\n✓ Fixes applied! Review manual items next.")
        print("\nNext steps:")
        print("1. Review and fix the 3 files requiring manual review")
        print("2. Run: python3 audit_crawlers.py")
        print("3. Run: python3 -m pytest tests/")
        print("4. Commit changes")

if __name__ == "__main__":
    main()
