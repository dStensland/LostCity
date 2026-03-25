"""
Poem88 Gallery exhibition crawler.

NOTE: As of 2026-03-25, the domain www.poem88.com has an SSL error (TLS
handshake failure) and the HTTP version resolves to a Chinese-language
website unrelated to the Atlanta gallery. The domain appears to have been
sold or abandoned. This crawler returns empty and logs a warning.
"""
from __future__ import annotations

import logging

import requests

from sources._exhibitions_base import GenericExhibitionCrawler

logger = logging.getLogger(__name__)

_GALLERY_URL = "http://www.poem88.com"


class _Crawler(GenericExhibitionCrawler):
    VENUE_DATA = {
        "name": "Poem 88",
        "slug": "poem-88",
        "address": "351 Peachtree Hills Ave NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "lat": 33.8421,
        "lng": -84.3711,
        "venue_type": "gallery",
        "website": "http://www.poem88.com",
    }

    EXHIBITIONS_URL = _GALLERY_URL

    def get_exhibitions(
        self, session: requests.Session, source: dict
    ) -> list[dict]:
        try:
            resp = session.get(_GALLERY_URL, timeout=15, allow_redirects=True)
        except requests.exceptions.SSLError:
            logger.warning(
                "Poem88: SSL handshake error — domain may have changed ownership. "
                "Deactivate this source until the gallery's new web presence is identified."
            )
            return []
        except requests.RequestException as exc:
            logger.warning("Poem88: connection failed — %s", exc)
            return []

        # Check if the response looks like the Atlanta art gallery
        body_lower = resp.text.lower()
        if "poem 88" not in body_lower and "poem88" not in body_lower and "atlanta" not in body_lower:
            logger.warning(
                "Poem88: page content does not match expected gallery "
                "(url=%s). Domain may be parked or sold. Deactivate this source.",
                resp.url,
            )
            return []

        logger.info("Poem88: site is accessible — update get_exhibitions() with parsing logic")
        return []


def crawl(source: dict) -> tuple[int, int, int]:
    return _Crawler().crawl(source)
