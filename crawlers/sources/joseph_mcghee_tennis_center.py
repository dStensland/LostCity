"""Crawler for public event tables at Joseph McGhee Tennis Center."""

from sources.agape_city_racquet_common import AGAPE_CENTER_CONFIGS, crawl_agape_center


def crawl(source: dict) -> tuple[int, int, int]:
    return crawl_agape_center(source, AGAPE_CENTER_CONFIGS["joseph-mcghee-tennis-center"])
