#!/usr/bin/env python3
"""
Festival Classification — hydrate primary_type, experience_tags, audience,
size_tier, indoor_outdoor, price_tier for all festivals.

Rules-based classification from name, description, existing categories,
and festival_type. No LLM needed — we know all 170 festivals.

Usage:
    python3 classify_festivals.py --dry-run
    python3 classify_festivals.py
    python3 classify_festivals.py --slug dragon-con --dry-run
"""

import re
import sys
import logging
import argparse
from pathlib import Path

from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))
from db import get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# PRIMARY TYPE RULES
# ---------------------------------------------------------------------------
# Order matters — first match wins. More specific patterns first.

PRIMARY_TYPE_RULES: list[tuple[str, list[str], list[str], list[str]]] = [
    # (type, name_keywords, description_keywords, old_categories)
    # Matched if ANY keyword in name OR description OR old_categories hits

    # Tech conferences (very specific names)
    ("tech_conference", [
        "renderatl", "devnexus", "red hat summit", "connect.tech",
        "atlanta tech week", "invest fest",
    ], ["tech conference", "developer conference", "software"], []),

    # Film festivals
    ("film_festival", [
        "film fest", "film festival", "shortsfest", "out on film",
        "bronzelens", "buried alive", "cobb international film",
        "horror film", "documentary film", "spotlight film",
    ], ["film festival", "film screening", "filmmakers", "independent film"], ["film"]),

    # Athletic events
    ("athletic_event", [
        "marathon", "road race", "half marathon", "spartan",
        "5k run", "aids walk", "dragon boat",
        "roller derby", "monster truck", "speedway",
    ], ["10k race", "obstacle course", "run/walk", "runners"], ["fitness"]),

    # Holiday spectacles
    ("holiday_spectacle", [
        "christmas", "holiday nights", "nights of lights",
        "illuminights", "christkindl", "oktoberfest",
        "countdown over", "dino fest",
        "lunar new year festival", "stone mountain lunar",
    ], ["million lights", "holiday", "christmas light"], []),

    # Fairs
    ("fair", [
        "county fair", "country fair", "state fair",
        "renaissance festival", "ren fest",
    ], ["county fair", "carnival rides, livestock"], []),

    # Markets
    ("market", [
        "antique market", "farmers market", "scott antique",
        "plant fest",
    ], ["antique show", "dealer booths", "vendor tables"], []),

    # Pop culture conventions
    ("pop_culture_con", [
        "dragon con", "momocon", "anime weekend",
        "dreamhack", "furry weekend", "frolicon",
        "monsterama", "daggercon", "toylanta",
        "days of the dead", "collect-a-con",
        "vampire diaries",
    ], ["anime convention", "cosplay", "gaming convention", "pop culture"], ["gaming"]),

    # Hobby expos
    ("hobby_expo", [
        "blade show", "repticon", "reptile expo",
        "pen show", "coin show", "stamp expo",
        "model train", "boat show", "auto show",
        "rv show", "camping & rv", "gun show",
        "home show", "orchid show", "bead show",
        "quilt", "sewing", "woodworking fair",
        "rare book fair", "kennel club", "brick con",
        "record & cd show", "record show",
    ], ["expo", "trade show", "exhibitors", "dealers"], []),

    # Cultural festivals
    ("cultural_festival", [
        "greek festival", "japanfest", "juneteenth",
        "irishfest", "caribbean carnival", "korean festival",
        "holi festival", "eid festival", "diwali",
        "lunar new year", "tet atlanta", "latino",
        "panda fest", "esfna", "international festival",
        "highland games", "cherry blossom",
        "southern fried queer pride",
        "queer pride",
    ], [
        "cultural festival", "heritage festival", "cultural performances",
        "celebrating .* culture", "diaspora",
    ], ["cultural_heritage"]),

    # Food festivals
    ("food_festival", [
        "taste of", "beer fest", "wine fest",
        "beer, bourbon", "bbq festival", "oysterfest",
        "pizza festival", "ice cream festival",
        "mac & cheese", "mac and cheese",
        "wine festival", "vegfest", "vineyard fest",
        "chomp", "wing & rock", "wing fest",
        "sips under the sea", "pigs & peaches",
        "smoke on the lake",
        "bluesberry beer",
    ], ["food festival", "beer festival", "wine tasting", "tasting tables"], []),

    # Music festivals (broad — catches remaining music-focused ones)
    ("music_festival", [
        "shaky knees", "music midtown", "musicfest",
        "sweetwater 420", "jazz festival", "420 fest",
        "imagine music", "breakaway", "freely fest",
        "a3c", "afropunk", "one musicfest",
        "wire & wood", "porchfest", "country fest",
        "lantern parade",
        "shamrock", "lanta gras",
    ], ["music festival", "multiple stages", "headliners", "bands"], []),

    # Arts festivals
    ("arts_festival", [
        "art festival", "arts festival", "art fair",
        "dogwood festival", "art splash",
        "decatur book", "maker faire",
        "tattoo arts",
    ], ["juried art", "fine arts festival", "artists market"], ["art"]),

    # Community festivals (catch-all for neighborhood/suburban fests)
    ("community_festival", [
        "fall fest", "spring fest", "summerfest",
        "days festival", "day festival",
        "strut", "festival of",
        "streets alive", "lemonade days",
    ], ["neighborhood", "community celebration", "town square"], []),
]

# Manual overrides for tricky ones
PRIMARY_TYPE_OVERRIDES = {
    "dragon-con": "pop_culture_con",
    "momocon": "pop_culture_con",
    "atlanta-pride": "cultural_festival",
    "atl-pride": "cultural_festival",
    "east-atlanta-strut": "community_festival",
    "out-on-film": "film_festival",
    "atlanta-science-festival": "community_festival",
    "beltline-lantern-parade": "arts_festival",
    "atlanta-streets-alive": "community_festival",
    "fernbank-after-dark": "food_festival",
    "sips-under-the-sea": "food_festival",
    "braves-fest": "community_festival",
    "braves-country-fest": "music_festival",
    "pullman-yards-atlanta-art-fair": "arts_festival",
    "caffeine-and-octane-fest": "hobby_expo",
    "atlanta-salsa-bachata-festival": "cultural_festival",
    "invest-fest": "tech_conference",
    "devnexus": "tech_conference",
    "red-hat-summit": "tech_conference",
    "renderatl": "tech_conference",
    "connect-tech": "tech_conference",
    "big-shanty-festival": "community_festival",
    "snellville-days-festival": "community_festival",
    "roswell-roots-festival": "community_festival",
    "little-5-points-halloween": "community_festival",
    "inman-park-festival": "community_festival",
    "candler-park-fall-fest": "community_festival",
    "grant-park-summer-shade": "community_festival",
    "sweet-auburn-springfest": "community_festival",
    "yellow-daisy-festival": "arts_festival",
    "decatur-arts-festival": "arts_festival",
    "duluth-fall-festival": "community_festival",
    "chalktoberfest": "arts_festival",
    "dogwood-festival": "arts_festival",
    "atlanta-dogwood-festival": "arts_festival",
    "virginia-highland-summerfest": "arts_festival",
    "roswell-arts-festival": "arts_festival",
    "suwanee-arts-festival": "arts_festival",
    "dunwoody-art-festival": "arts_festival",
    "norcross-art-splash": "arts_festival",
    "geranium-festival": "community_festival",
    "tucker-day": "community_festival",
    "lawrenceville-boogie": "community_festival",
    "newnan-porchfest": "music_festival",
    "smyrna-jonquil-festival": "community_festival",
    "blue-ridge-blues-bbq": "music_festival",
    "ga-renaissance-festival": "fair",
    "jordancon": "pop_culture_con",
    "atlanta-horror-film-fest": "film_festival",
    "galiff": "film_festival",
    "petit-le-mans": "athletic_event",
}


def classify_primary_type(slug: str, name: str, desc: str, old_cats: list[str], festival_type: str) -> str:
    # Check overrides first
    if slug in PRIMARY_TYPE_OVERRIDES:
        return PRIMARY_TYPE_OVERRIDES[slug]

    name_lower = name.lower()
    desc_lower = (desc or "").lower()

    for ptype, name_kws, desc_kws, cat_kws in PRIMARY_TYPE_RULES:
        # Name match
        for kw in name_kws:
            if kw in name_lower:
                return ptype
        # Description match
        for kw in desc_kws:
            if re.search(kw, desc_lower):
                return ptype
        # Old category match
        for kw in cat_kws:
            if kw in old_cats:
                return ptype

    # Fallback based on festival_type
    if festival_type == "convention":
        return "hobby_expo"

    return "community_festival"


# ---------------------------------------------------------------------------
# EXPERIENCE TAGS
# ---------------------------------------------------------------------------

EXPERIENCE_TAG_RULES: dict[str, dict] = {
    "live_music": {
        "name": ["music", "fest", "jazz", "blues", "rock", "concert", "musicfest"],
        "desc": ["live music", "live band", "multiple stages", "headliner", "musical", "performers", "dj sets", "soca music", "steel drums"],
        "cats": ["music"],
    },
    "food_tasting": {
        "name": ["taste of", "food", "beer", "wine", "bbq", "oysterfest", "pizza", "ice cream", "mac & cheese", "chomp", "wing"],
        "desc": ["food vendor", "tasting", "cuisine", "restaurant", "chef", "food truck", "sampling", "craft beer", "breweries", "wine"],
        "cats": ["food_drink"],
    },
    "art_exhibits": {
        "name": ["art ", "arts ", "gallery", "chalk", "maker faire"],
        "desc": ["juried art", "fine art", "artist", "sculpture", "painting", "photography", "art show", "chalk art", "murals"],
        "cats": ["art"],
    },
    "film_screenings": {
        "name": ["film"],
        "desc": ["film screening", "filmmaker", "independent film", "documentary", "short film"],
        "cats": ["film"],
    },
    "cosplay": {
        "name": ["dragon con", "momocon", "anime", "furry", "monsterama", "daggercon"],
        "desc": ["cosplay", "costume contest", "masquerade costume"],
        "cats": [],
    },
    "gaming": {
        "name": ["gaming", "dreamhack", "esport", "brick con", "southern fried gaming"],
        "desc": ["arcade", "pinball", "tabletop", "video game", "esport", "lan party", "gaming"],
        "cats": ["gaming"],
    },
    "outdoor": {
        "name": ["park", "streets alive", "beltline"],
        "desc": ["piedmont park", "outdoor", "park setting", "lakeside", "town square", "downtown", "trail"],
        "cats": [],
    },
    "racing": {
        "name": ["marathon", "road race", "5k", "spartan", "half marathon", "walk"],
        "desc": ["10k race", "runners", "obstacle course", "run/walk", "5k run"],
        "cats": ["fitness"],
    },
    "shopping": {
        "name": ["market", "antique", "expo", "show"],
        "desc": ["vendor", "dealer", "booth", "marketplace", "exhibitor", "merchant"],
        "cats": [],
    },
    "workshops": {
        "name": ["maker faire"],
        "desc": ["workshop", "demonstration", "hands-on", "seminar", "class", "clinic", "tutorial"],
        "cats": ["learning"],
    },
    "speakers": {
        "name": ["summit", "conference", "renderatl", "devnexus", "connect.tech"],
        "desc": ["panel", "keynote", "speaker", "talk", "lecture", "q&a", "conference"],
        "cats": [],
    },
    "kids_activities": {
        "name": [],
        "desc": ["kids zone", "kids area", "children", "family activities", "kids activities"],
        "cats": ["family"],
    },
    "carnival_rides": {
        "name": ["fair", "lemonade days"],
        "desc": ["carnival ride", "midway", "ferris wheel", "rides"],
        "cats": [],
    },
    "cultural_heritage": {
        "name": ["greek", "japan", "korean", "caribbean", "irish", "juneteenth", "eid", "diwali", "holi", "tet", "latino", "lunar", "highland games", "queer pride", "pride"],
        "desc": ["heritage", "tradition", "cultural", "celebrating .* culture", "diaspora", "folk danc"],
        "cats": [],
    },
    "nightlife": {
        "name": ["frolicon", "after dark"],
        "desc": ["adults-only", "cocktail", "after-hours", "dj set", "club", "after dark", "nightlife"],
        "cats": ["nightlife"],
    },
}


def classify_experience_tags(name: str, desc: str, old_cats: list[str], primary_type: str) -> list[str]:
    name_lower = name.lower()
    desc_lower = (desc or "").lower()
    tags = []

    for tag, rules in EXPERIENCE_TAG_RULES.items():
        matched = False
        for kw in rules["name"]:
            if kw in name_lower:
                matched = True
                break
        if not matched:
            for kw in rules["desc"]:
                if re.search(kw, desc_lower):
                    matched = True
                    break
        if not matched:
            for kw in rules["cats"]:
                if kw in old_cats:
                    matched = True
                    break
        if matched:
            tags.append(tag)

    # Ensure primary type implies at least one tag
    type_to_tag = {
        "music_festival": "live_music",
        "food_festival": "food_tasting",
        "arts_festival": "art_exhibits",
        "film_festival": "film_screenings",
        "athletic_event": "racing",
        "pop_culture_con": "cosplay",
    }
    implied = type_to_tag.get(primary_type)
    if implied and implied not in tags:
        tags.append(implied)

    return sorted(set(tags))


# ---------------------------------------------------------------------------
# AUDIENCE
# ---------------------------------------------------------------------------

ADULTS_ONLY_SLUGS = {"frolicon", "fernbank-after-dark", "sips-under-the-sea"}
TWENTY_ONE_PLUS_PATTERNS = ["beer fest", "wine fest", "beer, bourbon", "bourbon", "oysterfest", "after dark"]
INDUSTRY_SLUGS = {"renderatl", "devnexus", "red-hat-summit", "connect-tech", "invest-fest", "international-woodworking-fair", "atlanta-tech-week"}
FAMILY_PATTERNS = ["family", "kids", "children", "all ages", "kid-friendly"]


def classify_audience(slug: str, name: str, desc: str, old_cats: list[str], primary_type: str) -> str:
    if slug in ADULTS_ONLY_SLUGS:
        return "adults_only"
    if slug in INDUSTRY_SLUGS:
        return "industry"

    name_lower = name.lower()
    desc_lower = (desc or "").lower()

    for pat in TWENTY_ONE_PLUS_PATTERNS:
        if pat in name_lower or pat in desc_lower:
            return "21_plus"

    if "family" in old_cats:
        return "family"
    for pat in FAMILY_PATTERNS:
        if pat in desc_lower:
            return "family"

    # Most festivals and community events are all_ages
    if primary_type in ("community_festival", "cultural_festival", "arts_festival",
                         "fair", "holiday_spectacle", "athletic_event"):
        return "all_ages"

    return "all_ages"


# ---------------------------------------------------------------------------
# SIZE TIER
# ---------------------------------------------------------------------------

MEGA_PATTERNS = ["60,000", "100,000", "250,000", "240,000", "140,000", "world's largest 10k"]
MEGA_SLUGS = {
    "dragon-con", "peachtree-road-race", "gwinnett-county-fair",
    "cumming-country-fair", "stone-mountain-christmas",
    "music-midtown", "shaky-knees", "sweetwater-420-fest",
    "atlanta-pride", "atl-pride", "lake-lanier-lights",
    "one-musicfest", "garden-lights-holiday-nights",
    "juneteenth-atlanta",
}
MAJOR_SLUGS = {
    "momocon", "anime-weekend-atlanta", "atlanta-jazz-festival",
    "atlanta-dogwood-festival", "inman-park-festival", "decatur-arts-festival",
    "atlanta-film-festival", "juneteenth-atlanta", "furry-weekend-atlanta",
    "candler-park-fall-fest", "grant-park-summer-shade",
    "duluth-fall-festival", "brookhaven-cherry-blossom",
    "blade-show", "ga-renaissance-festival",
    "east-atlanta-strut", "little-5-points-halloween",
    "sweet-auburn-springfest", "atlanta-marathon",
    "afropunk-atlanta", "a3c-festival", "imagine-music-festival",
    "renderatl", "devnexus", "beltline-lantern-parade",
    "atlanta-streets-alive", "north-georgia-state-fair",
    "virginia-highland-summerfest", "atlanta-greek-festival",
    "japanfest-atlanta", "stone-mountain-highland-games",
    "atlanta-korean-festival", "caffeine-and-octane-fest",
    "yellow-daisy-festival", "taste-of-atlanta", "taste-of-atlanta-fest",
    "dogwood-festival", "atlanta-dogwood-festival",
    "petit-le-mans", "dreamhack-atlanta",
    "chomp-and-stomp", "scott-antique-markets",
    "red-hat-summit", "southern-fried-queer-pride",
}
INTIMATE_PATTERNS = ["40+ dealers", "niche", "monthly"]
INTIMATE_SLUGS = {
    "atlanta-coin-show", "atlanta-pen-show", "southeastern-stamp-expo",
    "atlanta-bead-show", "atlanta-record-show",
}


def classify_size_tier(slug: str, name: str, desc: str) -> str:
    desc_lower = (desc or "").lower()

    if slug in MEGA_SLUGS:
        return "mega"
    for pat in MEGA_PATTERNS:
        if pat in desc_lower:
            return "mega"

    if slug in MAJOR_SLUGS:
        return "major"
    # Check for size signals
    for pat in ["25,000", "30,000", "20,000", "17,000", "10,000", "15,000"]:
        if pat in desc_lower:
            return "major"

    if slug in INTIMATE_SLUGS:
        return "intimate"
    for pat in INTIMATE_PATTERNS:
        if pat in desc_lower:
            return "intimate"

    return "local"


# ---------------------------------------------------------------------------
# INDOOR / OUTDOOR
# ---------------------------------------------------------------------------

INDOOR_SLUGS = {
    "dragon-con", "momocon", "anime-weekend-atlanta", "dreamhack-atlanta",
    "furry-weekend-atlanta", "frolicon", "jordancon", "monsterama-con",
    "daggercon", "toylanta", "atlanta-film-festival", "out-on-film",
    "atlanta-horror-film-fest", "buried-alive-film-fest", "galiff",
    "blade-show", "repticon-atlanta", "southeast-reptile-expo",
    "atlanta-pen-show", "atlanta-coin-show", "atlanta-model-train-show",
    "atlanta-bead-show", "atlanta-record-show", "southeastern-stamp-expo",
    "atlanta-boat-show", "atlanta-camping-rv-show", "atlanta-auto-show",
    "atlanta-home-show", "ga-celebrates-quilts", "original-sewing-quilt-expo",
    "international-woodworking-fair", "rk-gun-show-atlanta",
    "atlanta-brick-con", "atlanta-orchid-show",
    "conyers-kennel-club", "atlanta-rare-book-fair",
    "renderatl", "devnexus", "red-hat-summit", "connect-tech",
    "invest-fest", "atlanta-tech-week",
    "fernbank-after-dark", "sips-under-the-sea",
    "collect-a-con-atlanta", "days-of-the-dead-atlanta",
    "atlanta-salsa-bachata-festival",
    "scott-antique-markets",
}
OUTDOOR_SLUGS = {
    "peachtree-road-race", "atlanta-marathon", "thanksgiving-half-marathon",
    "spartan-race-atlanta", "aids-walk-atlanta",
    "atlanta-streets-alive", "beltline-lantern-parade",
    "caffeine-and-octane-fest",
    "petit-le-mans",
}


def classify_indoor_outdoor(slug: str, name: str, desc: str, primary_type: str) -> str:
    if slug in INDOOR_SLUGS:
        return "indoor"
    if slug in OUTDOOR_SLUGS:
        return "outdoor"

    desc_lower = (desc or "").lower()

    # Most cons/expos are indoor
    if primary_type in ("pop_culture_con", "hobby_expo", "tech_conference"):
        return "indoor"

    # Fairs and holiday spectacles are mostly outdoor
    if primary_type in ("fair", "holiday_spectacle"):
        return "outdoor"

    # Festivals mentioning parks, squares, downtown streets
    if any(kw in desc_lower for kw in ["park", "square", "downtown", "outdoor", "street"]):
        return "outdoor"

    # Food festivals are often both
    if primary_type == "food_festival":
        return "both"

    # Community and cultural festivals are mostly outdoor
    if primary_type in ("community_festival", "cultural_festival", "arts_festival", "music_festival"):
        return "outdoor"

    return "both"


# ---------------------------------------------------------------------------
# PRICE TIER
# ---------------------------------------------------------------------------

FREE_INDICATORS = ["free admission", "free to attend", "free event"]


def classify_price_tier(slug: str, name: str, desc: str, is_free: bool, primary_type: str) -> str:
    if is_free:
        return "free"

    desc_lower = (desc or "").lower()
    for pat in FREE_INDICATORS:
        if pat in desc_lower:
            return "free"

    # Premium events (multi-day passes $100+)
    premium_types = {"pop_culture_con", "tech_conference"}
    premium_slugs = {
        "dragon-con", "momocon", "anime-weekend-atlanta", "dreamhack-atlanta",
        "furry-weekend-atlanta", "frolicon", "renderatl", "devnexus",
        "red-hat-summit", "invest-fest", "shaky-knees", "music-midtown",
        "sweetwater-420-fest", "one-musicfest", "imagine-music-festival",
        "breakaway-atlanta", "afropunk-atlanta",
        "petit-le-mans", "ga-renaissance-festival",
    }
    if slug in premium_slugs or primary_type in premium_types:
        return "premium"

    # Moderate ($25-100): paid fests, expos, tastings
    moderate_types = {"hobby_expo", "food_festival", "film_festival"}
    if primary_type in moderate_types:
        return "moderate"

    # Holiday spectacles are usually moderate
    if primary_type == "holiday_spectacle":
        return "moderate"

    # Fairs are budget
    if primary_type == "fair":
        return "budget"

    # Athletic events are moderate (registration fees)
    if primary_type == "athletic_event":
        return "moderate"

    return "budget"


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def classify_festivals(dry_run: bool = False, slug: str = None):
    client = get_client()

    query = client.table("festivals").select(
        "id,slug,name,description,categories,festival_type,free,"
        "primary_type,experience_tags,audience,size_tier,indoor_outdoor,price_tier"
    )
    if slug:
        query = query.eq("slug", slug)

    result = query.order("name").execute()
    festivals = result.data or []

    stats = {
        "total": len(festivals),
        "classified": 0,
        "skipped": 0,
    }
    type_dist: dict[str, int] = {}
    audience_dist: dict[str, int] = {}
    size_dist: dict[str, int] = {}
    setting_dist: dict[str, int] = {}
    price_dist: dict[str, int] = {}

    logger.info(f"Festival Classification")
    logger.info(f"{'=' * 80}")
    logger.info(f"Total: {len(festivals)} | Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    logger.info(f"{'=' * 80}\n")

    for f in festivals:
        name = f["name"]
        s = f["slug"]
        desc = f.get("description") or ""
        old_cats = f.get("categories") or []
        ft = f.get("festival_type") or "festival"
        is_free = f.get("free", False)

        # Classify
        pt = classify_primary_type(s, name, desc, old_cats, ft)
        et = classify_experience_tags(name, desc, old_cats, pt)
        aud = classify_audience(s, name, desc, old_cats, pt)
        sz = classify_size_tier(s, name, desc)
        io = classify_indoor_outdoor(s, name, desc, pt)
        price = classify_price_tier(s, name, desc, is_free, pt)

        # Track distributions
        type_dist[pt] = type_dist.get(pt, 0) + 1
        audience_dist[aud] = audience_dist.get(aud, 0) + 1
        size_dist[sz] = size_dist.get(sz, 0) + 1
        setting_dist[io] = setting_dist.get(io, 0) + 1
        price_dist[price] = price_dist.get(price, 0) + 1

        # Build update
        updates = {
            "primary_type": pt,
            "experience_tags": et,
            "audience": aud,
            "size_tier": sz,
            "indoor_outdoor": io,
            "price_tier": price,
        }

        tag_str = ", ".join(et[:4])
        if len(et) > 4:
            tag_str += f" +{len(et)-4}"

        logger.info(f"  {name:<42} {pt:<22} {aud:<12} {sz:<8} {io:<8} {price:<8}  [{tag_str}]")

        if not dry_run:
            client.table("festivals").update(updates).eq("id", f["id"]).execute()

        stats["classified"] += 1

    # Summary
    logger.info(f"\n{'=' * 80}")
    logger.info(f"DISTRIBUTION SUMMARY")
    logger.info(f"{'=' * 80}")

    logger.info(f"\nPrimary Type:")
    for k, v in sorted(type_dist.items(), key=lambda x: -x[1]):
        bar = "#" * v
        logger.info(f"  {k:<22} {v:>3}  {bar}")

    logger.info(f"\nAudience:")
    for k, v in sorted(audience_dist.items(), key=lambda x: -x[1]):
        logger.info(f"  {k:<22} {v:>3}")

    logger.info(f"\nSize Tier:")
    for k, v in sorted(size_dist.items(), key=lambda x: -x[1]):
        logger.info(f"  {k:<22} {v:>3}")

    logger.info(f"\nSetting:")
    for k, v in sorted(setting_dist.items(), key=lambda x: -x[1]):
        logger.info(f"  {k:<22} {v:>3}")

    logger.info(f"\nPrice Tier:")
    for k, v in sorted(price_dist.items(), key=lambda x: -x[1]):
        logger.info(f"  {k:<22} {v:>3}")

    logger.info(f"\nTotal classified: {stats['classified']}")
    if dry_run:
        logger.info(f"DRY RUN — no changes written")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Classify festivals into structured taxonomy")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--slug", type=str)
    args = parser.parse_args()
    classify_festivals(dry_run=args.dry_run, slug=args.slug)
