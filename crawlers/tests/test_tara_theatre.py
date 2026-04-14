from sources import tara_theatre as source_module


def test_build_movie_detail_url_uses_graphql_slug():
    assert (
        source_module._build_movie_detail_url({"urlSlug": "my-fathers-shadow-2026"})
        == "https://www.taraatlanta.com/movie/my-fathers-shadow-2026/"
    )


def test_extract_movies_from_graphql_showings_uses_movie_detail_url():
    entries = source_module._extract_movies_from_graphql_showings(
        [
            {
                "published": True,
                "private": False,
                "time": "2026-04-08T20:00:00Z",
                "movie": {
                    "name": "My Father's Shadow (2026)",
                    "urlSlug": "my-fathers-shadow-2026",
                    "synopsis": "Two young brothers explore Lagos.",
                },
            }
        ],
        source_id=7,
        venue_id=8,
        image_map={},
    )

    assert len(entries) == 1
    assert entries[0]["source_url"] == "https://www.taraatlanta.com/movie/my-fathers-shadow-2026/"
    assert entries[0]["ticket_url"] == "https://www.taraatlanta.com/movie/my-fathers-shadow-2026/"
    assert entries[0]["title"] == "My Father's Shadow (2026)"
    assert entries[0]["start_date"] == "2026-04-08"
    assert entries[0]["start_time"] == "16:00"  # UTC 20:00 → EDT 16:00
