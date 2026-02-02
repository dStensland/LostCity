#!/usr/bin/env python3
"""
Batch test crawlers to identify broken ones.
"""
import asyncio
import subprocess
import sys
from datetime import datetime

# High-priority sources to test
MUSIC_VENUES = [
    'the-masquerade',
    'center-stage',
    'roxy-theatre',
    'fox-theatre',
    'state-farm-arena',
    'mercedes-benz-stadium',
    'buckhead-theatre',
    'coca-cola-roxy',
]

THEATER_ARTS = [
    'alliance-theatre',
    'actors-express',
    'horizon-theatre',
    'dads-garage',
    'laughing-skull',
    'punchline-comedy',
]

ADDITIONAL_VENUES = [
    'terminal-west',
    'variety-playhouse',
    'eddie-attic',
    'star-community-bar',
    'smith-olde-bar',
    'aisle5',
    '529',
    'the-earl',
    'tabernacle',
    'chastain-park-amphitheatre',
]

def test_crawler(slug):
    """Test a single crawler and return results."""
    print(f"\nTesting {slug}...", flush=True)

    try:
        result = subprocess.run(
            ['python3', 'main.py', '--source', slug],
            capture_output=True,
            text=True,
            timeout=60
        )

        output = result.stdout + result.stderr

        # Parse output for event count
        event_count = 0
        error = None

        if result.returncode != 0:
            error = "Non-zero exit code"
            if "ModuleNotFoundError" in output:
                error = "Module not found"
            elif "Source not found" in output:
                error = "Source not found"
            elif "Traceback" in output:
                # Extract error type
                lines = output.split('\n')
                for i, line in enumerate(lines):
                    if 'Error:' in line or 'Exception:' in line:
                        error = line.strip()
                        break
                if not error:
                    error = "Unknown error (see traceback)"

        # Look for event count in output
        for line in output.split('\n'):
            if 'Found' in line and 'events' in line:
                try:
                    parts = line.split()
                    for i, part in enumerate(parts):
                        if part == 'Found' and i + 1 < len(parts):
                            event_count = int(parts[i + 1])
                            break
                except:
                    pass

        return {
            'slug': slug,
            'event_count': event_count,
            'error': error,
            'output': output
        }

    except subprocess.TimeoutExpired:
        return {
            'slug': slug,
            'event_count': 0,
            'error': 'Timeout (>60s)',
            'output': ''
        }
    except Exception as e:
        return {
            'slug': slug,
            'event_count': 0,
            'error': str(e),
            'output': ''
        }

def main():
    print("=" * 80)
    print("CRAWLER HEALTH CHECK")
    print("=" * 80)
    print(f"Started: {datetime.now().isoformat()}")

    all_sources = MUSIC_VENUES + THEATER_ARTS + ADDITIONAL_VENUES
    results = []

    for slug in all_sources:
        result = test_crawler(slug)
        results.append(result)

    # Categorize results
    working = [r for r in results if r['event_count'] > 0]
    broken = [r for r in results if r['event_count'] == 0 and not r['error']]
    errored = [r for r in results if r['error']]

    # Print summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)

    print(f"\n✓ WORKING ({len(working)}):")
    for r in working:
        print(f"  {r['slug']}: {r['event_count']} events")

    print(f"\n✗ BROKEN - Returns 0 events ({len(broken)}):")
    for r in broken:
        print(f"  {r['slug']}")

    print(f"\n⚠ ERRORS ({len(errored)}):")
    for r in errored:
        print(f"  {r['slug']}: {r['error']}")

    # Generate detailed report
    report = f"""# Crawler Health Report
Generated: {datetime.now().isoformat()}

## Summary

- **Total tested**: {len(results)}
- **Working**: {len(working)} ({len(working)*100//len(results)}%)
- **Broken** (0 events): {len(broken)} ({len(broken)*100//len(results)}%)
- **Errors**: {len(errored)} ({len(errored)*100//len(results)}%)

## Working Crawlers ({len(working)})

"""

    for r in sorted(working, key=lambda x: -x['event_count']):
        report += f"- **{r['slug']}**: {r['event_count']} events\n"

    report += f"\n## Broken Crawlers - Return 0 Events ({len(broken)})\n\n"

    for r in broken:
        report += f"### {r['slug']}\n\n"
        report += "**Status**: Returns 0 events but should have events\n\n"
        if r['output']:
            snippet = '\n'.join(r['output'].split('\n')[-10:])
            report += f"**Last 10 lines of output**:\n```\n{snippet}\n```\n\n"

    report += f"\n## Error Crawlers ({len(errored)})\n\n"

    for r in errored:
        report += f"### {r['slug']}\n\n"
        report += f"**Error**: {r['error']}\n\n"
        if r['output']:
            # Find traceback or error details
            lines = r['output'].split('\n')
            error_section = []
            capture = False
            for line in lines:
                if 'Traceback' in line or 'Error' in line or 'Exception' in line:
                    capture = True
                if capture:
                    error_section.append(line)

            if error_section:
                report += f"**Error details**:\n```\n" + '\n'.join(error_section[-20:]) + "\n```\n\n"

    report += "\n## Common Issues Identified\n\n"

    # Analyze common patterns
    module_errors = [r for r in errored if r['error'] and 'Module not found' in r['error']]
    source_not_found = [r for r in errored if r['error'] and 'Source not found' in r['error']]

    if module_errors:
        report += f"- **Missing crawler modules** ({len(module_errors)}): {', '.join([r['slug'] for r in module_errors])}\n"

    if source_not_found:
        report += f"- **Source not in database** ({len(source_not_found)}): {', '.join([r['slug'] for r in source_not_found])}\n"

    report += "\n## Next Steps\n\n"
    report += "1. **Fix broken crawlers** - Investigate why these return 0 events (site redesigns, changed URLs, etc.)\n"
    report += "2. **Fix error crawlers** - Address module/import issues and bugs\n"
    report += "3. **Test fixes** - Re-run this script to verify fixes work\n"
    report += "4. **Monitor** - Set up automated testing to catch breaks earlier\n"

    # Save report
    with open('/Users/coach/Projects/LostCity/crawlers/CRAWLER_HEALTH_REPORT.md', 'w') as f:
        f.write(report)

    print(f"\n\nReport saved to: /Users/coach/Projects/LostCity/crawlers/CRAWLER_HEALTH_REPORT.md")
    print(f"\nFinished: {datetime.now().isoformat()}")

if __name__ == '__main__':
    main()
