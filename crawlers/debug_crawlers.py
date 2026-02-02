#!/usr/bin/env python3
"""
Debug script to inspect Nashville arts/culture crawler pages.
Saves the actual HTML and text content for inspection.
"""

import asyncio
from playwright.async_api import async_playwright
import sys

PAGES = {
    "tpac": "https://www.tpac.org/events",
    "schermerhorn": "https://www.nashvillesymphony.org/tickets/",
    "belcourt": "https://www.belcourt.org/events/",
    "frist": "https://fristartmuseum.org/calendar",
    "country-music-hof": "https://www.countrymusichalloffame.org/calendar",
    "franklin": "https://www.franklintheatre.com/all-events/",
}


async def inspect_page(name: str, url: str):
    """Inspect a page and save its content."""
    print(f"\n{'='*60}")
    print(f"Inspecting: {name}")
    print(f"URL: {url}")
    print(f"{'='*60}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1920, "height": 1080},
        )
        page = await context.new_page()

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(3000)

            # Scroll to load content
            for _ in range(3):
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await page.wait_for_timeout(1000)

            # Get HTML
            html = await page.content()
            html_file = f"/tmp/{name}_page.html"
            with open(html_file, "w", encoding="utf-8") as f:
                f.write(html)
            print(f"HTML saved to: {html_file}")

            # Get text
            body_text = await page.inner_text("body")
            text_file = f"/tmp/{name}_text.txt"
            with open(text_file, "w", encoding="utf-8") as f:
                f.write(body_text)
            print(f"Text saved to: {text_file}")

            # Print first 100 lines
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]
            print(f"\nFirst 50 lines of text content:")
            print("-" * 60)
            for i, line in enumerate(lines[:50], 1):
                print(f"{i:3d}: {line[:120]}")

        except Exception as e:
            print(f"Error: {e}")

        finally:
            await browser.close()


async def main():
    """Run inspection for specified page or all pages."""
    if len(sys.argv) > 1:
        name = sys.argv[1]
        if name in PAGES:
            await inspect_page(name, PAGES[name])
        else:
            print(f"Unknown page: {name}")
            print(f"Available: {', '.join(PAGES.keys())}")
    else:
        # Inspect all
        for name, url in PAGES.items():
            await inspect_page(name, url)
            print("\n")


if __name__ == "__main__":
    asyncio.run(main())
