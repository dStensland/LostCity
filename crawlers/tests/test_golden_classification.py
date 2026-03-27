"""Golden test set for classification accuracy benchmarking.

This file validates the golden_classification_set.json against the new 19-category taxonomy.
It does NOT run the classifier itself — it validates the shape and coverage of the benchmark
dataset so that when the classifier is wired in, we have a ready-made accuracy harness.
"""
import json
import os
import pytest

GOLDEN_SET_PATH = os.path.join(os.path.dirname(__file__), "golden_classification_set.json")

NEW_CATEGORIES = {
    "music", "film", "comedy", "theater", "art", "dance",
    "sports", "fitness", "outdoors", "games",
    "food_drink", "conventions",
    "workshops", "education", "words",
    "volunteer", "civic", "support", "religious",
}

VALID_AUDIENCES = {"general", "toddler", "preschool", "kids", "teen", "18+", "21+"}

# Categories that should be suppressed from the default feed
SUPPRESSED_CATEGORIES = {"support"}


def load_golden_set():
    with open(GOLDEN_SET_PATH) as f:
        return json.load(f)


@pytest.fixture
def golden_set():
    return load_golden_set()


# ── Coverage checks ─────────────────────────────────────────────────────────


def test_golden_set_has_minimum_coverage(golden_set):
    assert len(golden_set) >= 200, f"Golden set too small: {len(golden_set)}"


def test_golden_set_covers_all_new_categories(golden_set):
    """Every new category must have at least 5 golden examples."""
    cat_counts = {}
    for event in golden_set:
        cat = event["expected_category"]
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
    for cat in NEW_CATEGORIES:
        count = cat_counts.get(cat, 0)
        assert count >= 5, (
            f"Category '{cat}' only has {count} golden events (need >= 5)"
        )


def test_golden_set_has_dissolved_category_examples(golden_set):
    """The golden set must include examples from dissolved categories to verify reclassification."""
    dissolved = {"nightlife", "community", "family", "wellness", "recreation", "exercise", "learning", "support_group", "other"}
    old_cats = {e.get("old_category") for e in golden_set}
    covered = dissolved & old_cats
    assert len(covered) >= 6, (
        f"Golden set only covers {len(covered)} dissolved categories: {covered}. "
        f"Need examples from: {dissolved - covered}"
    )


# ── Schema checks ────────────────────────────────────────────────────────────


def test_golden_set_schema(golden_set):
    required = {"event_id", "title", "expected_category", "expected_audience"}
    for i, event in enumerate(golden_set):
        for field in required:
            assert field in event, f"Event at index {i} (id={event.get('event_id')}) missing field: {field}"


def test_golden_set_categories_are_valid(golden_set):
    for event in golden_set:
        assert event["expected_category"] in NEW_CATEGORIES, (
            f"Invalid category '{event['expected_category']}' for event {event['event_id']} "
            f"('{event['title']}')"
        )


def test_golden_set_audiences_are_valid(golden_set):
    for event in golden_set:
        assert event["expected_audience"] in VALID_AUDIENCES, (
            f"Invalid audience '{event['expected_audience']}' for event {event['event_id']} "
            f"('{event['title']}')"
        )


def test_no_duplicate_event_ids(golden_set):
    ids = [e["event_id"] for e in golden_set]
    seen = set()
    dupes = []
    for event_id in ids:
        if event_id in seen:
            dupes.append(event_id)
        seen.add(event_id)
    assert not dupes, f"Duplicate event IDs in golden set: {dupes}"


# ── Taxonomy rule checks ─────────────────────────────────────────────────────


def test_paint_and_sip_is_workshops_not_art(golden_set):
    """Paint-and-sip events (Painting With a Twist etc.) must be workshops, not art."""
    painting_twist = [
        e for e in golden_set
        if "painting with a twist" in (e.get("venue_name") or "").lower()
    ]
    assert len(painting_twist) >= 3, "Need at least 3 Painting With a Twist events in golden set"
    for e in painting_twist:
        assert e["expected_category"] == "workshops", (
            f"Painting With a Twist event '{e['title']}' classified as '{e['expected_category']}' "
            f"— must be 'workshops' (paint-and-sip rule)"
        )


def test_trivia_at_bar_is_games_not_nightlife(golden_set):
    """Trivia events are games regardless of venue type."""
    trivia_events = [
        e for e in golden_set
        if "trivia" in e.get("title", "").lower() or "trivia" in e.get("expected_genres", [])
    ]
    assert len(trivia_events) >= 5, "Need at least 5 trivia events in golden set"
    for e in trivia_events:
        assert e["expected_category"] == "games", (
            f"Trivia event '{e['title']}' at '{e['venue_name']}' classified as "
            f"'{e['expected_category']}' — must be 'games'"
        )


def test_drag_show_is_theater_not_nightlife(golden_set):
    """Drag shows and burlesque are theater (performance), not nightlife."""
    drag_events = [
        e for e in golden_set
        if "drag" in e.get("expected_genres", []) or "burlesque" in e.get("expected_genres", [])
    ]
    assert len(drag_events) >= 2, "Need at least 2 drag/burlesque events in golden set"
    for e in drag_events:
        assert e["expected_category"] == "theater", (
            f"Drag/burlesque event '{e['title']}' classified as '{e['expected_category']}' "
            f"— must be 'theater'"
        )


def test_zumba_is_fitness_not_dance(golden_set):
    """Zumba has exercise intent → fitness, not dance."""
    zumba_events = [
        e for e in golden_set
        if "zumba" in e.get("title", "").lower()
    ]
    assert len(zumba_events) >= 1, "Need at least 1 Zumba event in golden set"
    for e in zumba_events:
        assert e["expected_category"] == "fitness", (
            f"Zumba event '{e['title']}' classified as '{e['expected_category']}' "
            f"— must be 'fitness' (exercise intent)"
        )


def test_social_dance_is_dance_not_fitness(golden_set):
    """Social dance nights (salsa, lindy hop, bachata) → dance, not fitness."""
    social_dance = [
        e for e in golden_set
        if any(g in e.get("expected_genres", []) for g in ["salsa", "swing", "latin"])
        and e.get("expected_category") in {"dance", "fitness"}
    ]
    assert len(social_dance) >= 3, "Need at least 3 social dance events in golden set"
    for e in social_dance:
        assert e["expected_category"] == "dance", (
            f"Social dance event '{e['title']}' classified as '{e['expected_category']}' "
            f"— must be 'dance' (fun intent, not exercise)"
        )


def test_support_groups_are_support_not_wellness(golden_set):
    """Recovery meetings and support groups → support, not wellness."""
    support_events = [
        e for e in golden_set
        if e.get("old_category") in ("support_group", "wellness")
        and "recovery" in e.get("expected_genres", [])
    ]
    assert len(support_events) >= 5, "Need at least 5 recovery/support events in golden set"
    for e in support_events:
        assert e["expected_category"] == "support", (
            f"Recovery/support event '{e['title']}' classified as '{e['expected_category']}' "
            f"— must be 'support'"
        )


def test_watching_ballet_is_theater_not_dance(golden_set):
    """Atlanta Ballet performances (watching) → theater, not dance."""
    ballet_watching = [
        e for e in golden_set
        if "atlanta ballet" in e.get("title", "").lower()
        or (
            "ballet" in e.get("expected_genres", [])
            and e.get("venue_type") in ("theater", "arena", "venue")
            and e.get("expected_category") in ("theater", "dance")
        )
    ]
    assert len(ballet_watching) >= 2, "Need at least 2 ballet-watching events in golden set"
    for e in ballet_watching:
        assert e["expected_category"] == "theater", (
            f"Ballet performance '{e['title']}' classified as '{e['expected_category']}' "
            f"— watching a performance is 'theater', not 'dance'"
        )


def test_dance_classes_are_workshops_not_dance(golden_set):
    """Structured dance classes (taking a class) → workshops."""
    dance_classes = [
        e for e in golden_set
        if e.get("old_category") == "dance"
        and e.get("venue_type") == "fitness_center"
    ]
    assert len(dance_classes) >= 3, "Need at least 3 dance-class examples from fitness_center venues"
    for e in dance_classes:
        assert e["expected_category"] == "workshops", (
            f"Dance class '{e['title']}' at fitness_center classified as '{e['expected_category']}' "
            f"— structured dance instruction is 'workshops'"
        )


def test_gaming_conventions_are_conventions_not_games(golden_set):
    """DreamHack, Southern-Fried Gaming Expo → conventions (attend), not games (play)."""
    gaming_cons = [
        e for e in golden_set
        if e.get("old_category") == "gaming"
        and e.get("venue_type") in ("convention_center", "hotel")
    ]
    assert len(gaming_cons) >= 2, "Need at least 2 gaming conventions in golden set"
    for e in gaming_cons:
        assert e["expected_category"] == "conventions", (
            f"Gaming convention '{e['title']}' classified as '{e['expected_category']}' "
            f"— large gaming expos are 'conventions'"
        )


def test_storytime_is_words_not_family(golden_set):
    """Storytime events → words category (family dissolved)."""
    storytime = [
        e for e in golden_set
        if "storytime" in e.get("title", "").lower()
        or "storytime" in e.get("expected_genres", [])
    ]
    assert len(storytime) >= 3, "Need at least 3 storytime events in golden set"
    for e in storytime:
        assert e["expected_category"] == "words", (
            f"Storytime '{e['title']}' classified as '{e['expected_category']}' "
            f"— must be 'words' (family dissolved)"
        )


def test_open_mic_comedy_is_comedy_not_music(golden_set):
    """Comedy open mics → comedy. Music open mics → music. Check that comedy open mics are right."""
    comedy_open_mic = [
        e for e in golden_set
        if "open mic" in e.get("title", "").lower()
        and "comedy" in e.get("title", "").lower()
    ]
    assert len(comedy_open_mic) >= 1, "Need at least 1 comedy open mic in golden set"
    for e in comedy_open_mic:
        assert e["expected_category"] == "comedy", (
            f"Comedy open mic '{e['title']}' classified as '{e['expected_category']}' "
            f"— must be 'comedy'"
        )


def test_suppressed_categories_present(golden_set):
    """Support category must be present (and will be suppressed from default feed)."""
    suppressed_events = [e for e in golden_set if e["expected_category"] in SUPPRESSED_CATEGORIES]
    assert len(suppressed_events) >= 5, (
        f"Need at least 5 events in suppressed categories {SUPPRESSED_CATEGORIES}, "
        f"got {len(suppressed_events)}"
    )


def test_audience_tags_for_kids_events(golden_set):
    """Events explicitly for kids should have a non-general audience tag."""
    kids_title_patterns = ["storytime", "kids", "ages 5", "ages 6", "ages 7", "ages 8"]
    kids_events = [
        e for e in golden_set
        if any(p in e.get("title", "").lower() for p in kids_title_patterns)
    ]
    assert len(kids_events) >= 5, "Need at least 5 explicitly kid-targeted events in golden set"
    non_general = [e for e in kids_events if e["expected_audience"] != "general"]
    assert len(non_general) >= 3, (
        f"Only {len(non_general)} kid-targeted events have non-general audience tags. "
        "Kid-specific events should have toddler/preschool/kids tags."
    )
