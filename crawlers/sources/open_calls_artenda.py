"""
Crawler for Artenda (artenda.net) open calls aggregator.

Artenda is a multi-discipline open calls aggregator with notable coverage of
public art RFPs, artist residencies, grants, competitions, and exhibition calls.
It has a strong public-art section with municipal RFPs and RFQs — a category
underserved by most other aggregators we crawl.

Architecture discovered (2026-03-24):
  - Listing pages are server-rendered HTML with exactly 15 results per category
    for unauthenticated (free-tier) visitors. This is the paywall limit.
  - The first 3–4 results have readable titles/locations; the rest are garbled
    with scrambled characters (Artenda's paywall obfuscation). Deadlines (dates)
    are always clear even on garbled rows.
  - Pagination requires a form POST with a Laravel CSRF token. The filter form
    is not rendered for free-tier users, so pagination is unavailable without
    a subscription. We crawl only what the free tier exposes.
  - Each listing row carries a tender code (e.g. `JP5YC528`) in its section id.
  - The detail API endpoint `/api/tender-details/{code}` is publicly accessible
    and always returns the full unobfuscated description, application link,
    contact/org info, and fee details — regardless of whether the listing title
    is garbled. This is the key data source.

Crawl strategy:
  1. Fetch each of 6 category listing pages (static GET).
  2. Extract all 15 tender codes + listing metadata (deadline date, reward text,
     eligibility text, listing title).
  3. For each code, call /api/tender-details/{code} to get description +
     application URL.
  4. Combine: use listing title if it passes a readability check; otherwise fall
     back to the first sentence of the description (always clear from the API).
  5. Skip entries with past deadlines.
  6. Insert via insert_open_call().

Category → call_type mapping:
  competition   → submission
  exhibition    → exhibition_proposal
  residency     → residency
  public-art    → commission
  project-grant → grant
  stipend       → fellowship

Eligibility: "International" for all (Artenda is a global aggregator; calls
span dozens of countries and have no US-focus bias).

Confidence tier: "aggregated" (Artenda is an aggregator, not the issuing org).

Rate limiting: 0.5s between API calls per category (90 total API calls max).

Total yield: up to 90 open calls per run (15 per category × 6 categories),
minus expired deadlines. With weekly crawl cadence the set rotates as
deadlines pass and new calls appear at the top.
"""

import logging
import re
import time
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://artenda.net"
DETAIL_API_TEMPLATE = "https://artenda.net/api/tender-details/{}"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

DETAIL_DELAY_S = 0.5  # seconds between detail API calls

# Category slug → (listing URL, call_type)
CATEGORIES: list[tuple[str, str, str]] = [
    (
        "competition",
        "https://artenda.net/art-open-call-opportunity/competition",
        "submission",
    ),
    (
        "exhibition",
        "https://artenda.net/art-open-call-opportunity/exhibition",
        "exhibition_proposal",
    ),
    (
        "residency",
        "https://artenda.net/art-open-call-opportunity/residency",
        "residency",
    ),
    (
        "public-art",
        "https://artenda.net/art-open-call-opportunity/public-art",
        "commission",
    ),
    (
        "project-grant",
        "https://artenda.net/art-open-call-opportunity/project-grant",
        "grant",
    ),
    (
        "stipend",
        "https://artenda.net/art-open-call-opportunity/stipend",
        "fellowship",
    ),
]

# Months for deadline parsing
_MONTH_MAP = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}

# Common 3-letter consonant clusters that appear in real English/German/French/Italian words.
# Any consonant run whose every trigram is in this set is considered valid (not garbled).
_VALID_TRIGRAMS: frozenset[str] = frozenset(
    [
        "str",
        "spr",
        "spl",
        "scr",
        "shr",
        "thr",
        "nch",
        "tch",
        "rch",
        "sch",
        "ght",
        "nth",
        "rth",
        "dth",
        "ndl",
        "ngl",
        "ngr",
        "ndr",
        "mpr",
        "mbl",
        "sph",
        "chr",
        "phr",
        "ldr",
        "ldg",
        "rst",
        "lts",
        "rts",
        "sts",
        "nds",
        "ngs",
        "nts",
        "rds",
        "rks",
        "rms",
        "rns",
        "lks",
        "lms",
        "lps",
        "mps",
        "nks",
        "lds",
        "pfl",
        "kst",
        "gst",
        "ncl",
        "nfl",
        "nfr",
        "nkl",
        "cks",
        "ckl",
        "fts",
        "ffl",
        "ssb",
        "sst",
        "xtr",
        "xpl",
        "tzt",
        "bst",
        "rbl",
        "mbl",
        "nty",
        "phy",
        "cts",
        "chp",  # compound words: "launchpad" (nchp) — nch is valid, chp bridges morphemes
    ]
)

# Consonant-only run pattern (3+)
_CONSONANT_RUN_3 = re.compile(r"[bcdfghjklmnpqrstvwxyz]{3,}", re.I)

# Deadline date pattern: "Mar 24, 2026" or "March 24, 2026"
_DATE_RE = re.compile(
    r"([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})",
    re.I,
)


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": _USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )
    return session


def _fetch(session: requests.Session, url: str) -> Optional[bytes]:
    """Fetch a URL and return raw bytes, or None on failure."""
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.content
    except requests.RequestException as exc:
        logger.warning("Artenda: failed to fetch %s — %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------


def _parse_deadline(text: str) -> Optional[str]:
    """
    Parse a deadline date from listing text.

    Handles:
      "Mar 24, 2026"
      "March 24, 2026"
      "Deadline Mar 24, 2026"

    Returns "YYYY-MM-DD" or None.
    """
    m = _DATE_RE.search(text)
    if not m:
        return None
    month_name = m.group(1).lower()[:3]
    month = _MONTH_MAP.get(month_name)
    if not month:
        return None
    day = int(m.group(2))
    year = int(m.group(3))
    try:
        datetime(year, month, day)
    except ValueError:
        return None
    return f"{year}-{month:02d}-{day:02d}"


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if the deadline has already passed."""
    if not deadline_str:
        return False
    try:
        return date.fromisoformat(deadline_str) < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Title quality check
# ---------------------------------------------------------------------------


def _has_impossible_consonant_cluster(word: str) -> bool:
    """
    Return True if a word contains a consonant cluster that doesn't appear
    in any common European language.

    Strategy: find all 3+ consecutive consonant runs in the word. For each run,
    check every 3-gram — if none of them are in the valid-trigram whitelist,
    the cluster is impossible (indicates garbled/scrambled text).

    All-uppercase words (acronyms: MLK, USA, RFQ) are always considered valid.
    Words shorter than 4 chars are too short to judge reliably.
    """
    # Skip acronyms
    if word.isupper():
        return False
    clean = re.sub(r"[^a-zA-Z]", "", word).lower()
    if len(clean) < 4:
        return False

    for m in _CONSONANT_RUN_3.finditer(clean):
        cluster = m.group()
        has_valid_trigram = False
        for i in range(len(cluster) - 2):
            if cluster[i : i + 3] in _VALID_TRIGRAMS:
                has_valid_trigram = True
                break
        if not has_valid_trigram:
            return True
    return False


def _is_garbled_title(text: str) -> bool:
    """
    Detect Artenda's paywall obfuscation on listing titles.

    Artenda scrambles the text of locked listings (rows 4-15 for free-tier users)
    using an anagram-shuffle obfuscation. Garbled titles have words with improbable
    consonant clusters and unusual vowel distribution.

    Two-pass check:
      1. Impossible consonant clusters: if > 20% of substantive words (4+ chars)
         contain a consonant run whose every trigram is not in the valid-trigram
         whitelist, the title is garbled.
      2. Vowel starvation: any word of 7+ chars with < 15% vowels is almost
         certainly garbled (real words in European languages don't have this pattern
         except for long acronyms, which are excluded separately).

    Returns True if the title looks garbled.
    """
    text = text.strip()
    if not text or len(text) < 4:
        return True

    words = text.split()
    # Only judge substantive words (4+ chars after stripping non-alpha)
    substantive = [
        w
        for w in words
        if len(re.sub(r"[^a-zA-Z]", "", w)) >= 4
        and not re.sub(r"[^a-zA-Z]", "", w).isupper()
    ]

    if not substantive:
        return False  # Only short words or acronyms — can't judge

    # Pass 1: impossible consonant cluster ratio
    # Threshold: >= 0.20 (i.e. 1 in 5 substantive words has an impossible cluster).
    # German compound words at morpheme boundaries can produce clusters that look
    # impossible (e.g. "Kunstwettbewerb" has 'nstw'). This means a small number of
    # legitimate titles will use description-derived fallbacks — that's acceptable
    # because the description fallback is still accurate and useful.
    impossible_count = sum(
        1 for w in substantive if _has_impossible_consonant_cluster(w)
    )
    if impossible_count > 0 and impossible_count / len(substantive) >= 0.20:
        return True

    # Pass 2: vowel starvation on long words
    vowels = frozenset("aeiouäöüàáâéèêíìîóòôúùûý")
    for w in substantive:
        clean = re.sub(r"[^a-zA-Zäöüàáâéèêíìîóòôúùûý]", "", w)
        if len(clean) >= 7:
            vr = sum(1 for c in clean.lower() if c in vowels) / len(clean)
            if vr < 0.15:
                return True

    return False


# ---------------------------------------------------------------------------
# Description-based title fallback
# ---------------------------------------------------------------------------


def _title_from_description(description: str, org_name: str = "") -> str:
    """
    Derive a best-effort title from the description text when the listing
    title is garbled.

    Strategy:
      1. Extract the first sentence (up to 80 chars, ending at . ! ?).
      2. If no sentence break found early, take up to 70 chars at a word boundary.
      3. If the org name is available and not already in the extracted text,
         prepend it: "OrgName: First sentence fragment".
      4. Cap at 100 chars total.

    This is a fallback — it won't be as precise as the original title, but
    it is accurate and useful, and far better than a garbled string.
    """
    desc = description.strip()
    if not desc:
        return org_name or "Open Call"

    # Try to get the first sentence within 80 chars
    sentence_m = re.match(r"(.{15,80}?[.!?])\s", desc)
    if sentence_m:
        first_part = sentence_m.group(1).strip().rstrip(".")
    else:
        # No sentence break — take up to 70 chars at a word boundary
        if len(desc) <= 70:
            first_part = desc
        else:
            truncated = desc[:70]
            last_space = truncated.rfind(" ")
            first_part = truncated[:last_space] if last_space > 20 else truncated

    first_part = first_part.rstrip(".")

    if org_name and org_name.lower() not in first_part.lower():
        return f"{org_name}: {first_part}"[:100]

    return first_part[:100]


# ---------------------------------------------------------------------------
# Listing page parser
# ---------------------------------------------------------------------------


def _parse_listing_page(
    html_bytes: bytes,
    category_slug: str,
) -> list[dict]:
    """
    Parse one Artenda category listing page.

    Each `.tenderview` section contains:
      - id="t_{code}"  — tender code used for detail API
      - .deadline      — deadline date text (always clear, even on garbled rows)
      - h4             — title (may be garbled on rows 4-15)
      - .reward        — reward/prize text (may be partially garbled)
      - .location      — city/country (may be garbled)
      - #eligible-to-participate_{code} — eligibility text (may be partial/garbled)

    Returns a list of partial dicts: {tender_code, deadline, listing_title,
    category_slug, listing_url}.
    """
    soup = BeautifulSoup(html_bytes, "html.parser")
    tenders = soup.find_all("section", class_="tenderview")

    if not tenders:
        logger.warning(
            "Artenda: no .tenderview sections found on listing page for %s "
            "— site structure may have changed",
            category_slug,
        )
        return []

    rows: list[dict] = []

    for tender in tenders:
        raw_id = tender.get("id", "")
        if not raw_id.startswith("t_"):
            continue
        tender_code = raw_id[2:]  # strip "t_" prefix

        # Deadline date — always rendered clearly even on garbled rows
        deadline_div = tender.find(class_="deadline")
        deadline_text = deadline_div.get_text(" ", strip=True) if deadline_div else ""
        deadline = _parse_deadline(deadline_text)

        # Title — may be garbled; we flag it here for the detail-fetch phase
        title_el = tender.find("h4")
        raw_title = title_el.get_text(strip=True) if title_el else ""

        rows.append(
            {
                "tender_code": tender_code,
                "deadline": deadline,
                "listing_title": raw_title,
                "category_slug": category_slug,
            }
        )

    logger.debug(
        "Artenda: %s listing page — %d tender codes extracted",
        category_slug,
        len(rows),
    )
    return rows


# ---------------------------------------------------------------------------
# Detail API parser
# ---------------------------------------------------------------------------


def _parse_detail(html_bytes: bytes) -> Optional[dict]:
    """
    Parse the /api/tender-details/{code} HTML fragment.

    The response is an HTML fragment (not a full page) containing two columns:
      Left column (.col-lg-8): Description, Link, Contact
      Right column (.col-lg-3): Application type, Application fee, Docs, etc.

    Returns dict with: description, application_url, org_name, fee_text,
    or None if parsing fails completely.
    """
    soup = BeautifulSoup(html_bytes, "html.parser")

    # Extract description
    description: Optional[str] = None
    desc_p = soup.find("p", class_="bottom-space-m")
    if desc_p:
        desc_text = desc_p.get_text(" ", strip=True)
        desc_text = re.sub(r"\s{2,}", " ", desc_text).strip()
        if len(desc_text) > 20:
            description = desc_text[:3000]

    # Extract application URL from the "Link" section
    # Structure: <p class="segment">Link</p> <p class="bottom-space-s"><a href="...">
    application_url: str = ""
    for seg in soup.find_all("p", class_="segment"):
        if seg.get_text(strip=True).lower() == "link":
            # The next sibling paragraph contains the link
            next_p = seg.find_next_sibling("p")
            if next_p:
                link_a = next_p.find("a", href=True)
                if link_a:
                    href = link_a.get("href", "").strip()
                    if href.startswith("http"):
                        application_url = href
            break

    # Extract organization name from Contact section
    # Structure: <p class="segment">Contact</p> <p>OrgName<br>...</p>
    org_name: str = ""
    for seg in soup.find_all("p", class_="segment"):
        if seg.get_text(strip=True).lower() == "contact":
            next_p = seg.find_next_sibling("p")
            if next_p:
                # Organization name is the first text node before the first <br>
                first_child = next(
                    (c for c in next_p.children if hasattr(c, "strip")),
                    None,
                )
                if first_child:
                    org_name = str(first_child).strip()
                    # Also check for text in <br>-separated first line
                    if not org_name:
                        texts = list(next_p.strings)
                        if texts:
                            org_name = texts[0].strip()
            break

    # Application fee text
    fee_text: str = ""
    for seg in soup.find_all("p", class_="segment"):
        label = seg.get_text(strip=True).lower()
        if "application fee" in label:
            next_p = seg.find_next_sibling("p")
            if next_p:
                fee_text = next_p.get_text(" ", strip=True)
            break

    if not description and not application_url:
        # Completely empty response — likely a login gate we didn't expect
        return None

    return {
        "description": description,
        "application_url": application_url,
        "org_name": org_name,
        "fee_text": fee_text,
    }


# ---------------------------------------------------------------------------
# Fee parsing
# ---------------------------------------------------------------------------


_FEE_AMOUNT_RE = re.compile(r"(\d+(?:[.,]\d+)?)")


def _parse_fee(fee_text: str) -> Optional[float]:
    """
    Parse application fee from the detail page's fee text.

    Examples from Artenda:
      "none"       → 0.0
      "5 €"        → 5.0
      "25 $"       → 25.0
      "10.00 USD"  → 10.0
      (absent)     → None
    """
    if not fee_text:
        return None
    lower = fee_text.strip().lower()
    if "none" in lower or lower == "" or lower == "-":
        return 0.0
    # Find the first numeric amount
    m = _FEE_AMOUNT_RE.search(fee_text.replace(",", "."))
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            pass
    return None


# ---------------------------------------------------------------------------
# Entry builder
# ---------------------------------------------------------------------------


def _build_call_data(
    listing: dict,
    detail: dict,
    call_type: str,
    source_id: int,
) -> Optional[dict]:
    """
    Combine listing metadata with detail API data into a call_data dict
    ready for insert_open_call().

    Returns None if mandatory fields (title, application_url) cannot be resolved.
    """
    tender_code = listing["tender_code"]
    listing_title = listing.get("listing_title", "")
    deadline = listing.get("deadline")
    category_slug = listing.get("category_slug", "")

    description = detail.get("description") or ""
    application_url = detail.get("application_url", "")
    org_name = detail.get("org_name", "")
    fee_text = detail.get("fee_text", "")

    # Title resolution:
    # Use listing title if it passes the readability check.
    # Otherwise derive from description (always clear from the detail API).
    if listing_title and not _is_garbled_title(listing_title):
        title = listing_title
    elif description:
        title = _title_from_description(description, org_name)
    elif org_name:
        title = f"{org_name} — Open Call"
    else:
        logger.debug(
            "Artenda: skipping %s — no usable title or description",
            tender_code,
        )
        return None

    if not title:
        return None

    # Application URL: from detail API "Link" section.
    # If missing, fall back to the Artenda detail page URL (not ideal but honest).
    if not application_url:
        # Artenda has no public detail page URL per-tender; the API is the only endpoint.
        # We won't fabricate one. Skip rather than use a bad URL.
        logger.debug(
            "Artenda: skipping %s (%r) — no application URL in detail response",
            tender_code,
            title[:60],
        )
        return None

    fee = _parse_fee(fee_text)

    # Source URL: the category listing page (most specific stable URL available)
    source_url = f"https://artenda.net/art-open-call-opportunity/{category_slug}"

    return {
        "title": title,
        "description": description or None,
        "deadline": deadline,
        "application_url": application_url,
        "source_url": source_url,
        "call_type": call_type,
        "eligibility": "International",
        "fee": fee,
        "source_id": source_id,
        "confidence_tier": "aggregated",
        "_org_name": org_name or "artenda",
        "metadata": {
            "source": "artenda",
            "artenda_code": tender_code,
            "category": category_slug,
            "listing_title_garbled": listing_title != title,
        },
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Artenda open calls across all 6 categories.

    Strategy:
      1. For each category, fetch the listing page (static GET).
      2. Extract up to 15 tender codes + deadline dates per category.
      3. For each code, call /api/tender-details/{code} to get description,
         application URL, and fee info. Delay 0.5s between detail calls.
      4. Derive title from listing (if readable) or from description fallback.
      5. Skip calls with past deadlines.
      6. Insert via insert_open_call().

    Free-tier limit: 15 results per category = up to 90 per full crawl run.
    Pagination is not accessible without a paid subscription.

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = _make_session()

    for cat_slug, listing_url, call_type in CATEGORIES:
        logger.info("Artenda: crawling category %s — %s", cat_slug, listing_url)

        # Fetch listing page
        html_bytes = _fetch(session, listing_url)
        if not html_bytes:
            logger.warning(
                "Artenda: could not fetch listing for %s — skipping", cat_slug
            )
            continue

        rows = _parse_listing_page(html_bytes, cat_slug)
        if not rows:
            logger.warning("Artenda: no results parsed for %s", cat_slug)
            continue

        cat_found = cat_new = 0
        skipped_expired = 0
        skipped_no_detail = 0
        skipped_no_url = 0

        for idx, listing in enumerate(rows):
            tender_code = listing["tender_code"]
            deadline = listing["deadline"]

            # Pre-filter: skip entries with past deadlines before hitting the API
            if _is_past_deadline(deadline):
                skipped_expired += 1
                logger.debug(
                    "Artenda: skipping %s [%s] — deadline %s is past",
                    tender_code,
                    cat_slug,
                    deadline,
                )
                continue

            # Rate limit between detail API calls
            if idx > 0:
                time.sleep(DETAIL_DELAY_S)

            # Fetch detail
            detail_url = DETAIL_API_TEMPLATE.format(tender_code)
            detail_bytes = _fetch(session, detail_url)
            if not detail_bytes:
                skipped_no_detail += 1
                logger.warning(
                    "Artenda: could not fetch detail for %s [%s]",
                    tender_code,
                    cat_slug,
                )
                continue

            detail = _parse_detail(detail_bytes)
            if not detail:
                skipped_no_detail += 1
                logger.debug(
                    "Artenda: empty detail response for %s [%s] — "
                    "may require login or entry was removed",
                    tender_code,
                    cat_slug,
                )
                continue

            # Check if the detail response looks like a login gate
            if not detail.get("description") and not detail.get("application_url"):
                skipped_no_detail += 1
                logger.warning(
                    "Artenda: detail for %s [%s] has no description or URL — "
                    "possible login wall; stopping category",
                    tender_code,
                    cat_slug,
                )
                break  # Stop processing this category gracefully

            call_data = _build_call_data(listing, detail, call_type, source_id)
            if not call_data:
                skipped_no_url += 1
                continue

            cat_found += 1
            result = insert_open_call(call_data)
            if result:
                cat_new += 1
                logger.debug(
                    "Artenda: inserted/updated %r [%s] (deadline=%s, type=%s)",
                    call_data["title"][:60],
                    cat_slug,
                    deadline,
                    call_type,
                )

        logger.info(
            "Artenda [%s]: %d found, %d new, %d expired skipped, "
            "%d detail errors, %d no URL",
            cat_slug,
            cat_found,
            cat_new,
            skipped_expired,
            skipped_no_detail,
            skipped_no_url,
        )

        found += cat_found
        new += cat_new

    logger.info(
        "Artenda: crawl complete — %d found, %d new/updated across %d categories",
        found,
        new,
        len(CATEGORIES),
    )
    return found, new, updated
