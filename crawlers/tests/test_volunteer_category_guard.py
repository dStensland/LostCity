"""
Tests for the volunteer category guard in the event insert pipeline.

Volunteer events (subcategory="volunteer" or "volunteer" in tags) must always
be categorized as "community". They must never be reclassified to "food_drink"
or any other category by venue-type inference or the smart-update category
promotion logic.
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from db.events import _is_volunteer_event


# ---------------------------------------------------------------------------
# _is_volunteer_event
# ---------------------------------------------------------------------------


class TestIsVolunteerEvent:
    def test_subcategory_volunteer_detected(self):
        event = {"subcategory": "volunteer", "tags": []}
        assert _is_volunteer_event(event) is True

    def test_subcategory_volunteer_case_insensitive(self):
        event = {"subcategory": "Volunteer", "tags": []}
        assert _is_volunteer_event(event) is True

    def test_volunteer_tag_detected(self):
        event = {"subcategory": None, "tags": ["volunteer", "drop-in"]}
        assert _is_volunteer_event(event) is True

    def test_volunteer_tag_among_many(self):
        event = {
            "subcategory": "farmers_market",
            "tags": ["volunteer", "food-security", "drop-in"],
        }
        assert _is_volunteer_event(event) is True

    def test_non_volunteer_event_not_detected(self):
        event = {"subcategory": "farmers_market", "tags": ["farmers-market", "organic"]}
        assert _is_volunteer_event(event) is False

    def test_no_subcategory_no_tags(self):
        event = {"title": "Freedom Farmers Market"}
        assert _is_volunteer_event(event) is False

    def test_empty_tags_and_empty_subcategory(self):
        event = {"subcategory": "", "tags": []}
        assert _is_volunteer_event(event) is False

    def test_volunteer_tag_uppercase(self):
        event = {"subcategory": None, "tags": ["VOLUNTEER"]}
        assert _is_volunteer_event(event) is True

    def test_volunteer_tag_with_whitespace(self):
        event = {"subcategory": None, "tags": [" volunteer "]}
        assert _is_volunteer_event(event) is True


# ---------------------------------------------------------------------------
# smart_update_existing_event — category promotion guard
#
# We test the category logic in isolation by simulating the dict state that
# smart_update_existing_event operates on, without touching the DB.
# ---------------------------------------------------------------------------


def _simulate_category_update(existing: dict, incoming: dict) -> dict:
    """
    Replicate the category-update block from smart_update_existing_event so we
    can unit-test it without a real Supabase client.

    Returns the updates dict that would be applied to the DB row.
    """
    from tags import VALID_CATEGORIES

    updates: dict = {}
    existing_category = str(existing.get("category_id") or "").strip().lower()
    incoming_category = str(
        incoming.get("category_id") or incoming.get("category") or ""
    ).strip().lower()

    if incoming_category in VALID_CATEGORIES:
        if not existing_category:
            updates["category_id"] = incoming_category
        elif (
            incoming_category != existing_category
            and existing_category in {"community", "other"}
            and incoming_category not in {"community", "other"}
        ):
            existing_subcategory = str(
                existing.get("subcategory") or existing.get("subcategory_id") or ""
            ).strip().lower()
            existing_tags = existing.get("tags") or []
            existing_is_volunteer = (
                existing_subcategory == "volunteer"
                or "volunteer" in {str(t).strip().lower() for t in existing_tags}
            )
            if not existing_is_volunteer:
                updates["category_id"] = incoming_category

    return updates


class TestSmartUpdateCategoryGuard:
    """Verify that volunteer events are never category-overridden."""

    def test_volunteer_subcategory_blocks_food_drink_override(self):
        existing = {
            "id": 1,
            "category_id": "community",
            "subcategory": "volunteer",
            "tags": ["volunteer", "drop-in"],
        }
        incoming = {"category": "food_drink", "source_id": 2}
        updates = _simulate_category_update(existing, incoming)
        assert "category_id" not in updates, (
            "Volunteer event category must not be overridden to food_drink"
        )

    def test_volunteer_tag_blocks_food_drink_override(self):
        existing = {
            "id": 2,
            "category_id": "community",
            "subcategory": None,
            "tags": ["volunteer", "food-security"],
        }
        incoming = {"category": "food_drink"}
        updates = _simulate_category_update(existing, incoming)
        assert "category_id" not in updates

    def test_volunteer_blocks_other_overrides(self):
        """Volunteer guard should block overrides to any non-community category."""
        for override_cat in ("music", "nightlife", "art", "learning"):
            existing = {
                "id": 3,
                "category_id": "community",
                "subcategory": "volunteer",
                "tags": ["volunteer"],
            }
            incoming = {"category": override_cat}
            updates = _simulate_category_update(existing, incoming)
            assert "category_id" not in updates, (
                f"Volunteer event must not be overridden to {override_cat}"
            )

    def test_non_volunteer_community_event_can_be_upgraded(self):
        """Non-volunteer community events should still be upgradeable (existing behaviour)."""
        existing = {
            "id": 4,
            "category_id": "community",
            "subcategory": "meetup",
            "tags": ["networking"],
        }
        incoming = {"category": "music"}
        updates = _simulate_category_update(existing, incoming)
        assert updates.get("category_id") == "music", (
            "Non-volunteer community events should still be category-upgradeable"
        )

    def test_blank_existing_category_filled_from_incoming(self):
        """If existing category is empty, incoming is always used regardless of volunteer status."""
        existing = {
            "id": 5,
            "category_id": "",
            "subcategory": "volunteer",
            "tags": ["volunteer"],
        }
        incoming = {"category": "food_drink"}
        updates = _simulate_category_update(existing, incoming)
        # When there's no existing category, any valid incoming category wins.
        assert updates.get("category_id") == "food_drink"

    def test_volunteer_same_category_no_update(self):
        """If incoming and existing are both community, no update is emitted."""
        existing = {
            "id": 6,
            "category_id": "community",
            "subcategory": "volunteer",
            "tags": ["volunteer"],
        }
        incoming = {"category": "community"}
        updates = _simulate_category_update(existing, incoming)
        assert "category_id" not in updates
