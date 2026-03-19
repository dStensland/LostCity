"""
Cuisine and service style classification for venues.

Two-phase approach matching the classify_venues.py pattern:
1. Rules-based regex on venue name (fast, free)
2. LLM batch classification for unmatched venues (configured provider, temp=0)

Also classifies service_style using venue_type heuristics + LLM fallback.

Usage:
    python classify_cuisine.py --dry-run          # Preview classifications
    python classify_cuisine.py --limit 50         # Classify first 50
    python classify_cuisine.py --no-llm           # Rules only
    python classify_cuisine.py --venue-type bar   # Only bars
"""

import re
import time
import logging
import argparse
from typing import Optional
from dotenv import load_dotenv
from db import get_client
from config import get_config
from llm_client import generate_text

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


# ─── CONTROLLED VOCABULARY ──────────────────────────────────────────────────

VALID_CUISINES = {
    "mexican", "vietnamese", "japanese", "chinese", "thai", "indian", "korean",
    "pizza", "bbq", "mediterranean", "ethiopian", "southern", "soul_food", "seafood",
    "french", "italian", "gastropub", "vegan", "bakery", "deli",
    "brunch_breakfast", "steakhouse", "chicken_wings", "burgers",
    "ice_cream_dessert", "coffee", "american", "new_american", "caribbean",
    "cuban", "peruvian", "brazilian", "african", "middle_eastern", "turkish",
    "german", "british", "hawaiian", "cajun_creole", "tex_mex", "fusion",
}

VALID_SERVICE_STYLES = {
    "quick_service", "casual_dine_in", "full_service",
    "tasting_menu", "bar_food", "coffee_dessert",
}

# Food-serving venue types we want to classify
FOOD_VENUE_TYPES = {
    "restaurant", "food_hall", "brewery", "bar", "coffee_shop",
    "sports_bar", "nightclub", "lounge", "distillery", "winery",
}


# ─── CUISINE RULES (regex on venue name) ──────────────────────────────────

CUISINE_RULES = [
    (r"\b(taco|taqueria|burrito|mexican|cantina|torta|enchilada)\b", ["mexican"]),
    (r"\b(pho|banh mi|vietnamese)\b", ["vietnamese"]),
    (r"\b(sushi|ramen|izakaya|japanese|hibachi|teriyaki|udon|yakitori)\b", ["japanese"]),
    (r"\b(dim sum|chinese|szechuan|sichuan|wok|dumpling)\b", ["chinese"]),
    (r"\b(thai)\b", ["thai"]),
    (r"\b(indian|curry|tandoori|biryani|masala)\b", ["indian"]),
    (r"\b(korean|bulgogi|bibimbap)\b", ["korean"]),
    (r"\b(pizza|pizzeria|neapolitan)\b", ["pizza"]),
    (r"\b(bbq|barbecue|barbeque|smokehouse)\b", ["bbq"]),
    (r"\b(mediterranean|greek|falafel|shawarma|hummus)\b", ["mediterranean"]),
    (r"\b(ethiopian|injera)\b", ["ethiopian"]),
    (r"\b(southern|lowcountry)\b", ["southern"]),
    (r"\b(soul food|gullah)\b", ["soul_food"]),
    (r"\b(seafood|oyster|crab|fish)\b", ["seafood"]),
    (r"\b(french|bistro|brasserie|creperie)\b", ["french"]),
    (r"\b(italian|trattoria|osteria|pasta)\b", ["italian"]),
    (r"\b(pub|gastropub)\b", ["gastropub"]),
    (r"\b(vegan|plant.based)\b", ["vegan"]),
    (r"\b(bakery|patisserie|bread)\b", ["bakery"]),
    (r"\b(deli|delicatessen|sandwich)\b", ["deli"]),
    (r"\b(brunch|breakfast|waffle|pancake)\b", ["brunch_breakfast"]),
    (r"\b(steakhouse|steak)\b", ["steakhouse"]),
    (r"\b(wings?|chicken)\b", ["chicken_wings"]),
    (r"\b(burger)\b", ["burgers"]),
    (r"\b(ice cream|gelato|frozen)\b", ["ice_cream_dessert"]),
    (r"\b(coffee|cafe|espresso)\b", ["coffee"]),
    (r"\b(caribbean|jamaican|jerk)\b", ["caribbean"]),
    (r"\b(cuban)\b", ["cuban"]),
    (r"\b(peruvian|ceviche)\b", ["peruvian"]),
    (r"\b(brazilian|churrasco)\b", ["brazilian"]),
    (r"\b(cajun|creole|gumbo|po.boy)\b", ["cajun_creole"]),
    (r"\b(hawaiian|poke)\b", ["hawaiian"]),
    (r"\b(turkish|kebab|doner)\b", ["turkish"]),
    (r"\b(middle eastern|lebanese|falafel)\b", ["middle_eastern"]),
]

CUISINE_COMPILED = [(re.compile(p, re.IGNORECASE), tags) for p, tags in CUISINE_RULES]


# ─── SERVICE STYLE RULES (based on venue_type and name) ──────────────────

def infer_service_style(venue: dict) -> Optional[str]:
    """Infer service_style from venue_type and name heuristics."""
    vtype = venue.get("venue_type", "")
    name = (venue.get("name") or "").lower()
    price = venue.get("price_level")

    # Type-based defaults
    if vtype in ("bar", "sports_bar", "nightclub", "lounge", "distillery"):
        return "bar_food"
    if vtype == "coffee_shop":
        return "coffee_dessert"
    if vtype == "food_hall":
        return "casual_dine_in"

    # Name-based signals
    if any(w in name for w in ("fine dining", "tasting menu", "prix fixe", "omakase")):
        return "tasting_menu"
    if price == 4:
        return "full_service"
    if any(w in name for w in ("fast", "express", "drive", "quick")):
        return "quick_service"
    if price == 3:
        return "full_service"

    # Default for restaurants without strong signal
    if vtype == "restaurant":
        return "casual_dine_in"

    return None


# ─── CUISINE CLASSIFICATION (regex) ──────────────────────────────────────

def classify_cuisine_by_name(name: str) -> list[str]:
    """Try to classify cuisine from venue name using regex rules."""
    name_lower = name.lower()
    cuisines = []
    for pattern, tags in CUISINE_COMPILED:
        if pattern.search(name_lower):
            cuisines.extend(tags)
    # Deduplicate while preserving order
    seen = set()
    unique = []
    for c in cuisines:
        if c not in seen:
            seen.add(c)
            unique.append(c)
    return unique


# ─── LLM CLASSIFICATION ─────────────────────────────────────────────────

CLASSIFY_PROMPT = """You are a cuisine and service style classifier for a city nightlife/restaurant guide app.

Given a list of venues, classify each one's cuisine type(s) and service style.

CUISINE TAGS (use 1-3 from this list):
mexican, vietnamese, japanese, chinese, thai, indian, korean, pizza, bbq,
mediterranean, ethiopian, southern, seafood, french, italian, gastropub,
vegan, bakery, deli, brunch_breakfast, steakhouse, chicken_wings, burgers,
ice_cream_dessert, coffee, american, new_american, caribbean, cuban,
peruvian, brazilian, african, middle_eastern, turkish, german, british,
hawaiian, cajun_creole, tex_mex, fusion

SERVICE STYLES (pick exactly one):
quick_service - Fast food, counter service, grab-and-go
casual_dine_in - Sit-down but informal, most standard restaurants
full_service - Upscale with full table service, higher price point
tasting_menu - Prix fixe, omakase, chef's tasting experiences
bar_food - Primarily a bar with food options
coffee_dessert - Coffee shops, bakeries, dessert spots

RULES:
- Use "american" for general American cuisine (burgers, comfort food, varied menus)
- Use "new_american" for modern/creative American cuisine
- Use "fusion" when a venue clearly blends multiple cuisines
- If a venue is primarily a bar, use "bar_food" for service style
- If you cannot determine cuisine from the name/website, respond with "unknown"
- Breweries with food are typically "bar_food" or "casual_dine_in"

For each venue, respond with ONLY:
ID: cuisine1,cuisine2 | service_style

Example:
42: mexican,tex_mex | casual_dine_in
89: japanese | full_service
156: american | bar_food
201: unknown | casual_dine_in
"""


def classify_with_llm(venues: list[dict]) -> dict[int, dict]:
    """Classify a batch of venues using the configured LLM provider.

    Returns dict of {venue_id: {"cuisine": [...], "service_style": "..."}}
    """
    cfg = get_config()
    provider = (cfg.llm.provider or "").strip().lower()
    if provider in ("", "auto"):
        provider = "openai" if cfg.llm.openai_api_key else "anthropic"
    model_override = cfg.llm.openai_model if provider == "openai" else "claude-3-haiku-20240307"

    lines = []
    for v in venues:
        parts = [f"ID:{v['id']} Name:{v['name']}"]
        if v.get("website"):
            parts.append(f"Web:{v['website'][:60]}")
        if v.get("venue_type"):
            parts.append(f"Type:{v['venue_type']}")
        if v.get("price_level"):
            parts.append(f"Price:{v['price_level']}")
        lines.append(" | ".join(parts))

    venue_text = "\n".join(lines)

    response_text = generate_text(
        CLASSIFY_PROMPT,
        venue_text,
        provider_override=provider,
        model_override=model_override,
    )

    results = {}
    for line in response_text.strip().split("\n"):
        line = line.strip()
        if ":" not in line or "|" not in line:
            continue
        try:
            id_part, rest = line.split(":", 1)
            vid = int(id_part.strip())
            cuisine_part, style_part = rest.split("|", 1)

            # Parse cuisine tags
            raw_cuisines = [c.strip().lower() for c in cuisine_part.split(",")]
            cuisines = [c for c in raw_cuisines if c in VALID_CUISINES]

            # Parse service style
            style = style_part.strip().lower()
            if style not in VALID_SERVICE_STYLES:
                style = None

            results[vid] = {
                "cuisine": cuisines if cuisines else None,
                "service_style": style,
            }
        except (ValueError, IndexError):
            continue

    return results


# ─── MAIN ────────────────────────────────────────────────────────────────

def run_classification(
    dry_run: bool = False,
    use_llm: bool = True,
    limit: Optional[int] = None,
    venue_type: Optional[str] = None,
):
    client = get_client()

    # Fetch active food/drink venues missing cuisine
    query = (
        client.table("venues")
        .select("id, name, slug, venue_type, website, price_level, service_style")
        .eq("active", True)
        .is_("cuisine", "null")
    )

    if venue_type:
        query = query.eq("venue_type", venue_type)
    else:
        query = query.in_("venue_type", list(FOOD_VENUE_TYPES))

    result = query.order("name").limit(5000).execute()
    venues = result.data or []

    if limit:
        venues = venues[:limit]

    logger.info("=" * 60)
    logger.info("Cuisine & Service Style Classification")
    logger.info("=" * 60)
    logger.info(f"Found {len(venues)} venues to classify")
    if dry_run:
        logger.info("DRY RUN — no database writes")
    logger.info("")

    stats = {
        "rule_cuisine": 0,
        "llm_cuisine": 0,
        "service_style_set": 0,
        "no_cuisine": 0,
    }

    needs_llm = []

    # ── Step 1: Rule-based cuisine classification ──
    logger.info("STEP 1: Rule-based cuisine classification")
    logger.info("-" * 40)

    for v in venues:
        cuisines = classify_cuisine_by_name(v["name"])
        service_style = infer_service_style(v)

        if cuisines:
            logger.info(f"  CLASSIFY [{v['id']}] {v['name'][:50]} → {', '.join(cuisines)}"
                        f"{f' | {service_style}' if service_style else ''}")

            if not dry_run:
                updates = {"cuisine": cuisines}
                if service_style and not v.get("service_style"):
                    updates["service_style"] = service_style
                client.table("venues").update(updates).eq("id", v["id"]).execute()

            stats["rule_cuisine"] += 1
            if service_style and not v.get("service_style"):
                stats["service_style_set"] += 1
        else:
            # Still set service_style if we can infer it
            if service_style and not v.get("service_style"):
                if not dry_run:
                    client.table("venues").update(
                        {"service_style": service_style}
                    ).eq("id", v["id"]).execute()
                stats["service_style_set"] += 1
                logger.info(f"  STYLE  [{v['id']}] {v['name'][:50]} → {service_style}")

            needs_llm.append(v)

    logger.info(f"\n  Rule-classified: {stats['rule_cuisine']}")
    logger.info(f"  Service styles set: {stats['service_style_set']}")
    logger.info(f"  Needs LLM: {len(needs_llm)}")

    # ── Step 2: LLM classification for unmatched venues ──
    if use_llm and needs_llm:
        logger.info(f"\n{'=' * 60}")
        logger.info("STEP 2: LLM classification")
        logger.info("=" * 60)

        batch_size = 30
        for i in range(0, len(needs_llm), batch_size):
            batch = needs_llm[i:i + batch_size]
            logger.info(f"\n  Batch {i // batch_size + 1} ({len(batch)} venues)...")

            try:
                results = classify_with_llm(batch)

                for v in batch:
                    vid = v["id"]
                    if vid not in results:
                        logger.info(f"    SKIP [{vid}] {v['name'][:50]} — no LLM result")
                        stats["no_cuisine"] += 1
                        continue

                    r = results[vid]
                    cuisines = r.get("cuisine")
                    style = r.get("service_style")

                    if cuisines:
                        label = f"{', '.join(cuisines)}"
                        if style:
                            label += f" | {style}"
                        logger.info(f"    CLASSIFY [{vid}] {v['name'][:50]} → {label}")

                        if not dry_run:
                            updates = {"cuisine": cuisines}
                            if style and not v.get("service_style"):
                                updates["service_style"] = style
                            client.table("venues").update(updates).eq("id", vid).execute()

                        stats["llm_cuisine"] += 1
                        if style and not v.get("service_style"):
                            stats["service_style_set"] += 1
                    else:
                        # LLM returned unknown — still set service style
                        if style and not v.get("service_style"):
                            if not dry_run:
                                client.table("venues").update(
                                    {"service_style": style}
                                ).eq("id", vid).execute()
                            stats["service_style_set"] += 1

                        logger.info(f"    UNKNOWN [{vid}] {v['name'][:50]}"
                                    f"{f' | style={style}' if style else ''}")
                        stats["no_cuisine"] += 1

            except Exception as e:
                logger.error(f"    LLM error: {e}")

            time.sleep(1)  # Rate limit between batches

    # ── Summary ──
    logger.info(f"\n{'=' * 60}")
    logger.info("SUMMARY")
    logger.info("=" * 60)
    logger.info(f"Rule-classified cuisine:  {stats['rule_cuisine']}")
    logger.info(f"LLM-classified cuisine:   {stats['llm_cuisine']}")
    logger.info(f"Service styles set:       {stats['service_style_set']}")
    logger.info(f"No cuisine determined:    {stats['no_cuisine']}")
    total = stats["rule_cuisine"] + stats["llm_cuisine"]
    logger.info(f"Total cuisine classified: {total}")

    return stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Classify venue cuisine types and service styles"
    )
    parser.add_argument("--dry-run", action="store_true", help="Don't update database")
    parser.add_argument("--no-llm", action="store_true", help="Skip LLM classification")
    parser.add_argument("--limit", type=int, help="Max venues to process")
    parser.add_argument("--venue-type", type=str, help="Filter by venue type")

    args = parser.parse_args()
    run_classification(
        dry_run=args.dry_run,
        use_llm=not args.no_llm,
        limit=args.limit,
        venue_type=args.venue_type,
    )
