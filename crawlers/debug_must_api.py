#!/usr/bin/env python3
"""
Debug script to inspect MUST Ministries VolunteerHub API response structure.
"""

import json
from playwright.sync_api import sync_playwright

VOLUNTEERHUB_URL = "https://mustministries.volunteerhub.com/vv2/"

def debug_api():
    """Capture and display the VolunteerHub API response."""
    api_data = None

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1920, "height": 1080},
        )

        def capture_api(response):
            nonlocal api_data
            if "volunteerview/view/index" in response.url:
                try:
                    api_data = response.json()
                    print(f"\n=== API Response Captured from {response.url} ===\n")
                except Exception as e:
                    print(f"Failed to parse API response: {e}")

        page = context.new_page()
        page.on("response", capture_api)

        print(f"Fetching: {VOLUNTEERHUB_URL}")
        page.goto(VOLUNTEERHUB_URL, wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(5000)

        # Scroll to trigger lazy loading
        for i in range(5):
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(1000)

        page.wait_for_timeout(3000)

        browser.close()

    if api_data:
        print(f"API Data Type: {type(api_data)}")
        if isinstance(api_data, dict):
            print(f"\nTop-level keys: {list(api_data.keys())}")

            # Check days array
            days = api_data.get("days", [])
            print(f"\nDays array length: {len(days) if days else 0}")

            if days and len(days) > 0:
                print(f"\n=== First Day Sample ===")
                print(json.dumps(days[0], indent=2, default=str))
            else:
                print("\nDays array is empty - no events found")

            print(f"\n=== Event Group Items (first 10) ===")
            event_groups = api_data.get("eventGroupSelectItems", [])
            for group in event_groups[:10]:
                print(f"  - {group.get('text')}")
        else:
            print(f"\nAPI Data: {api_data}")
    else:
        print("\nNo API data captured")

if __name__ == "__main__":
    debug_api()
