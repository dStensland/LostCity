"""
HTML fetch utilities for the pipeline.
"""

from __future__ import annotations

import logging
from typing import Optional, Tuple

import httpx
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from pipeline.models import FetchConfig

logger = logging.getLogger(__name__)


DEFAULT_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


def fetch_html(url: str, fetch: Optional[FetchConfig] = None) -> Tuple[str, Optional[str]]:
    """
    Fetch HTML for a URL.

    Returns: (html, error)
    """
    cfg = fetch or FetchConfig()
    ua = cfg.user_agent or DEFAULT_UA

    if not url:
        return "", "missing-url"

    if cfg.render_js:
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    user_agent=ua,
                    viewport={"width": 1920, "height": 1080},
                    ignore_https_errors=True,
                )
                page = context.new_page()
                try:
                    page.goto(url, wait_until="networkidle", timeout=cfg.timeout_ms)
                    page.wait_for_timeout(cfg.wait_ms)
                    html = page.content()
                    return html, None
                except PlaywrightTimeout:
                    return "", "timeout"
                finally:
                    browser.close()
        except Exception as e:
            return "", str(e)

    try:
        with httpx.Client(
            timeout=cfg.timeout_ms / 1000.0,
            headers={"User-Agent": ua},
            follow_redirects=True,
        ) as client:
            resp = client.get(url)
            resp.raise_for_status()
            return resp.text, None
    except Exception as e:
        return "", str(e)
