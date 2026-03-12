"""
HTML fetch utilities for the pipeline.
"""

from __future__ import annotations

import logging
from typing import Optional, Tuple

import httpx
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from pipeline.models import FetchConfig
from utils import validate_url, random_user_agent

logger = logging.getLogger(__name__)


def fetch_html(url: str, fetch: Optional[FetchConfig] = None) -> Tuple[str, Optional[str]]:
    """
    Fetch HTML for a URL.

    Returns: (html, error)
    """
    cfg = fetch or FetchConfig()
    ua = cfg.user_agent or random_user_agent()

    if not url:
        return "", "missing-url"

    try:
        validate_url(url)
    except ValueError as e:
        return "", f"ssrf-blocked: {e}"

    if cfg.render_js:
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    user_agent=ua,
                    viewport={"width": 1920, "height": 1080},
                    ignore_https_errors=False,
                )
                page = context.new_page()
                try:
                    page.goto(url, wait_until=cfg.wait_until, timeout=cfg.timeout_ms)
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
