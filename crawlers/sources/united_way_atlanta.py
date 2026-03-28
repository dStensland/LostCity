"""
Crawl dated volunteer opportunities from United Way of Greater Atlanta.

United Way's public /calendar view is mostly a shell. The real public inventory
is the /need/ opportunity board. We only ingest opportunities that expose a
single concrete "Happens On ..." date. Ongoing or "Until ..." opportunities
belong in HelpATL's structured commitment layer, not the dated event feed.
"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime
from typing import Optional
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
    upsert_volunteer_opportunity,
    deactivate_stale_volunteer_opportunities,
)
from dedupe import generate_content_hash
from db.client import get_client, writes_enabled
from entity_lanes import SourceEntityCapabilities
from utils import slugify

logger = logging.getLogger(__name__)

BASE_URL = "https://volunteer.unitedwayatlanta.org"
OPPORTUNITIES_URL = f"{BASE_URL}/need/"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
TIME_RE = re.compile(r"\b(\d{1,2})(?::(\d{2}))?\s*([ap]m)\b", re.IGNORECASE)
HAPPENS_ON_RE = re.compile(r"\bHappens On\s+([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})\b")
UNTIL_RE = re.compile(r"\bUntil\s+([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})\b")
ONGOING_RE = re.compile(r"\bongoing\b", re.IGNORECASE)
AGE_RE = re.compile(r"\b(\d{1,2})\s+and older\b", re.IGNORECASE)
LOCALITY_RE = re.compile(
    r"\b(atlanta|metro atlanta|fulton|dekalb|cobb|gwinnett|clayton|brookhaven|chamblee|sandy springs|buckhead|georgia|ga\b)\b",
    re.IGNORECASE,
)
ORG_SUFFIX_RE = re.compile(
    r"\b(incorporated|inc|llc|ltd|corp|corporation|company|co|foundation)\b\.?,?",
    re.IGNORECASE,
)

UNITED_WAY_ATLANTA = {
    "name": "United Way of Greater Atlanta",
    "slug": "united-way-atlanta",
    "address": "100 Edgewood Ave NE",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "place_type": "nonprofit",
    "website": "https://www.unitedwayatlanta.org",
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    volunteer_opportunities=True,
)


def determine_category(title: str, description: str = "") -> str:
    text = f"{title} {description}".lower()
    if any(word in text for word in ["training", "workshop", "orientation", "fafsa"]):
        return "education"
    return "community"


def extract_tags(title: str, description: str = "", partner_agency: Optional[str] = None) -> list[str]:
    text = " ".join(part for part in [title, description, partner_agency or ""] if part).lower()
    tags = {"volunteer", "volunteer-opportunity", "charity", "nonprofit", "united-way-atlanta"}

    if any(word in text for word in ["food", "meal", "pantry", "hunger"]):
        tags.add("food-security")
    if any(word in text for word in ["student", "school", "fafsa", "college", "reading", "mentor", "tutor"]):
        tags.add("education")
    if any(word in text for word in ["family", "kids", "children", "youth"]):
        tags.add("family-friendly")
    if any(word in text for word in ["outdoor", "park", "cleanup", "garden"]):
        tags.add("environmental")
    if any(word in text for word in ["housing", "shelter", "homeless"]):
        tags.add("housing")
    if any(word in text for word in ["virtual", "remote"]):
        tags.add("virtual")
    if any(word in text for word in ["advocacy", "civic", "community engagement"]):
        tags.add("community")

    return sorted(tags)


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _parse_time(text: str) -> Optional[str]:
    match = TIME_RE.search(text)
    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2) or 0)
    period = match.group(3).lower()
    if period == "pm" and hour != 12:
        hour += 12
    elif period == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def _extract_detail_label_text(soup: BeautifulSoup, label: str) -> Optional[str]:
    label_node = soup.find(string=re.compile(rf"^{re.escape(label)}$", re.IGNORECASE))
    if not label_node:
        return None

    parent = label_node.parent
    if parent is None:
        return None

    text = _normalize_whitespace(parent.get_text(" ", strip=True))
    if text.lower().startswith(label.lower()):
        text = _normalize_whitespace(text[len(label) :])
    text = _normalize_whitespace(re.split(r"posted by", text, flags=re.IGNORECASE)[0])
    if text:
        return text

    sibling = parent.find_next_sibling()
    while sibling is not None:
        sibling_text = _normalize_whitespace(sibling.get_text(" ", strip=True))
        if sibling_text:
            if re.fullmatch(r"posted by", sibling_text, flags=re.IGNORECASE):
                return None
            sibling_text = _normalize_whitespace(
                re.split(r"posted by", sibling_text, flags=re.IGNORECASE)[0]
            )
            return sibling_text
        sibling = sibling.find_next_sibling()
    return None


def _extract_description(soup: BeautifulSoup) -> Optional[str]:
    desc_label = soup.find(string=re.compile(r"^Description$", re.IGNORECASE))
    if not desc_label or not getattr(desc_label, "parent", None):
        return None

    desc_parent = desc_label.parent
    chunks: list[str] = []
    for sib in desc_parent.find_next_siblings():
        sib_text = _normalize_whitespace(sib.get_text(" ", strip=True))
        if not sib_text:
            continue
        if sib_text in {"Details", "Location", "Partner Agency", "POSTED BY"}:
            break
        chunks.append(sib_text)
    if not chunks:
        return None
    return "\n\n".join(chunks)[:2000]


def _extract_opportunity_core(
    html: str,
    detail_url: str,
    reference_dt: Optional[datetime] = None,
) -> Optional[dict]:
    reference_dt = reference_dt or datetime.now()
    soup = BeautifulSoup(html, "html.parser")
    body_text = _normalize_whitespace(soup.get_text(" ", strip=True))

    title_node = soup.select_one("h1") or soup.select_one("title")
    title = _normalize_whitespace(title_node.get_text(" ", strip=True) if title_node else "")
    if title.lower().startswith("opportunities "):
        title = _normalize_whitespace(title[len("Opportunities ") :])
    if not title:
        return None

    happens_on_match = HAPPENS_ON_RE.search(body_text)
    until_match = UNTIL_RE.search(body_text)
    status_kind: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    start_time: Optional[str] = None

    if happens_on_match:
        start_dt = datetime.strptime(happens_on_match.group(1), "%b %d, %Y")
        if start_dt.date() < reference_dt.date():
            return None
        status_kind = "happens_on"
        start_date = start_dt.strftime("%Y-%m-%d")
        start_time = _parse_time(body_text[happens_on_match.end() : happens_on_match.end() + 80])
    elif until_match:
        end_dt = datetime.strptime(until_match.group(1), "%b %d, %Y")
        if end_dt.date() < reference_dt.date():
            return None
        status_kind = "until"
        end_date = end_dt.strftime("%Y-%m-%d")
        start_time = _parse_time(body_text[until_match.end() : until_match.end() + 80])
    elif ONGOING_RE.search(body_text):
        status_kind = "ongoing"
        start_time = _parse_time(body_text[:500])
    else:
        return None

    description = _extract_description(soup)
    partner_agency = _extract_detail_label_text(soup, "Partner Agency")
    location_text = _extract_detail_label_text(soup, "Location")
    age_match = AGE_RE.search(body_text)

    return {
        "title": title[:200],
        "description": description,
        "partner_agency": partner_agency,
        "location_text": location_text,
        "status_kind": status_kind,
        "start_date": start_date,
        "end_date": end_date,
        "start_time": start_time,
        "remote_allowed": "virtual opportunity" in body_text.lower() or "virtual volunteer" in body_text.lower(),
        "family_friendly": "is family friendly" in body_text.lower(),
        "group_friendly": "group" in body_text.lower() or "parents looking for a volunteer activity" in body_text.lower(),
        "min_age": int(age_match.group(1)) if age_match else None,
        "body_text": body_text,
        "source_url": detail_url,
        "ticket_url": detail_url,
    }


def _parse_opportunity_detail(
    html: str,
    detail_url: str,
    reference_dt: Optional[datetime] = None,
) -> Optional[dict]:
    parsed = _extract_opportunity_core(html, detail_url, reference_dt)
    if not parsed or parsed["status_kind"] != "happens_on":
        return None
    return {
        "title": parsed["title"],
        "description": parsed["description"],
        "start_date": parsed["start_date"],
        "start_time": parsed["start_time"],
        "partner_agency": parsed["partner_agency"],
        "location_text": parsed["location_text"],
        "source_url": parsed["source_url"],
        "ticket_url": parsed["ticket_url"],
    }


def _parse_structured_opportunity_detail(
    html: str,
    detail_url: str,
    reference_dt: Optional[datetime] = None,
) -> Optional[dict]:
    parsed = _extract_opportunity_core(html, detail_url, reference_dt)
    if not parsed or parsed["status_kind"] == "happens_on":
        return None
    return parsed


def _collect_detail_urls(index_html: str) -> list[str]:
    soup = BeautifulSoup(index_html, "html.parser")
    urls: list[str] = []
    seen: set[str] = set()
    for anchor in soup.select('a[href*="/need/detail/"]'):
        href = anchor.get("href")
        if not href:
            continue
        detail_url = urljoin(OPPORTUNITIES_URL, href)
        if detail_url in seen:
            continue
        seen.add(detail_url)
        urls.append(detail_url)
    return urls


def _extract_need_id(detail_url: str) -> Optional[str]:
    query = parse_qs(urlparse(detail_url).query)
    need_ids = query.get("need_id")
    if not need_ids:
        return None
    return need_ids[0]


def _infer_cause(text: str) -> str:
    lowered = text.lower()
    if any(word in lowered for word in ["refugee", "immigrant", "new american"]):
        return "immigrant_refugee"
    if any(word in lowered for word in ["reading", "school", "student", "tutor", "mentor", "college", "fafsa"]):
        return "education"
    if any(word in lowered for word in ["book", "library", "literacy"]):
        return "education"
    if any(word in lowered for word in ["advocacy", "community engagement", "volunteer engagement"]):
        return "civic_engagement"
    if any(word in lowered for word in ["family", "children", "youth"]):
        return "family_support"
    return "community"


def _infer_onboarding_level(text: str) -> str:
    lowered = text.lower()
    if any(word in lowered for word in ["background check", "fingerprint", "screening"]):
        return "screening_required"
    if any(word in lowered for word in ["training", "orientation", "review independently online"]):
        return "training_required"
    if any(word in lowered for word in ["register", "sign up", "tips & resources"]):
        return "light"
    return "none"


def _infer_time_horizon(status_kind: str, end_date: Optional[str]) -> str:
    if status_kind == "ongoing":
        return "ongoing"
    if status_kind == "until" and end_date:
        return "multi_week"
    return "multi_month"


def _infer_physical_demand(text: str) -> str:
    lowered = text.lower()
    if any(word in lowered for word in ["lift", "stock", "transportation", "outdoors"]):
        return "medium"
    return "low"


def _schedule_summary(parsed: dict) -> str:
    pieces: list[str] = []
    if parsed.get("status_kind") == "ongoing":
        pieces.append("Ongoing volunteer role")
    elif parsed.get("status_kind") == "until" and parsed.get("end_date"):
        pieces.append(
            f"Open volunteer role through {datetime.strptime(parsed['end_date'], '%Y-%m-%d').strftime('%b %d, %Y')}"
        )
    if parsed.get("start_time"):
        display = datetime.strptime(parsed["start_time"], "%H:%M").strftime("%-I:%M %p")
        pieces.append(f"Typical shift time around {display}")
    partner_agency = parsed.get("partner_agency")
    if partner_agency:
        pieces.append(f"Managed through {partner_agency}")
    return ". ".join(pieces) + "."


def _organization_description(partner_agency: str) -> str:
    return (
        f"{partner_agency} volunteer opportunities discovered through United Way of Greater Atlanta's "
        "public volunteer board."
    )


def _normalized_partner_slug(partner_agency: str) -> str:
    cleaned = partner_agency.replace(":", " ").replace("&", " and ")
    cleaned = ORG_SUFFIX_RE.sub("", cleaned)
    cleaned = _normalize_whitespace(cleaned)
    return slugify(cleaned)[:63]


def _upsert_organization(
    partner_agency: str,
    portal_id: str,
    organization_cache: Optional[dict[str, tuple[str, str]]] = None,
) -> tuple[str, str]:
    client = get_client()
    org_slug = _normalized_partner_slug(partner_agency)
    if organization_cache and org_slug in organization_cache:
        return organization_cache[org_slug]

    existing_rows = (
        client.table("organizations")
        .select("id,slug,portal_id,hidden")
        .eq("slug", org_slug)
        .limit(1)
        .execute()
        .data
        or []
    )
    existing = existing_rows[0] if existing_rows else None
    if existing:
        updates = {}
        if existing.get("portal_id") is None:
            updates["portal_id"] = portal_id
        if existing.get("hidden"):
            updates["hidden"] = False
        if writes_enabled():
            if updates:
                client.table("organizations").update(updates).eq("id", existing["id"]).execute()
        result = (existing["id"], existing["slug"])
        if organization_cache is not None:
            organization_cache[org_slug] = result
        return result

    payload = {
        "id": str(uuid.uuid4()),
        "name": partner_agency,
        "slug": org_slug,
        "org_type": "community_group",
        "description": _organization_description(partner_agency),
        "categories": ["community"],
        "city": "Atlanta",
        "portal_id": portal_id,
        "hidden": False,
        "featured": False,
    }
    if not writes_enabled():
        result = (f"dry-run-{org_slug}", org_slug)
        if organization_cache is not None:
            organization_cache[org_slug] = result
        return result

    created = client.table("organizations").insert(payload).execute().data[0]
    result = (created["id"], created["slug"])
    if organization_cache is not None:
        organization_cache[org_slug] = result
    return result


def _has_direct_structured_coverage(
    organization_id: str,
    source_id: int,
    direct_coverage_cache: Optional[dict[tuple[str, int], bool]] = None,
) -> bool:
    cache_key = (organization_id, source_id)
    if direct_coverage_cache is not None and cache_key in direct_coverage_cache:
        return direct_coverage_cache[cache_key]

    client = get_client()
    rows = (
        client.table("volunteer_opportunities")
        .select("id", count="exact")
        .eq("organization_id", organization_id)
        .eq("is_active", True)
        .neq("source_id", source_id)
        .limit(1)
        .execute()
    )
    has_direct = bool(rows.count)
    if direct_coverage_cache is not None:
        direct_coverage_cache[cache_key] = has_direct
    return has_direct


def _upsert_structured_opportunity(
    source_id: int,
    portal_id: str,
    parsed: dict,
    organization_cache: Optional[dict[str, tuple[str, str]]] = None,
    direct_coverage_cache: Optional[dict[tuple[str, int], bool]] = None,
) -> bool:
    partner_agency = parsed.get("partner_agency")
    need_id = _extract_need_id(parsed["source_url"])
    if not partner_agency or not need_id:
        return False

    locality_text = " ".join(
        part for part in [partner_agency, parsed.get("location_text") or "", parsed.get("body_text") or ""] if part
    )
    if not LOCALITY_RE.search(locality_text):
        return False

    organization_id, organization_slug = _upsert_organization(
        partner_agency,
        portal_id,
        organization_cache=organization_cache,
    )
    if _has_direct_structured_coverage(
        organization_id,
        source_id,
        direct_coverage_cache=direct_coverage_cache,
    ):
        logger.info(
            "Skipping United Way structured opportunity for %s because direct structured coverage already exists",
            partner_agency,
        )
        return False

    opportunity_slug = f"uwga-{need_id}-{slugify(parsed['title'])}"[:120]
    cause = _infer_cause(" ".join(filter(None, [parsed["title"], parsed.get("description"), partner_agency])))
    onboarding_level = _infer_onboarding_level(" ".join(filter(None, [parsed.get("description"), parsed.get("body_text")])))
    training_required = onboarding_level == "training_required"
    background_check_required = onboarding_level == "screening_required"
    location_summary = parsed.get("location_text") or ("Virtual opportunity" if parsed.get("remote_allowed") else "Metro Atlanta")
    summary = (parsed.get("description") or parsed["title"])[:240]
    payload = {
        "slug": opportunity_slug,
        "organization_id": organization_id,
        "source_id": source_id,
        "portal_id": portal_id,
        "title": parsed["title"],
        "summary": summary,
        "description": parsed.get("description"),
        "commitment_level": "ongoing",
        "time_horizon": _infer_time_horizon(parsed["status_kind"], parsed.get("end_date")),
        "onboarding_level": onboarding_level,
        "schedule_summary": _schedule_summary(parsed),
        "location_summary": location_summary,
        "skills_required": [],
        "language_support": [],
        "physical_demand": _infer_physical_demand(parsed.get("body_text") or ""),
        "min_age": parsed.get("min_age"),
        "family_friendly": bool(parsed.get("family_friendly")),
        "group_friendly": bool(parsed.get("group_friendly")),
        "remote_allowed": bool(parsed.get("remote_allowed")),
        "accessibility_notes": None,
        "background_check_required": background_check_required,
        "training_required": training_required,
        "capacity_total": None,
        "capacity_remaining": None,
        "urgency_level": "normal",
        "starts_on": None,
        "ends_on": parsed.get("end_date"),
        "application_url": parsed["ticket_url"],
        "source_url": parsed["source_url"],
        "metadata": {
            "cause": cause,
            "aggregator": "united_way_atlanta",
            "partner_agency": partner_agency,
            "partner_org_slug": organization_slug,
            "status_kind": parsed["status_kind"],
        },
        "is_active": True,
    }

    return bool(upsert_volunteer_opportunity(payload))


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()
    structured_active_slugs: set[str] = set()
    structured_upserts = 0
    organization_cache: dict[str, tuple[str, str]] = {}
    direct_coverage_cache: dict[tuple[str, int], bool] = {}

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    venue_id = get_or_create_place(UNITED_WAY_ATLANTA)
    portal_row = get_client().table("portals").select("id").eq("slug", "helpatl").maybe_single().execute().data
    portal_id = portal_row["id"] if portal_row else None

    logger.info("Fetching United Way Atlanta opportunities: %s", OPPORTUNITIES_URL)
    index_response = session.get(OPPORTUNITIES_URL, timeout=30)
    index_response.raise_for_status()
    detail_urls = _collect_detail_urls(index_response.text)
    logger.info("Found %s United Way opportunity detail pages", len(detail_urls))

    for detail_url in detail_urls:
        try:
            detail_response = session.get(detail_url, timeout=30)
            detail_response.raise_for_status()
            parsed = _parse_opportunity_detail(detail_response.text, detail_url)
            structured = None
            if not parsed and portal_id:
                structured = _parse_structured_opportunity_detail(detail_response.text, detail_url)
        except Exception as exc:
            logger.warning("Skipping United Way detail page %s: %s", detail_url, exc)
            continue

        if parsed:
            events_found += 1
            content_hash = generate_content_hash(
                parsed["title"],
                UNITED_WAY_ATLANTA["name"],
                f"{parsed['start_date']}|{parsed['start_time'] or ''}",
            )
            current_hashes.add(content_hash)

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": parsed["title"],
                "description": parsed["description"],
                "start_date": parsed["start_date"],
                "start_time": parsed["start_time"],
                "end_date": None,
                "end_time": None,
                "is_all_day": parsed["start_time"] is None,
                "category": determine_category(parsed["title"], parsed["description"] or ""),
                "subcategory": None,
                "tags": extract_tags(
                    parsed["title"],
                    parsed["description"] or "",
                    parsed["partner_agency"],
                ),
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": True,
                "source_url": parsed["source_url"],
                "ticket_url": parsed["ticket_url"],
                "image_url": None,
                "raw_text": _normalize_whitespace(
                    " | ".join(
                        part
                        for part in [
                            parsed["title"],
                            parsed["start_date"],
                            parsed["start_time"] or "",
                            parsed["partner_agency"] or "",
                            parsed["location_text"] or "",
                        ]
                        if part
                    )
                )[:500],
                "extraction_confidence": 0.9,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_existing_event_for_insert(event_record)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
            else:
                insert_event(event_record)
                events_new += 1
                logger.info("Added United Way event: %s on %s", parsed["title"], parsed["start_date"])
            continue

        if structured and portal_id:
            if _upsert_structured_opportunity(
                source_id,
                portal_id,
                structured,
                organization_cache=organization_cache,
                direct_coverage_cache=direct_coverage_cache,
            ):
                need_id = _extract_need_id(structured["source_url"])
                if need_id:
                    structured_active_slugs.add(
                        f"uwga-{need_id}-{slugify(structured['title'])}"[:120]
                    )
                structured_upserts += 1

    stale_deleted = remove_stale_source_events(source_id, current_hashes)
    if stale_deleted:
        logger.info("Removed %s stale United Way events after refresh", stale_deleted)
    stale_structured = deactivate_stale_volunteer_opportunities(source_id, structured_active_slugs)
    if stale_structured:
        logger.info("Deactivated %s stale United Way structured opportunities after refresh", stale_structured)

    logger.info(
        "United Way Atlanta crawl complete: %s found, %s new, %s updated, %s structured upserts",
        events_found,
        events_new,
        events_updated,
        structured_upserts,
    )
    return events_found, events_new, events_updated
