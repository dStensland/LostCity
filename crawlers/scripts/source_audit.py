#!/usr/bin/env python3
"""
Audit a source URL and recommend an integration method based on the priority order.

Usage:
  python scripts/source_audit.py --url https://example.org/events
  python scripts/source_audit.py --url https://example.org/events --json
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from extractors.structured import extract_jsonld_event_fields


AGGREGATOR_DOMAINS = ("ticketmaster.com", "eventbrite.com")
API_HINTS = ("/api/", "graphql", "graph-ql")


@dataclass
class AuditResult:
    url: str
    final_url: str
    status_code: int
    content_type: Optional[str]
    signals: Dict[str, Any]
    recommendation: Dict[str, Any]


def _fetch(url: str, timeout_ms: int, user_agent: Optional[str]) -> Tuple[str, httpx.Response]:
    headers = {"User-Agent": user_agent} if user_agent else None
    with httpx.Client(timeout=timeout_ms / 1000.0, follow_redirects=True, headers=headers) as client:
        resp = client.get(url)
        return resp.text, resp


def _detect_feed(content: str, url: str) -> Tuple[bool, Optional[str]]:
    if not content:
        return False, None
    stripped = content.lstrip()
    if stripped.startswith("BEGIN:VCALENDAR"):
        return True, "ics"
    if re.search(r"<rss\\b", stripped, re.IGNORECASE):
        return True, "rss"
    if re.search(r"<feed\\b", stripped, re.IGNORECASE):
        return True, "atom"
    if url.lower().endswith(".ics"):
        return True, "ics"
    return False, None


def _find_feed_links(soup: BeautifulSoup, base_url: str) -> List[str]:
    links: List[str] = []
    for link in soup.find_all("link", rel=lambda v: v and "alternate" in v):
        link_type = (link.get("type") or "").lower()
        href = link.get("href")
        if not href:
            continue
        if any(t in link_type for t in ("rss", "atom", "calendar", "ical", "ics")):
            links.append(urljoin(base_url, href))
    for a in soup.find_all("a", href=True):
        href = a.get("href") or ""
        if href.lower().endswith(".ics"):
            links.append(urljoin(base_url, href))
    return list(dict.fromkeys(links))


def _detect_jsonld_event(html: str) -> Tuple[bool, Dict[str, Any]]:
    data = extract_jsonld_event_fields(html)
    if not data:
        return False, {}

    fields = {
        "title": bool(data.get("title")),
        "start_date": bool(data.get("start_date")),
        "ticket_url": bool(data.get("ticket_url")),
        "image_url": bool(data.get("image_url")),
        "description": bool(data.get("description")),
    }
    return True, {"fields": fields, "data": data}


def _looks_js_app(html: str) -> bool:
    if not html:
        return False
    text_len = len(BeautifulSoup(html, "lxml").get_text(" ", strip=True))
    html_len = len(html)
    if html_len == 0:
        return False
    ratio = text_len / html_len
    if ratio < 0.02 and ("__NEXT_DATA__" in html or "data-reactroot" in html or "id=\"root\"" in html):
        return True
    if ratio < 0.01 and ("webpack" in html or "bundle.js" in html):
        return True
    return False


def _detect_api_candidate(url: str, content_type: Optional[str], html: str) -> bool:
    if content_type and "application/json" in content_type.lower():
        return True
    lower = url.lower()
    if any(hint in lower for hint in API_HINTS):
        return True
    if html and html.lstrip().startswith("{") and "\"events\"" in html[:5000]:
        return True
    return False


def _detect_aggregator(url: str, html: str) -> bool:
    parsed = urlparse(url)
    if any(dom in parsed.netloc for dom in AGGREGATOR_DOMAINS):
        return True
    if any(dom in html for dom in AGGREGATOR_DOMAINS):
        return True
    return False


def _recommend(signals: Dict[str, Any]) -> Dict[str, Any]:
    notes: List[str] = []
    method = "unknown"

    if signals.get("api_candidate"):
        method = "api"
        notes.append("URL looks like JSON/API; verify if first-party API is available.")
        return {"method": method, "notes": notes}

    if signals.get("aggregator_candidate"):
        method = "aggregator"
        notes.append("Aggregator domain detected (Ticketmaster/Eventbrite).")
        return {"method": method, "notes": notes}

    if signals.get("feed_confirmed"):
        method = "feed"
        notes.append("Structured feed detected and parsable.")
        return {"method": method, "notes": notes}

    if signals.get("has_jsonld_event"):
        fields = signals.get("jsonld_fields", {})
        required = [fields.get("title"), fields.get("start_date")]
        rich = [fields.get("ticket_url"), fields.get("image_url"), fields.get("description")]
        if all(required) and sum(1 for v in rich if v) >= 2:
            method = "jsonld_only"
            notes.append("JSON-LD Event appears complete enough to ingest without HTML selectors.")
        else:
            method = "html"
            notes.append("JSON-LD Event present but incomplete; use HTML selectors with JSON-LD precedence.")
        return {"method": method, "notes": notes}

    if signals.get("looks_js_app"):
        method = "playwright"
        notes.append("Page looks JS-rendered; likely needs browser automation.")
        return {"method": method, "notes": notes}

    if signals.get("text_len", 0) > 200:
        method = "html"
        notes.append("Static HTML with enough text to parse deterministically.")
        return {"method": method, "notes": notes}

    method = "llm_crawler"
    notes.append("No strong structured signals; LLM-powered discovery likely required.")
    return {"method": method, "notes": notes}


def audit(url: str, timeout_ms: int, user_agent: Optional[str]) -> AuditResult:
    html, resp = _fetch(url, timeout_ms, user_agent)
    final_url = str(resp.url)
    content_type = resp.headers.get("content-type")

    feed_confirmed, feed_format = _detect_feed(html, final_url)

    signals: Dict[str, Any] = {
        "feed_confirmed": feed_confirmed,
        "feed_format": feed_format,
        "feed_links": [],
        "has_jsonld_event": False,
        "jsonld_fields": {},
        "looks_js_app": False,
        "text_len": 0,
        "api_candidate": False,
        "aggregator_candidate": False,
    }

    if feed_confirmed:
        signals["feed_links"] = [final_url]
    else:
        soup = BeautifulSoup(html, "lxml")
        feed_links = _find_feed_links(soup, final_url)
        signals["feed_links"] = feed_links

        # Try to confirm the first feed link if present.
        if feed_links:
            try:
                feed_html, _ = _fetch(feed_links[0], timeout_ms, user_agent)
                feed_confirmed, feed_format = _detect_feed(feed_html, feed_links[0])
                if feed_confirmed:
                    signals["feed_confirmed"] = True
                    signals["feed_format"] = feed_format
            except Exception:
                pass

        jsonld_present, jsonld_info = _detect_jsonld_event(html)
        signals["has_jsonld_event"] = jsonld_present
        if jsonld_present:
            signals["jsonld_fields"] = jsonld_info.get("fields", {})

        text_len = len(soup.get_text(" ", strip=True))
        signals["text_len"] = text_len
        signals["looks_js_app"] = _looks_js_app(html)

    signals["api_candidate"] = _detect_api_candidate(final_url, content_type, html)
    signals["aggregator_candidate"] = _detect_aggregator(final_url, html)

    recommendation = _recommend(signals)

    return AuditResult(
        url=url,
        final_url=final_url,
        status_code=resp.status_code,
        content_type=content_type,
        signals=signals,
        recommendation=recommendation,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit a source URL for integration method")
    parser.add_argument("--url", required=True, help="Source URL to audit")
    parser.add_argument("--timeout-ms", type=int, default=15000)
    parser.add_argument("--user-agent", default=None)
    parser.add_argument("--json", action="store_true", help="Output JSON")
    args = parser.parse_args()

    result = audit(args.url, args.timeout_ms, args.user_agent)

    payload = {
        "url": result.url,
        "final_url": result.final_url,
        "status_code": result.status_code,
        "content_type": result.content_type,
        "signals": result.signals,
        "recommendation": result.recommendation,
    }

    if args.json:
        print(json.dumps(payload, indent=2))
        return

    print(f"URL: {payload['url']}")
    print(f"Final URL: {payload['final_url']}")
    print(f"Status: {payload['status_code']} ({payload['content_type']})")
    print("Signals:")
    for key, value in payload["signals"].items():
        print(f"  - {key}: {value}")
    print("Recommendation:")
    print(f"  method: {payload['recommendation']['method']}")
    for note in payload["recommendation"].get("notes", []):
        print(f"  note: {note}")


if __name__ == "__main__":
    main()
