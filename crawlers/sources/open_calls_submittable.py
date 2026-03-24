"""
Crawler for Submittable-powered arts organization open calls.

Submittable (submittable.com) is the dominant submission management platform
for arts organizations. Thousands of galleries, residencies, foundations, and
literary magazines use it as their sole application portal.

Crawl strategy:

  ARCHITECTURE NOTE — Why not scrape discover.submittable.com?
    discover.submittable.com is a WordPress editorial blog (tips for artists,
    writing craft articles). It does NOT list open calls. Submittable's public
    discovery UI (app.submittable.com/discover) is login-gated and has no
    public API. There is no central "browse all open calls" endpoint.

  What DOES work:
    Every organization on Submittable has a public subdomain:
      https://{org-slug}.submittable.com/submit

    These pages are server-rendered HTML and publicly accessible without
    login. They list all currently open calls for that organization.

  Strategy: maintain a curated list of arts/culture organizations on
    Submittable and crawl each org's /submit page to extract open calls.
    This is selective by design — we target art-relevant orgs and avoid
    polluting the open calls board with unrelated categories.

HTML structure (verified 2026-03-24):
  Listings are .category.panel-btn.relative divs. Key attributes:

    data-go="/login?returnUrl=%2Fsubmit%2F{id}%2F{slug}"
      → parse listing ID and slug from returnUrl
    data-go="/submit/{id}/{slug}"
      → direct link (when user is already logged in; rare on public pages)

  Inside each .category div:
    .header-3 > a          → listing title
    .date-text span         → deadline wrapper
    [data-render-react-date]→ deadline as "YYYY-MM-DD HH:MM:SSZ" (UTC)
                               NOTE: this is a React-rendered span; the inner
                               <time datetime="..."> is populated client-side,
                               so read data-render-react-date directly.
    .fee-column             → fee text (often empty if no fee)
    #category-description-{id}  → full description HTML

  Organization info from title tag:
    "{Org Name} Submission Manager"

  Organization API (public, no auth):
    https://{slug}.submittable.com/api/organizations/{guid}
    Returns: name, websiteUrl, tags, description, imageUrl, id, guid

  Listing URL construction:
    https://{org-slug}.submittable.com/submit/{listing-id}/{listing-slug}

Eligibility assignment:
  Most calls in this crawler are from arts orgs with geographic restrictions
  or open to specific demographics. We assign eligibility based on the
  organization's base (mostly US-regional or national). Individual call
  descriptions often contain specific eligibility requirements — these are
  preserved in the description field.

Type classification:
  Most calls on Submittable are submissions/open calls. We infer from title
  keywords when possible:
    "residency", "artist-in-residence", "fellowship" → residency or grant
    "grant", "award", "prize" → grant
    "commission", "public art" → commission
    "exhibition", "call", "open call", "juried" → submission
    default → submission

Rate limiting:
  We add 1-second delays between org page fetches and 0.5s between
  any secondary requests. The number of orgs is bounded by the curated list.

Confidence tier: "aggregated"
  Submittable is a platform; we're not the issuing organization.

Note on org list maintenance:
  The SUBMITTABLE_ORGS list below should be updated as new arts orgs are
  discovered using Submittable. Priority: Atlanta-area orgs first, then
  nationally recognized residencies/foundations, then lit mags and theaters.
"""

import logging
import re
import time
from datetime import date, datetime
from typing import Optional
from urllib.parse import parse_qs, unquote, urlparse

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_SUBMIT_URL = "https://{slug}.submittable.com/submit"
ORG_API_URL = "https://{slug}.submittable.com/api/organizations/{guid}"
LISTING_URL_TEMPLATE = (
    "https://{slug}.submittable.com/submit/{listing_id}/{listing_slug}"
)

# Polite delays
ORG_PAGE_DELAY = 1.0  # seconds between org page requests
DETAIL_DELAY = 0.5  # seconds between secondary requests (currently unused)

MAX_ORG_FAILURES = 5  # abort crawl if too many consecutive org pages fail

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# ---------------------------------------------------------------------------
# Curated org list
# ---------------------------------------------------------------------------
# Format: (org_slug, default_eligibility, default_call_type or None)
#   org_slug         — the subdomain prefix on submittable.com
#   default_elig     — fallback eligibility string for calls from this org
#   default_type     — fallback call_type if title inference fails (None = infer only)
#
# Priority ordering: Atlanta-area orgs first, then national/major orgs.
# Orgs are verified to be active on Submittable as of 2026-03-24.

SUBMITTABLE_ORGS: list[tuple[str, str, Optional[str]]] = [
    # --- Atlanta & Georgia area ---
    ("atlantacontemporary", "Georgia", "submission"),
    ("alliancetheatre", "Georgia", "submission"),
    ("burnawayatl", "Georgia", "submission"),
    ("theatlantaballet", "Georgia", "submission"),
    ("akingalleryjkc", "National", "submission"),
    ("noxonarts", "National", "submission"),
    ("callanwolde", "Georgia", "submission"),
    ("eyedrum", "Georgia", "submission"),
    ("whitespaceatlanta", "Georgia", "submission"),
    ("artsatl", "Georgia", None),
    ("spelman", "National", None),
    ("morehouse", "National", None),
    ("clayarksstudio", "National", "submission"),
    # --- Major national residencies & foundations ---
    ("artistsresidencies", "National", "residency"),
    ("hambidgecenter", "National", "residency"),
    ("macdowell", "National", "residency"),
    ("yaddo", "National", "residency"),
    ("sundanceinstitute", "National", None),
    ("sundance", "National", None),
    ("sva", "National", None),
    ("calarts", "National", None),
    ("risd", "National", None),
    ("prattinstitute", "National", None),
    ("artresidencythornbury", "International", "residency"),
    ("headlands", "National", "residency"),
    ("sfmoma", "National", "submission"),
    ("diaart", "National", None),
    ("newmuseum", "National", "submission"),
    ("iaspis", "International", "residency"),
    ("lightwork", "National", "residency"),
    ("modernsculpturestudio", "National", "submission"),
    # --- Film & media ---
    ("siffseattle", "National", "submission"),
    ("docnyc", "National", "submission"),
    ("tribecafilm", "National", "submission"),
    ("savannahff", "National", "submission"),
    ("atlantafilmfestival", "National", "submission"),
    # --- Literary magazines & writing orgs ---
    ("thekenyonreview", "National", "submission"),
    ("ploughshares", "National", "submission"),
    ("conjunctions", "National", "submission"),
    ("narrativemagazine", "National", "submission"),
    ("agni", "National", "submission"),
    ("themallereviewing", "National", "submission"),
    ("coloradoreview", "National", "submission"),
    ("gulfcoastlit", "National", "submission"),
    ("blackbird", "National", "submission"),
    ("claremontreview", "National", "submission"),
    ("triquarterly", "National", "submission"),
    ("newenglandreview", "National", "submission"),
    ("gettysburgrev", "National", "submission"),
    ("georgiarev", "National", "submission"),
    ("sewaneereview", "National", "submission"),
    ("mississippireview", "National", "submission"),
    ("cutbanklitmag", "National", "submission"),
    ("fiddleheadjournal", "National", "submission"),
    ("theadroitjournal", "National", "submission"),
    ("midwaylitmag", "National", "submission"),
    ("tilthousepress", "National", "submission"),
    # --- Visual arts & galleries ---
    ("photoville", "National", "submission"),
    ("societyofillustrators", "National", "submission"),
    ("internationalphoto", "National", "submission"),
    ("fracartscenter", "National", None),
    ("thesellgallery", "National", "submission"),
    ("hatchartgallery", "National", "submission"),
    ("artbridgesfw", "National", None),
    ("launchpadgallery", "National", "submission"),
    ("muralmural", "National", "submission"),
    ("publicartsaintpaul", "National", "commission"),
    ("arts-mpls", "National", None),
    # --- Grants & fellowships ---
    ("surdna", "National", "grant"),
    ("artistsalliance", "National", "grant"),
    ("creativeground", "National", "grant"),
    ("nationalgrants", "National", "grant"),
    ("nysca", "National", "grant"),
    ("artsmidwest", "National", "grant"),
    ("southarts", "National", "grant"),
    ("fultonarts", "National", "grant"),
    # --- Additional visual arts orgs (Wave 2) ---
    ("aperture", "National", "submission"),
    ("artadia", "National", "grant"),
    ("penland", "National", "residency"),
    ("andersonranch", "National", "residency"),
    ("oxbow", "National", "residency"),
    ("pilchuck", "National", "residency"),
    ("haystack", "National", "residency"),
    ("arrowmont", "National", "residency"),
    ("watershed", "National", "residency"),
    ("bemiscenter", "National", "residency"),
    ("smackmellon", "National", "submission"),
    ("creativetime", "National", "commission"),
    ("sculpture-center", "National", "submission"),
    ("whitneymuseum", "National", "submission"),
    ("newmuseum", "National", "submission"),
    ("ica-philly", "National", "submission"),
    ("walkart", "National", "submission"),
    ("socrates-sculpture", "National", "commission"),
    ("publicartfund", "National", "commission"),
    # --- Additional literary & writing ---
    ("tinhouse", "National", "submission"),
    ("graywolfpress", "National", "submission"),
    ("coppercanyonpress", "National", "submission"),
    ("milkweed", "National", "submission"),
    ("boaeditions", "National", "submission"),
    ("akashicbooks", "National", "submission"),
    ("poetryfoundation", "National", "grant"),
    ("apl-poetry", "National", "submission"),
    ("poemspoets", "National", "submission"),
    # --- Theater & performance ---
    ("tcg", "National", "grant"),
    ("newinc", "National", "residency"),
    ("eyebeam", "National", "residency"),
    ("mccarter", "National", "submission"),
    ("vineyard", "National", "submission"),
    ("playwrightshorizons", "National", "submission"),
    # --- Photography ---
    ("magnum", "National", "submission"),
    ("lensculture", "National", "submission"),
    ("photolucida", "National", "submission"),
    ("cpw", "National", "submission"),
    ("photoeye", "National", "submission"),
    # --- Music & sound ---
    ("issue-project-room", "National", "submission"),
    ("roulette", "National", "submission"),
]

# ---------------------------------------------------------------------------
# Type inference from title / keywords
# ---------------------------------------------------------------------------

_RESIDENCY_RE = re.compile(
    r"\b(residency|artist[- ]in[- ]residence|retreat|studio[- ]program)\b", re.I
)
_GRANT_RE = re.compile(
    r"\b(grant|award|prize|fellow(ship)?|scholarship|stipend)\b", re.I
)
_COMMISSION_RE = re.compile(
    r"\b(commission|public[- ]art|mural|permanent[- ]installation)\b", re.I
)
_SUBMISSION_RE = re.compile(
    r"\b(open[- ]call|call[- ]for|submission|juried|exhibition|proposal"
    r"|contest|competition|audition|anthology)\b",
    re.I,
)


def _infer_call_type(title: str, description: str) -> str:
    """
    Infer call_type from title and description text.
    Priority: residency > commission > grant > submission > submission (default).
    """
    text = f"{title} {description[:400]}"
    if _RESIDENCY_RE.search(text):
        return "residency"
    if _COMMISSION_RE.search(text):
        return "commission"
    if _GRANT_RE.search(text):
        return "grant"
    if _SUBMISSION_RE.search(text):
        return "submission"
    return "submission"  # default: most Submittable calls are submissions


# ---------------------------------------------------------------------------
# Skip-type filter (non-art categories)
# ---------------------------------------------------------------------------

# Titles matching these patterns are likely non-art listings
_SKIP_TITLE_RE = re.compile(
    r"\b(internship|employment|job offer|volunteer[- ]coordinator|"
    r"membership[- ]form|donation|sponsorship|vendor|catering|"
    r"conference[- ]abstract|scientific[- ]paper|medical|clinical[- ]trial)\b",
    re.I,
)


def _should_skip(title: str, description: str) -> bool:
    """Return True if this listing appears to be non-art (employment, etc.)."""
    return bool(_SKIP_TITLE_RE.search(f"{title} {description[:200]}"))


# ---------------------------------------------------------------------------
# HTTP session
# ---------------------------------------------------------------------------


def _make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )
    return session


def _fetch(
    session: requests.Session, url: str, accept_json: bool = False
) -> Optional[str]:
    """Fetch a URL and return the response text, or None on failure."""
    if accept_json:
        session.headers.update({"Accept": "application/json"})
    try:
        resp = session.get(url, timeout=30)
        if accept_json:
            session.headers.update(
                {
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
                }
            )
        if resp.status_code == 404:
            # Org doesn't exist on Submittable — not an error
            return None
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("Submittable: fetch failed for %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Parse org page
# ---------------------------------------------------------------------------


def _extract_org_name_from_title(soup: BeautifulSoup) -> str:
    """
    Extract org name from the page title tag.
    Title format: "{Org Name} Submission Manager"
    """
    title_el = soup.find("title")
    if not title_el:
        return ""
    title_text = title_el.get_text(strip=True)
    # Strip trailing " Submission Manager" or " Application Manager"
    name = re.sub(
        r"\s+(Submission|Application)\s+Manager\s*$", "", title_text, flags=re.I
    )
    return name.strip()


def _extract_guid_from_page(html: str) -> Optional[str]:
    """
    Extract the organization GUID from the page HTML.
    It appears in the /api/organizations/{guid} URL loaded by the page's JS.
    """
    m = re.search(
        r"/api/organizations/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})",
        html,
    )
    return m.group(1) if m else None


def _parse_listing_url_from_data_go(
    data_go: str, org_slug: str
) -> tuple[str, str, str]:
    """
    Parse listing_id, listing_slug, and full listing URL from the data-go attribute.

    data-go formats:
      /login?returnUrl=%2Fsubmit%2F{id}%2F{slug}  (most common)
      /submit/{id}/{slug}                           (direct, less common)

    Returns (listing_id, listing_slug, full_url).
    Returns ("", "", "") if parsing fails.
    """
    if not data_go:
        return "", "", ""

    submit_path = ""
    if data_go.startswith("/submit/"):
        submit_path = data_go
    else:
        parsed = urlparse(data_go)
        qs = parse_qs(parsed.query)
        return_url = qs.get("returnUrl", [""])[0]
        submit_path = unquote(return_url)

    m = re.match(r"/submit/(\d+)/([^/?#]+)", submit_path)
    if not m:
        return "", "", ""

    listing_id = m.group(1)
    listing_slug = m.group(2)
    full_url = LISTING_URL_TEMPLATE.format(
        slug=org_slug,
        listing_id=listing_id,
        listing_slug=listing_slug,
    )
    return listing_id, listing_slug, full_url


def _parse_deadline(datetime_str: str) -> Optional[str]:
    """
    Parse a Submittable deadline string to 'YYYY-MM-DD'.

    Submittable uses: "2026-04-06 04:00:00Z"  (UTC)
    We take the date portion and convert from UTC to local date.
    Since deadlines are commonly midnight ET (= 04:00 UTC), we subtract
    a day if the UTC time is before 06:00 to get the correct local deadline.

    Returns None if unparseable.
    """
    if not datetime_str:
        return None
    datetime_str = datetime_str.strip()

    # Try parsing as UTC datetime
    try:
        # Format: "2026-04-06 04:00:00Z"
        dt = datetime.fromisoformat(datetime_str.replace("Z", "+00:00"))
        # Convert to US/Eastern approximate (UTC-4 or UTC-5)
        # For deadline purposes: if UTC hour < 6, this is likely the previous
        # US calendar day (midnight ET = 04:00 UTC in EDT, 05:00 in EST)
        if dt.hour < 6:
            return (dt.date() - __import__("datetime").timedelta(days=1)).isoformat()
        return dt.date().isoformat()
    except (ValueError, AttributeError):
        pass

    # Fallback: just extract the date portion
    m = re.match(r"(\d{4}-\d{2}-\d{2})", datetime_str)
    return m.group(1) if m else None


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if the deadline date has already passed."""
    if not deadline_str:
        return False
    try:
        dl = date.fromisoformat(deadline_str)
        return dl < date.today()
    except ValueError:
        return False


def _parse_fee_text(fee_text: str) -> Optional[float]:
    """
    Extract dollar amount from fee column text.

    "$25 entry fee" → 25.0
    "No fee" / empty → 0.0
    "Fee required" (no amount) → None
    """
    if not fee_text:
        return None
    text = fee_text.strip().lower()
    if not text:
        return None
    if re.search(r"\bno\s+fee\b|free|no\s+charge", text):
        return 0.0
    m = re.search(r"\$\s*(\d+(?:\.\d+)?)", text)
    if m:
        return float(m.group(1))
    # Has fee text but no parseable amount
    if re.search(r"\bfee\b", text):
        return None  # fee exists, unknown amount
    return None


def _extract_description(soup_div) -> Optional[str]:
    """
    Extract and clean description text from a .category-description div.
    Strips HTML, collapses whitespace, caps at 3000 chars.
    """
    if not soup_div:
        return None
    text = soup_div.get_text(separator=" ", strip=True)
    # Collapse multiple spaces/newlines
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text[:3000] if text else None


# ---------------------------------------------------------------------------
# Parse one org's /submit page
# ---------------------------------------------------------------------------


def _parse_org_page(
    html: str,
    org_slug: str,
    source_id: int,
    default_eligibility: str,
    default_call_type: Optional[str],
) -> list[dict]:
    """
    Parse one organization's /submit page and return a list of call_data dicts
    ready for insert_open_call().

    Each call_data dict includes a '_org_name' key (consumed by insert_open_call
    for slug generation) that is NOT a real column.

    Returns [] if no open calls found or parsing fails.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Org name from title
    org_name = _extract_org_name_from_title(soup)
    if not org_name:
        # Fallback: humanize the slug
        org_name = org_slug.replace("-", " ").title()

    calls: list[dict] = []

    # Find all listing panels: .category.panel-btn elements with data-go
    listing_panels = soup.find_all(
        "div",
        attrs={"data-go": True},
        class_="category",
    )

    if not listing_panels:
        logger.debug(
            "Submittable [%s]: no listing panels found (page may have 0 open calls)",
            org_slug,
        )
        return []

    for panel in listing_panels:
        data_go = panel.get("data-go", "")
        listing_id, listing_slug, listing_url = _parse_listing_url_from_data_go(
            data_go, org_slug
        )
        if not listing_id:
            logger.debug(
                "Submittable [%s]: could not parse listing URL from data-go=%r",
                org_slug,
                data_go,
            )
            continue

        # Title
        title_el = panel.find(class_="header-3")
        title = title_el.get_text(strip=True) if title_el else ""
        if not title:
            logger.debug(
                "Submittable [%s]: listing %s has empty title — skipping",
                org_slug,
                listing_id,
            )
            continue

        # Deadline — from data-render-react-date attribute
        deadline_el = panel.find(attrs={"data-render-react-date": True})
        deadline_str = (
            deadline_el.get("data-render-react-date", "") if deadline_el else ""
        )
        deadline = _parse_deadline(deadline_str)

        if _is_past_deadline(deadline):
            logger.debug(
                "Submittable [%s]: '%s' — deadline %s passed, skipping",
                org_slug,
                title[:60],
                deadline,
            )
            continue

        # Fee
        fee_el = panel.find(class_="fee-column")
        fee_text = fee_el.get_text(strip=True) if fee_el else ""
        fee = _parse_fee_text(fee_text)

        # Description — in collapse div with id="category-description-{listing_id}"
        desc_div = soup.find(id=f"category-description-{listing_id}")
        description = _extract_description(desc_div)

        # Type inference
        call_type = (
            _infer_call_type(title, description or "")
            if default_call_type is None
            else _infer_call_type(title, description or "") or default_call_type
        )
        # The default_call_type from the org list serves as a hint but title
        # keywords take precedence when they produce a different classification.
        # If title inference returns the generic "submission" default, fall back
        # to the org's default_call_type if one was specified.
        if (
            call_type == "submission"
            and default_call_type
            and default_call_type != "submission"
        ):
            call_type = default_call_type

        # Skip non-art listings
        if _should_skip(title, description or ""):
            logger.debug(
                "Submittable [%s]: skipping '%s' — appears non-art",
                org_slug,
                title[:60],
            )
            continue

        calls.append(
            {
                "title": title,
                "description": description,
                "deadline": deadline,
                "application_url": listing_url,
                "source_url": listing_url,
                "call_type": call_type,
                "eligibility": default_eligibility,
                "fee": fee,
                "source_id": source_id,
                "confidence_tier": "aggregated",
                "_org_name": org_name,
                "metadata": {
                    "source": "submittable",
                    "org_slug": org_slug,
                    "org_name": org_name,
                    "listing_id": listing_id,
                    "listing_slug": listing_slug,
                    "scope": (
                        "national"
                        if default_eligibility == "National"
                        else (
                            "international"
                            if default_eligibility == "International"
                            else "regional"
                        )
                    ),
                },
            }
        )

    return calls


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Submittable-powered arts organization open calls.

    Strategy:
      1. Iterate through SUBMITTABLE_ORGS list.
      2. For each org, fetch {slug}.submittable.com/submit.
      3. Parse listing panels from the server-rendered HTML.
      4. Skip past-deadline calls and non-art listings.
      5. Insert or update via insert_open_call().

    Returns (found, new, updated).

      found   = eligible calls (passed deadline + type filters)
      new     = newly inserted calls
      updated = already-existing calls (updated in place by insert_open_call)
    """
    source_id = source["id"]
    found = new = updated = 0
    consecutive_failures = 0

    session = _make_session()

    for org_slug, default_eligibility, default_call_type in SUBMITTABLE_ORGS:
        submit_url = BASE_SUBMIT_URL.format(slug=org_slug)

        # Rate limiting — polite delay between orgs
        time.sleep(ORG_PAGE_DELAY)

        html = _fetch(session, submit_url)
        if html is None:
            consecutive_failures += 1
            logger.debug(
                "Submittable: org '%s' returned no HTML (org may not exist or is inactive)",
                org_slug,
            )
            if consecutive_failures >= MAX_ORG_FAILURES:
                logger.warning(
                    "Submittable: %d consecutive org failures — possible connectivity issue",
                    consecutive_failures,
                )
                consecutive_failures = 0  # reset but continue
            continue

        consecutive_failures = 0

        calls = _parse_org_page(
            html, org_slug, source_id, default_eligibility, default_call_type
        )

        if not calls:
            logger.debug("Submittable [%s]: 0 open calls", org_slug)
            continue

        logger.info("Submittable [%s]: %d open calls", org_slug, len(calls))

        for call_data in calls:
            found += 1
            result = insert_open_call(call_data)
            if result:
                new += 1

    logger.info(
        "Submittable: crawl complete — %d found (eligible), %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
