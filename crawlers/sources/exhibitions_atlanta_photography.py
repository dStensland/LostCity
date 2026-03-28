"""
Atlanta Center for Photography exhibition crawler.

NOTE: As of 2026-03-25, the domain www.atlantaphotography.org is parked for
sale on GoDaddy. The organization may have dissolved or moved. This crawler
returns empty and logs a warning so the source can be deactivated when
confirmed defunct.
"""
from __future__ import annotations

import logging
import time

import requests

from sources._exhibitions_base import GenericExhibitionCrawler

logger = logging.getLogger(__name__)


class _Crawler(GenericExhibitionCrawler):
    PLACE_DATA = {
        "name": "Atlanta Center for Photography",
        "slug": "atlanta-center-for-photography",
        "address": "1244 Menlo Ave SW",
        "neighborhood": "Westview",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30310",
        "lat": 33.7257,
        "lng": -84.4302,
        "place_type": "gallery",
        "website": "https://www.atlantaphotography.org",
    }

    EXHIBITIONS_URL = "https://www.atlantaphotography.org"

    def get_exhibitions(
        self, session: requests.Session, source: dict
    ) -> list[dict]:
        try:
            resp = session.get(self.EXHIBITIONS_URL, timeout=15)
        except requests.RequestException as exc:
            logger.warning("ACP: connection failed — %s", exc)
            return []

        # GoDaddy parked page returns 403 with an access-denied page
        if resp.status_code != 200 or "godaddy" in resp.url.lower() or "forsale" in resp.url.lower():
            logger.warning(
                "ACP: domain appears parked or unreachable (status=%s, final_url=%s). "
                "Deactivate this source until the organization's new site is identified.",
                resp.status_code,
                resp.url,
            )
            return []

        # Site responds but we don't know the new structure — return empty
        logger.info("ACP: site responded but exhibition parsing not implemented for new structure")
        return []


def crawl(source: dict) -> tuple[int, int, int]:
    return _Crawler().crawl(source)
