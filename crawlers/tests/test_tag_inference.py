"""
Tests for tag inference logic in tag_inference.py.
"""

from tag_inference import infer_tags, infer_genres, merge_tags, infer_is_religious


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
        event = {
            "title": "Album Release Party",
            "description": "Celebrating the new record",
        }
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


class TestInferGenres:
    """Tests for community genre inference edge cases."""

    def test_community_activism_with_specific_terms(self):
        event = {
            "title": "Community Phone Bank",
            "description": "Join our civic engagement canvass kickoff.",
            "category": "community",
        }
        genres = infer_genres(event)
        assert "activism" in genres

    def test_community_activism_not_triggered_by_generic_civic(self):
        event = {
            "title": "Neighborhood Civic Association Monthly Meeting",
            "description": "General updates and announcements.",
            "category": "community",
        }
        genres = infer_genres(event)
        assert "activism" not in genres

    def test_infer_genres_from_tags_for_sparse_music_payload(self):
        event = {
            "title": "Thu 19",
            "description": "",
            "category": "music",
            "tags": ["live-music", "jazz", "ticketed"],
        }
        genres = infer_genres(event)
        assert "jazz" in genres

    def test_infer_genres_from_tags_scoped_to_category(self):
        event = {
            "title": "Community meetup",
            "description": "",
            "category": "community",
            "tags": ["classic", "activism"],
        }
        genres = infer_genres(event)
        assert "activism" in genres
        assert "classic" not in genres

    def test_infer_fitness_running_tag_to_run_genre(self):
        event = {
            "title": "Morning meetup",
            "description": "",
            "category": "fitness",
            "tags": ["running", "outdoor"],
        }
        genres = infer_genres(event)
        assert "run" in genres

    def test_vibe_fallback_uses_canonical_genre(self):
        event = {
            "title": "Untitled event",
            "description": "",
            "category": "art",
        }
        genres = infer_genres(event, venue_vibes=["paint-and-sip"])
        assert "craft" in genres

    def test_infer_music_dj_title_as_electronic(self):
        event = {
            "title": "DJ RudeDawg",
            "description": "",
            "category": "music",
        }
        genres = infer_genres(event)
        assert "electronic" in genres

    def test_infer_fitness_5k_as_run(self):
        """Legacy fitness category still infers run genre (backward compat)."""
        event = {
            "title": "Neighborhood 5K Run/Walk",
            "description": "",
            "category": "fitness",
        }
        genres = infer_genres(event)
        assert "run" in genres

    def test_infer_exercise_5k_as_run(self):
        """New exercise category also infers run genre."""
        event = {
            "title": "Neighborhood 5K Run/Walk",
            "description": "",
            "category": "exercise",
        }
        genres = infer_genres(event)
        assert "run" in genres

    def test_infer_recreation_pickup_as_pickup_genre(self):
        """Recreation category with pickup title infers pickup genre."""
        event = {
            "title": "Friday Pickup Basketball at the Rec Center",
            "description": "",
            "category": "recreation",
        }
        genres = infer_genres(event)
        assert "pickup" in genres

    def test_exercise_and_fitness_both_infer_yoga(self):
        """Both exercise and fitness categories map yoga title to yoga genre."""
        for cat in ("exercise", "fitness"):
            event = {
                "title": "Sunrise Yoga Flow",
                "description": "",
                "category": cat,
            }
            genres = infer_genres(event)
            assert "yoga" in genres, f"Expected yoga genre for category={cat}"


class TestInferIsReligious:
    """Tests for infer_is_religious — catches worship services miscategorized as music."""

    def test_worship_at_church_reclassified_from_music(self):
        event = {"title": "Sunday Worship", "category": "music"}
        assert infer_is_religious(event, venue_type="church") is True

    def test_worship_at_music_venue_stays_music(self):
        """Gospel brunch at City Winery should NOT be reclassified."""
        event = {"title": "Gospel Brunch Ft. William Murphy", "category": "music"}
        assert infer_is_religious(event, venue_type="music_venue") is False

    def test_easter_worship_at_church_reclassified(self):
        event = {"title": "Easter Day Festival Worship", "category": "music"}
        assert infer_is_religious(event, venue_type="church") is True

    def test_concert_at_church_stays_music(self):
        """Secular override: 'concert' keyword protects music category."""
        event = {"title": "Holiday Concert", "category": "music"}
        assert infer_is_religious(event, venue_type="church") is False

    def test_community_worship_still_reclassified(self):
        """Original behavior: community→religious still works."""
        event = {"title": "Weekly Worship Service", "category": "community"}
        assert infer_is_religious(event, venue_type="church") is True

    def test_prayer_at_church_reclassified_from_music(self):
        event = {"title": "Prayer Meeting", "category": "music"}
        assert infer_is_religious(event, venue_type="church") is True

    def test_worship_at_non_church_venue_short_title_reclassified(self):
        """'Sunday Worship' at a gallery (community space) is still a service."""
        event = {"title": "Sunday Worship", "category": "music"}
        assert infer_is_religious(event, venue_type="gallery") is True

    def test_gospel_brunch_with_performer_at_music_venue_stays(self):
        """Named performer gospel event at music venue should stay music."""
        event = {
            "title": "Urban Worship Collective: Sunday Evening Gospel Brunch Ft. William Murphy",
            "category": "music",
        }
        assert infer_is_religious(event, venue_type="music_venue") is False

    def test_prayer_walk_at_park_not_reclassified(self):
        """Keyword in description only at a park venue — should NOT trigger."""
        event = {
            "title": "Sunrise Walk at Stone Mountain",
            "description": "Join us for a prayer walk through the historic trails.",
            "category": "community",
        }
        assert infer_is_religious(event, venue_type="park") is False

    def test_prayer_walk_at_church_still_reclassified(self):
        """Keyword in title at a church venue — should trigger."""
        event = {
            "title": "Prayer Meeting",
            "description": "Weekly gathering for the congregation.",
            "category": "community",
        }
        assert infer_is_religious(event, venue_type="church") is True

    def test_prayer_walk_in_title_at_park_reclassified(self):
        """Keyword in TITLE at a park venue — should still trigger."""
        event = {
            "title": "Community Prayer Walk",
            "description": "Meet at the trailhead for a group walk.",
            "category": "community",
        }
        assert infer_is_religious(event, venue_type="park") is True

    def test_no_venue_type_uses_full_text(self):
        """No venue_type — backward compat, keyword in description triggers."""
        event = {
            "title": "Morning Gathering",
            "description": "A prayer meeting for the whole community.",
            "category": "community",
        }
        assert infer_is_religious(event, venue_type=None) is True

    def test_art_category_not_touched(self):
        event = {"title": "Sunday Worship Art Show", "category": "art"}
        assert infer_is_religious(event, venue_type="church") is False


class TestDateNightInference:
    """Tests for date-night tag inference scoping."""

    def test_date_night_not_inferred_from_description(self):
        """Park event with 'wine' only in description should NOT get date-night."""
        event = {"title": "Summer Festival in the Park", "description": "Enjoy wine and cheese from local vendors"}
        tags = infer_tags(event, preserve_existing=False)
        assert "date-night" not in tags

    def test_date_night_inferred_from_title(self):
        """Event with jazz in title SHOULD get date-night."""
        event = {"title": "Jazz Night at the Lounge", "description": ""}
        tags = infer_tags(event, preserve_existing=False)
        assert "date-night" in tags


class TestAgeTagConflictResolution:
    """Tests for age tag conflict resolution."""

    def test_all_ages_removes_21_plus(self):
        """Event with both all-ages and 21+ signals should keep only all-ages."""
        event = {"title": "All Ages Show", "description": "", "tags": ["21+"]}
        tags = infer_tags(event, preserve_existing=True)
        assert "all-ages" in tags
        assert "21+" not in tags
