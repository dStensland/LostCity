"""Tests for film metadata lookups in posters.py."""

from types import SimpleNamespace
from unittest.mock import patch

from posters import clear_cache, fetch_film_metadata


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    def json(self) -> dict:
        return self._payload


def test_fetch_film_metadata_prefers_omdb_when_available():
    clear_cache()
    cfg = SimpleNamespace(api=SimpleNamespace(omdb_api_key="omdb-key"))
    seen_urls: list[str] = []

    def fake_get(url, *args, **kwargs):  # noqa: ANN001
        seen_urls.append(url)
        if "omdbapi.com" in url:
            return _FakeResponse(
                200,
                {
                    "Response": "True",
                    "Title": "The NeverEnding Story",
                    "Year": "1984",
                    "Poster": "https://example.com/poster.jpg",
                    "Director": "Wolfgang Petersen",
                    "Runtime": "94 min",
                    "Rated": "PG",
                    "imdbID": "tt0088323",
                    "Genre": "Adventure, Family",
                    "Plot": "A young boy enters a magical fantasy world.",
                },
            )
        raise AssertionError(f"Unexpected URL: {url}")

    with patch("posters.get_config", return_value=cfg), patch(
        "posters.requests.get", side_effect=fake_get
    ):
        metadata = fetch_film_metadata("The NeverEnding Story", "1984")

    assert metadata is not None
    assert metadata.source == "omdb"
    assert metadata.imdb_id == "tt0088323"
    assert metadata.genres == ["adventure", "family"]


def test_fetch_film_metadata_falls_back_to_wikidata():
    clear_cache()
    cfg = SimpleNamespace(api=SimpleNamespace(omdb_api_key="omdb-key"))

    def fake_get(url, *args, **kwargs):  # noqa: ANN001
        params = kwargs.get("params") or {}
        if "omdbapi.com" in url:
            return _FakeResponse(200, {"Response": "False", "Error": "Movie not found!"})

        if "wikidata.org/w/api.php" in url and params.get("action") == "wbsearchentities":
            return _FakeResponse(
                200,
                {
                    "search": [
                        {"id": "Q190029", "label": "Fight Club"},
                    ]
                },
            )

        if (
            "wikidata.org/w/api.php" in url
            and params.get("action") == "wbgetentities"
            and params.get("props") == "labels|descriptions|claims"
        ):
            return _FakeResponse(
                200,
                {
                    "entities": {
                        "Q190029": {
                            "labels": {"en": {"value": "Fight Club"}},
                            "descriptions": {"en": {"value": "1999 film directed by David Fincher"}},
                            "claims": {
                                "P577": [
                                    {
                                        "mainsnak": {
                                            "datavalue": {"value": {"time": "+1999-10-15T00:00:00Z"}}
                                        }
                                    }
                                ],
                                "P345": [
                                    {
                                        "mainsnak": {
                                            "datavalue": {"value": "tt0137523"}
                                        }
                                    }
                                ],
                                "P136": [
                                    {
                                        "mainsnak": {
                                            "datavalue": {"value": {"id": "Q130232"}}
                                        }
                                    }
                                ],
                            },
                        }
                    }
                },
            )

        if (
            "wikidata.org/w/api.php" in url
            and params.get("action") == "wbgetentities"
            and params.get("props") == "labels"
        ):
            return _FakeResponse(
                200,
                {
                    "entities": {
                        "Q130232": {"labels": {"en": {"value": "drama film"}}},
                    }
                },
            )

        raise AssertionError(f"Unexpected URL/params: {url} / {params}")

    with patch("posters.get_config", return_value=cfg), patch(
        "posters.requests.get", side_effect=fake_get
    ):
        metadata = fetch_film_metadata("Fight Club", "1999")

    assert metadata is not None
    assert metadata.source == "wikidata"
    assert metadata.title == "Fight Club"
    assert metadata.year == 1999
    assert metadata.imdb_id == "tt0137523"
    assert metadata.genres == ["drama film"]


def test_fetch_film_metadata_returns_none_when_omdb_and_wikidata_miss():
    clear_cache()
    cfg = SimpleNamespace(api=SimpleNamespace(omdb_api_key="omdb-key"))

    def fake_get(url, *args, **kwargs):  # noqa: ANN001
        params = kwargs.get("params") or {}
        if "omdbapi.com" in url:
            return _FakeResponse(200, {"Response": "False", "Error": "Movie not found!"})
        if "wikidata.org/w/api.php" in url and params.get("action") == "wbsearchentities":
            return _FakeResponse(200, {"search": []})
        raise AssertionError(f"Unexpected URL/params: {url} / {params}")

    with patch("posters.get_config", return_value=cfg), patch(
        "posters.requests.get", side_effect=fake_get
    ):
        metadata = fetch_film_metadata("Unknown Curated Program", "2026")

    assert metadata is None
