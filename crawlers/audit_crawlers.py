#!/usr/bin/env python3
"""
Comprehensive crawler audit script.
Checks for import errors, invalid categories, and common anti-patterns.
"""

import os
import re
import sys
import importlib
from pathlib import Path

# Valid categories from CLAUDE.md
VALID_CATEGORIES = {
    'music', 'film', 'comedy', 'theater', 'art', 'sports', 'food_drink',
    'nightlife', 'community', 'fitness', 'family', 'learning', 'dance',
    'tours', 'meetup', 'words', 'religious', 'markets', 'wellness',
    'support_group', 'gaming', 'outdoors', 'other'
}

# Patterns that might indicate permanent attractions
PERMANENT_ATTRACTION_PATTERNS = [
    r'general\s+admission',
    r'daily\s+operation',
    r'open\s+daily',
    r'visit\s+the\s+museum',
    r'play\s+at\s+the',
    r'mini\s+golf',
    r'skyride',
    r'permanent\s+exhibit',
]

def check_imports():
    """Test import of every crawler module."""
    sources_dir = Path(__file__).parent / 'sources'
    results = {
        'total': 0,
        'success': 0,
        'failures': [],
        'no_crawl': []
    }

    for file in sorted(sources_dir.glob('*.py')):
        if file.name.startswith('_'):
            continue

        results['total'] += 1
        module_name = file.stem

        try:
            # Import the module
            mod = importlib.import_module(f'sources.{module_name}')

            # Check if it has a crawl function
            if not hasattr(mod, 'crawl'):
                results['no_crawl'].append(module_name)
            else:
                results['success'] += 1

        except Exception as e:
            results['failures'].append({
                'module': module_name,
                'error': str(e)
            })

    return results

def check_categories():
    """Check for invalid category assignments."""
    sources_dir = Path(__file__).parent / 'sources'
    results = []

    # Pattern to match category assignments
    category_pattern = re.compile(r'"category"\s*:\s*"([^"]+)"')

    for file in sorted(sources_dir.glob('*.py')):
        if file.name.startswith('_'):
            continue

        content = file.read_text()

        for line_num, line in enumerate(content.split('\n'), 1):
            matches = category_pattern.findall(line)
            for category in matches:
                if category not in VALID_CATEGORIES:
                    results.append({
                        'file': file.name,
                        'line': line_num,
                        'category': category,
                        'line_text': line.strip()
                    })

    return results

def check_is_all_day_inference():
    """Check for is_all_day being set based on missing time."""
    sources_dir = Path(__file__).parent / 'sources'
    results = []

    # Patterns that suggest inferring is_all_day from missing time
    suspicious_patterns = [
        r'if\s+not\s+start_time.*is_all_day.*True',
        r'is_all_day.*not\s+start_time',
        r'is_all_day.*start_time\s+is\s+None',
        r'is_all_day.*start_time\s*==\s*None',
    ]

    for file in sorted(sources_dir.glob('*.py')):
        if file.name.startswith('_'):
            continue

        content = file.read_text()

        for line_num, line in enumerate(content.split('\n'), 1):
            for pattern in suspicious_patterns:
                if re.search(pattern, line, re.IGNORECASE):
                    results.append({
                        'file': file.name,
                        'line': line_num,
                        'line_text': line.strip()
                    })

    return results

def check_permanent_attractions():
    """Check for patterns suggesting permanent attraction events."""
    sources_dir = Path(__file__).parent / 'sources'
    results = []

    for file in sorted(sources_dir.glob('*.py')):
        if file.name.startswith('_'):
            continue

        content = file.read_text()

        for line_num, line in enumerate(content.split('\n'), 1):
            for pattern in PERMANENT_ATTRACTION_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    results.append({
                        'file': file.name,
                        'line': line_num,
                        'pattern': pattern,
                        'line_text': line.strip()
                    })

    return results

def check_missing_dedup():
    """Check for insert_event calls without dedup checks."""
    sources_dir = Path(__file__).parent / 'sources'
    results = []

    for file in sorted(sources_dir.glob('*.py')):
        if file.name.startswith('_'):
            continue

        content = file.read_text()

        # Check if file calls insert_event but not find_event_by_hash
        has_insert = 'insert_event' in content
        has_dedup = 'find_event_by_hash' in content or 'generate_content_hash' in content

        if has_insert and not has_dedup:
            # Count insert_event calls
            insert_count = content.count('insert_event(')
            results.append({
                'file': file.name,
                'insert_count': insert_count
            })

    return results

def check_hardcoded_dates():
    """Check for hardcoded year values that will break."""
    sources_dir = Path(__file__).parent / 'sources'
    results = []

    # Patterns for hardcoded years
    year_patterns = [
        r'202[67]',  # Hardcoded 2026 or 2027
    ]

    for file in sorted(sources_dir.glob('*.py')):
        if file.name.startswith('_'):
            continue

        content = file.read_text()

        for line_num, line in enumerate(content.split('\n'), 1):
            # Skip comments
            if line.strip().startswith('#'):
                continue

            for pattern in year_patterns:
                if re.search(pattern, line):
                    # Skip if it's in a URL or part of datetime.now()
                    if 'http' not in line.lower() and 'datetime.now' not in line:
                        results.append({
                            'file': file.name,
                            'line': line_num,
                            'line_text': line.strip()
                        })

    return results

def print_report(import_results, category_results, all_day_results,
                 permanent_results, dedup_results, date_results):
    """Print formatted audit report."""

    print("=" * 80)
    print("CRAWLER AUDIT REPORT")
    print("=" * 80)
    print()

    # Import test results
    print("1. IMPORT TEST")
    print("-" * 80)
    print(f"Total crawlers checked: {import_results['total']}")
    print(f"Successfully imported: {import_results['success']}")
    print(f"Import failures: {len(import_results['failures'])}")
    print(f"Missing crawl() function: {len(import_results['no_crawl'])}")
    print()

    if import_results['failures']:
        print("Import Failures:")
        for failure in import_results['failures'][:20]:  # Limit to first 20
            print(f"  - {failure['module']}: {failure['error']}")
        if len(import_results['failures']) > 20:
            print(f"  ... and {len(import_results['failures']) - 20} more")
        print()

    if import_results['no_crawl']:
        print("Missing crawl() function:")
        for module in import_results['no_crawl'][:10]:
            print(f"  - {module}")
        if len(import_results['no_crawl']) > 10:
            print(f"  ... and {len(import_results['no_crawl']) - 10} more")
        print()

    # Invalid categories
    print("2. INVALID CATEGORIES")
    print("-" * 80)
    print(f"Invalid category assignments found: {len(category_results)}")
    print()

    if category_results:
        print("Issues found:")
        for issue in category_results[:20]:
            print(f"  {issue['file']}:{issue['line']} - '{issue['category']}'")
            print(f"    {issue['line_text']}")
        if len(category_results) > 20:
            print(f"  ... and {len(category_results) - 20} more")
        print()

    # is_all_day inference
    print("3. is_all_day INFERENCE FROM MISSING TIME")
    print("-" * 80)
    print(f"Suspicious patterns found: {len(all_day_results)}")
    print()

    if all_day_results:
        print("Issues found:")
        for issue in all_day_results[:20]:
            print(f"  {issue['file']}:{issue['line']}")
            print(f"    {issue['line_text']}")
        if len(all_day_results) > 20:
            print(f"  ... and {len(all_day_results) - 20} more")
        print()

    # Permanent attractions
    print("4. PERMANENT ATTRACTION PATTERNS")
    print("-" * 80)
    print(f"Suspicious patterns found: {len(permanent_results)}")
    print()

    if permanent_results:
        print("Issues found:")
        for issue in permanent_results[:20]:
            print(f"  {issue['file']}:{issue['line']} - pattern: {issue['pattern']}")
            print(f"    {issue['line_text']}")
        if len(permanent_results) > 20:
            print(f"  ... and {len(permanent_results) - 20} more")
        print()

    # Missing dedup
    print("5. MISSING DEDUP CHECKS")
    print("-" * 80)
    print(f"Crawlers with insert_event but no dedup: {len(dedup_results)}")
    print()

    if dedup_results:
        print("Issues found:")
        for issue in dedup_results[:20]:
            print(f"  {issue['file']} - {issue['insert_count']} insert_event calls")
        if len(dedup_results) > 20:
            print(f"  ... and {len(dedup_results) - 20} more")
        print()

    # Hardcoded dates
    print("6. HARDCODED DATES")
    print("-" * 80)
    print(f"Hardcoded year values found: {len(date_results)}")
    print()

    if date_results:
        print("Issues found:")
        for issue in date_results[:20]:
            print(f"  {issue['file']}:{issue['line']}")
            print(f"    {issue['line_text']}")
        if len(date_results) > 20:
            print(f"  ... and {len(date_results) - 20} more")
        print()

    # Summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    total_issues = (
        len(import_results['failures']) +
        len(import_results['no_crawl']) +
        len(category_results) +
        len(all_day_results) +
        len(permanent_results) +
        len(dedup_results) +
        len(date_results)
    )

    print(f"Total crawlers: {import_results['total']}")
    print(f"Total issues found: {total_issues}")
    print()

    if total_issues == 0:
        print("✓ ALL CHECKS PASSED")
        return 0
    else:
        print("✗ ISSUES FOUND - See details above")
        return 1

def main():
    print("Starting comprehensive crawler audit...")
    print()

    # Run all checks
    import_results = check_imports()
    category_results = check_categories()
    all_day_results = check_is_all_day_inference()
    permanent_results = check_permanent_attractions()
    dedup_results = check_missing_dedup()
    date_results = check_hardcoded_dates()

    # Print report
    exit_code = print_report(
        import_results,
        category_results,
        all_day_results,
        permanent_results,
        dedup_results,
        date_results
    )

    sys.exit(exit_code)

if __name__ == '__main__':
    main()
