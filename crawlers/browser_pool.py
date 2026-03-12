"""
Reusable Playwright browser pool for crawler sources.

Instead of each Playwright-based crawler launching its own browser,
they can acquire a pre-warmed browser context from the pool.

Usage:
    from browser_pool import browser_pool

    # In a crawler's crawl() function:
    context = browser_pool.acquire()
    try:
        page = context.new_page()
        page.goto(url)
        # ... scrape ...
    finally:
        browser_pool.release(context)

    # Or as a context manager:
    with browser_pool.acquire_context() as context:
        page = context.new_page()
        # ...
"""

import logging
import threading
from contextlib import contextmanager
from typing import Optional

from playwright.sync_api import sync_playwright, Playwright, Browser, BrowserContext

logger = logging.getLogger(__name__)

DEFAULT_POOL_SIZE = 3
DEFAULT_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


class BrowserPool:
    """Pool of reusable Playwright Chromium browser contexts.

    Launches N browser instances at startup. Crawlers acquire/release
    contexts instead of managing their own browser lifecycle.
    """

    def __init__(self, size: int = DEFAULT_POOL_SIZE):
        self._size = size
        self._playwright: Optional[Playwright] = None
        self._browsers: list[Browser] = []
        self._available: list[Browser] = []
        self._lock = threading.Lock()
        self._semaphore = threading.Semaphore(size)
        self._started = False

    def start(self):
        """Launch browser instances. Call once before acquiring contexts."""
        if self._started:
            return

        self._playwright = sync_playwright().start()
        for i in range(self._size):
            try:
                browser = self._playwright.chromium.launch(headless=True)
                self._browsers.append(browser)
                self._available.append(browser)
                logger.debug(f"Browser pool: launched instance {i+1}/{self._size}")
            except Exception as e:
                logger.error(f"Browser pool: failed to launch instance {i+1}: {e}")

        self._started = True
        logger.info(f"Browser pool started with {len(self._browsers)} instances")

    def acquire(self, user_agent: str = DEFAULT_USER_AGENT) -> BrowserContext:
        """Acquire a browser context from the pool.

        Blocks if all browsers are in use. The returned context
        should be released via release() when done.
        """
        if not self._started:
            self.start()

        self._semaphore.acquire()
        with self._lock:
            if not self._available:
                # All browsers busy — shouldn't happen with semaphore, but safety net
                logger.warning("Browser pool exhausted, launching overflow instance")
                browser = self._playwright.chromium.launch(headless=True)
                self._browsers.append(browser)
            else:
                browser = self._available.pop()

        context = browser.new_context(
            user_agent=user_agent,
            viewport={"width": 1920, "height": 1080},
        )
        # Tag context with its parent browser for release
        context._pool_browser = browser
        return context

    def release(self, context: BrowserContext):
        """Release a browser context back to the pool."""
        browser = getattr(context, "_pool_browser", None)
        try:
            context.close()
        except Exception:
            pass

        if browser:
            with self._lock:
                self._available.append(browser)
            self._semaphore.release()

    @contextmanager
    def acquire_context(self, user_agent: str = DEFAULT_USER_AGENT):
        """Context manager for acquiring and releasing a browser context."""
        context = self.acquire(user_agent=user_agent)
        try:
            yield context
        finally:
            self.release(context)

    def shutdown(self):
        """Close all browsers and stop Playwright."""
        for browser in self._browsers:
            try:
                browser.close()
            except Exception:
                pass
        self._browsers.clear()
        self._available.clear()

        if self._playwright:
            try:
                self._playwright.stop()
            except Exception:
                pass
            self._playwright = None

        self._started = False
        logger.info("Browser pool shut down")


# Module-level singleton — lazy-started on first acquire()
browser_pool = BrowserPool()
