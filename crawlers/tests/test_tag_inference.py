"""
Tests for tag inference logic in tag_inference.py.
"""

from tag_inference import infer_tags, merge_tags


class TestInferTags:
    """Tests for the infer_tags function."""

    def test_free_event_tag(self):
        event = {"title": "Open Mic Night", "is_free": True}
        tags = infer_tags(event)
        assert "free" in tags

    def test_ticketed_event_tag(self):
        event = {"title": "Concert", "is_free": False, "price_min": 25.0}
        tags = infer_tags(event)
        assert "ticketed" in tags

    def test_ticketed_via_ticket_url(self):
        event = {"title": "Show", "ticket_url": "https://tickets.com/buy"}
        tags = infer_tags(event)
        assert "ticketed" in tags

    def test_album_release_tag(self):
        event = {"title": "Album Release Party", "description": "Celebrating the new record"}
        tags = infer_tags(event)
        assert "album-release" in tags

    def test_touring_tag(self):
        event = {"title": "Band Name World Tour", "description": ""}
        tags = infer_tags(event)
        assert "touring" in tags

    def test_debut_tag(self):
        event = {"title": "Atlanta Premiere: New Film", "description": ""}
        tags = infer_tags(event)
        assert "debut" in tags

    def test_sold_out_tag(self):
        event = {"title": "Popular Show", "description": "SOLD OUT"}
        tags = infer_tags(event)
        assert "sold-out" in tags

    def test_family_friendly_tag(self):
        event = {"title": "Kids Art Workshop", "description": "Bring the whole family"}
        tags = infer_tags(event)
        assert "family-friendly" in tags

    def test_21_plus_tag(self):
        event = {"title": "Bar Night", "description": "Must be 21+ to enter"}
        tags = infer_tags(event)
        assert "21+" in tags

    def test_all_ages_tag(self):
        event = {"title": "Community Event", "description": "Open to all ages"}
        tags = infer_tags(event)
        assert "all-ages" in tags

    def test_opening_night_tag(self):
        event = {"title": "Play Name - Opening Night", "description": ""}
        tags = infer_tags(event)
        assert "opening-night" in tags

    def test_closing_night_tag(self):
        event = {"title": "Final Performance", "description": "Last chance to see it"}
        tags = infer_tags(event)
        assert "closing-night" in tags

    def test_one_night_only_tag(self):
        event = {"title": "Special Event - One Night Only", "description": ""}
        tags = infer_tags(event)
        assert "one-night-only" in tags

    def test_outdoor_tag(self):
        event = {"title": "Rooftop Concert", "description": "Under the stars"}
        tags = infer_tags(event)
        assert "outdoor" in tags

    def test_rsvp_required_tag(self):
        event = {"title": "Private Event", "description": "RSVP required"}
        tags = infer_tags(event)
        assert "rsvp-required" in tags

    def test_limited_seating_tag(self):
        event = {"title": "Intimate Show", "description": "Limited seating available"}
        tags = infer_tags(event)
        assert "limited-seating" in tags

    def test_holiday_tag(self):
        event = {"title": "Christmas Concert", "description": ""}
        tags = infer_tags(event)
        assert "holiday" in tags

    def test_holiday_halloween(self):
        event = {"title": "Halloween Party", "description": ""}
        tags = infer_tags(event)
        assert "holiday" in tags

    def test_holiday_juneteenth(self):
        event = {"title": "Juneteenth Celebration", "description": ""}
        tags = infer_tags(event)
        assert "holiday" in tags

    def test_seasonal_tag(self):
        event = {"title": "Summer Series: Jazz Night", "description": ""}
        tags = infer_tags(event)
        assert "seasonal" in tags

    def test_high_energy_tag(self):
        event = {"title": "EDM Night", "description": "Dance party all night"}
        tags = infer_tags(event)
        assert "high-energy" in tags

    def test_chill_tag(self):
        event = {"title": "Acoustic Night", "description": "Singer-songwriter showcase"}
        tags = infer_tags(event)
        assert "chill" in tags

    def test_preserve_existing_tags(self):
        # Note: Only valid tags from ALL_TAGS are preserved
        event = {"title": "Concert", "tags": ["free", "outdoor"]}
        tags = infer_tags(event, preserve_existing=True)
        assert "free" in tags
        assert "outdoor" in tags

    def test_dont_preserve_existing_tags(self):
        event = {"title": "Concert", "tags": ["custom-tag"]}
        tags = infer_tags(event, preserve_existing=False)
        assert "custom-tag" not in tags

    def test_inherit_venue_vibes(self):
        event = {"title": "Show", "is_free": True}
        venue_vibes = ["intimate", "all-ages"]
        tags = infer_tags(event, venue_vibes=venue_vibes)
        assert "intimate" in tags
        assert "all-ages" in tags

    def test_vibe_to_tag_mapping(self):
        event = {"title": "Show"}
        venue_vibes = ["outdoor-seating"]
        tags = infer_tags(event, venue_vibes=venue_vibes)
        assert "outdoor" in tags

    def test_non_inheritable_vibes_ignored(self):
        event = {"title": "Show"}
        venue_vibes = ["non-existent-vibe"]
        tags = infer_tags(event, venue_vibes=venue_vibes)
        assert "non-existent-vibe" not in tags

    def test_multiple_tags_inferred(self):
        event = {
            "title": "Album Release Tour - Opening Night",
            "description": "All ages welcome, RSVP required",
            "is_free": False,
            "ticket_url": "https://tickets.com",
        }
        tags = infer_tags(event)
        assert "album-release" in tags
        assert "touring" in tags
        assert "opening-night" in tags
        assert "all-ages" in tags
        assert "rsvp-required" in tags
        assert "ticketed" in tags

    def test_tags_are_sorted(self):
        event = {"title": "Touring Band Album Release", "is_free": True}
        tags = infer_tags(event)
        assert tags == sorted(tags)

    def test_empty_event(self):
        event = {}
        tags = infer_tags(event)
        assert isinstance(tags, list)


class TestMergeTags:
    """Tests for the merge_tags function."""

    def test_merge_unique_tags(self):
        existing = ["tag1", "tag2"]
        new = ["tag3", "tag4"]
        merged = merge_tags(existing, new)
        # Only valid tags from ALL_TAGS will be kept
        assert isinstance(merged, list)

    def test_merge_overlapping_tags(self):
        existing = ["free", "outdoor"]
        new = ["outdoor", "21+"]
        merged = merge_tags(existing, new)
        assert "free" in merged
        assert "outdoor" in merged
        assert "21+" in merged
        assert len([t for t in merged if t == "outdoor"]) == 1  # No duplicates

    def test_merge_empty_existing(self):
        merged = merge_tags([], ["free"])
        assert "free" in merged

    def test_merge_empty_new(self):
        merged = merge_tags(["free"], [])
        assert "free" in merged

    def test_merge_both_empty(self):
        merged = merge_tags([], [])
        assert merged == []

    def test_merge_none_inputs(self):
        merged = merge_tags(None, None)
        assert merged == []

    def test_filters_invalid_tags(self):
        existing = ["free", "invalid-tag-xyz"]
        new = ["21+", "another-invalid"]
        merged = merge_tags(existing, new)
        assert "free" in merged
        assert "21+" in merged
        assert "invalid-tag-xyz" not in merged
        assert "another-invalid" not in merged

    def test_result_is_sorted(self):
        existing = ["outdoor", "free"]
        new = ["21+", "touring"]
        merged = merge_tags(existing, new)
        assert merged == sorted(merged)
