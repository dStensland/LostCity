import json

from enrich_festivals import (
    _extract_festival_description,
    _festival_needs_description_task,
    apply_festival_results,
    _build_festival_source_text,
    build_festival_task_payload,
    extract_festival_tasks,
    extract_visible_text,
    passes_grounding_check,
    prepare_festival_tasks,
)


def test_extract_festival_description_uses_role_main_content() -> None:
    html = """
    <html>
      <head>
        <meta name="description" content="Short teaser." />
      </head>
      <body>
        <nav>
          <p>Tickets</p>
          <p>Directions</p>
        </nav>
        <div role="main">
          <p>
            The Atlanta Spring Lantern Festival fills the park with large-scale
            light installations, live performances, and night-market food stalls.
          </p>
          <p>
            Guests can explore artist-built lantern environments, family-friendly
            activities, and rotating cultural showcases throughout the weekend.
          </p>
        </div>
      </body>
    </html>
    """

    description = _extract_festival_description(html)

    assert description == (
        "The Atlanta Spring Lantern Festival fills the park with large-scale "
        "light installations, live performances, and night-market food stalls. "
        "Guests can explore artist-built lantern environments, family-friendly "
        "activities, and rotating cultural showcases throughout the weekend."
    )


def test_extract_visible_text_prefers_role_main_and_skips_nav() -> None:
    html = """
    <html>
      <body>
        <nav>
          <p>Tickets</p>
          <p>Privacy Policy</p>
        </nav>
        <div role="main">
          <h1>Atlanta Spring Lantern Festival</h1>
          <p>Experience large-scale lantern installations and live music.</p>
          <p>Food stalls and family activities run throughout the weekend.</p>
        </div>
      </body>
    </html>
    """

    visible = extract_visible_text(html)

    assert "Privacy Policy" not in visible
    assert "Tickets" not in visible
    assert "Atlanta Spring Lantern Festival" in visible
    assert "Food stalls and family activities run throughout the weekend." in visible


def test_extract_visible_text_skips_cookie_privacy_boilerplate() -> None:
    html = """
    <html>
      <body>
        <div>
          <p>We Value Your Privacy</p>
          <p>By clicking "Accept All", you consent to our use of cookies.</p>
        </div>
        <div role="main">
          <p>Roswell Roots celebrates Black History Month through programs,
          events, and activities focused on raising cultural awareness.</p>
        </div>
      </body>
    </html>
    """

    visible = extract_visible_text(html)

    assert "Privacy" not in visible
    assert "cookies" not in visible.lower()
    assert "Roswell Roots celebrates Black History Month" in visible


def test_build_festival_source_text_prefers_extracted_description() -> None:
    html = """
    <html>
      <body>
        <div>
          <p>We Value Your Privacy</p>
          <p>By clicking "Accept All", you consent to our use of cookies.</p>
        </div>
        <div role="main">
          <p>
            Roswell Roots celebrates Black History Month through programs,
            events and activities focused on raising cultural awareness and
            engaging the community.
          </p>
        </div>
      </body>
    </html>
    """

    source_text = _build_festival_source_text(
        html,
        "https://roswellroots.com",
        fetch_cfg=None,
    )

    assert "Privacy" not in source_text
    assert source_text == (
        "Roswell Roots celebrates Black History Month through programs, events "
        "and activities focused on raising cultural awareness and engaging "
        "the community."
    )


def test_build_festival_source_text_keeps_grounded_copy_for_schedule_heavy_pages() -> None:
    html = """
    <html>
      <body>
        <div role="main">
          <p>Friday</p>
          <p>Squids & Giggles 6 PM (Wild Heaven Lounge)</p>
          <p>Geoffrey Asmus 9:30 PM (Plywood Place)</p>
          <p>Saturday</p>
          <p>Amy Miller 7 PM (Wild Heaven Garden Club)</p>
          <p>SOLD OUT</p>
        </div>
      </body>
    </html>
    """

    source_text = _build_festival_source_text(
        html,
        "https://www.westendcomedyfest.com/schedule",
        fetch_cfg=None,
        current_description=(
            "West End Comedy Fest is an Atlanta comedy festival in the historic "
            "West End featuring comics from around the country at Wild Heaven "
            "Garden Club, Wild Heaven Lounge, and Plywood Place."
        ),
    )

    assert source_text.startswith("West End Comedy Fest is an Atlanta comedy festival")
    assert "Squids & Giggles 6 PM" in source_text
    assert "Geoffrey Asmus 9:30 PM" in source_text


def test_festival_needs_description_task_for_missing_or_short_copy() -> None:
    assert _festival_needs_description_task({"description": None}) is True
    assert _festival_needs_description_task({"description": "Short blurb"}) is True
    assert _festival_needs_description_task(
        {"description": "A long enough description " * 5}
    ) is False
    assert _festival_needs_description_task(
        {"description": "A solid but still thin description that should be queued."},
        min_description_length=120,
    ) is True


def test_build_festival_task_payload_schema() -> None:
    payload = build_festival_task_payload(
        {
            "id": 17,
            "slug": "lantern-fest",
            "name": "Lantern Fest",
            "website": "https://example.com/fest",
            "description": None,
            "announced_start": "2026-04-10",
            "announced_end": "2026-04-12",
        },
        "Visible festival source text.",
    )

    assert payload["entity_type"] == "festival"
    assert payload["festival_id"] == 17
    assert payload["slug"] == "lantern-fest"
    assert payload["visible_text"] == "Visible festival source text."
    assert payload["announced_start"] == "2026-04-10"


def test_prepare_festival_tasks_writes_json_files(tmp_path, monkeypatch) -> None:
    class _Query:
        def __init__(self, rows):
            self.rows = rows

        def select(self, *_args, **_kwargs):
            return self

        @property
        def not_(self):
            return self

        def is_(self, *_args, **_kwargs):
            return self

        def order(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def execute(self):
            return type("Result", (), {"data": self.rows})()

    class _Client:
        def __init__(self, rows):
            self.rows = rows

        def table(self, _name):
            return _Query(self.rows)

    html = """
    <html>
      <body>
        <div role="main">
          <p>The Lantern Fest returns with illuminated installations, live performances,
          artist markets, and food vendors across a three-day weekend.</p>
          <p>Guests can explore immersive lantern gardens and rotating cultural showcases.</p>
        </div>
      </body>
    </html>
    """

    monkeypatch.setattr(
        "enrich_festivals.get_client",
        lambda: _Client(
            [
                {
                    "id": 9,
                    "slug": "lantern-fest",
                    "name": "Lantern Fest",
                    "website": "https://example.com/fest",
                    "description": None,
                    "announced_start": None,
                    "announced_end": None,
                }
            ]
        ),
    )
    monkeypatch.setattr("enrich_festivals.fetch_html", lambda *_args, **_kwargs: (html, None))

    stats = prepare_festival_tasks(task_dir=tmp_path)

    assert stats == {"total": 1, "written": 1, "failed": 0, "skipped": 0}

    payload = json.loads((tmp_path / "lantern-fest.json").read_text(encoding="utf-8"))
    assert payload["entity_type"] == "festival"
    assert payload["slug"] == "lantern-fest"
    assert "live performances" in payload["visible_text"]


def test_prepare_festival_tasks_prefers_clean_extracted_source_text(tmp_path, monkeypatch) -> None:
    class _Query:
        def __init__(self, rows):
            self.rows = rows

        def select(self, *_args, **_kwargs):
            return self

        @property
        def not_(self):
            return self

        def is_(self, *_args, **_kwargs):
            return self

        def order(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def execute(self):
            return type("Result", (), {"data": self.rows})()

    class _Client:
        def __init__(self, rows):
            self.rows = rows

        def table(self, _name):
            return _Query(self.rows)

    html = """
    <html>
      <body>
        <div>
          <p>We Value Your Privacy</p>
          <p>By clicking "Accept All", you consent to our use of cookies.</p>
        </div>
        <div role="main">
          <p>
            Roswell Roots celebrates Black History Month through programs,
            events and activities focused on raising cultural awareness and
            engaging the community.
          </p>
        </div>
      </body>
    </html>
    """

    monkeypatch.setattr(
        "enrich_festivals.get_client",
        lambda: _Client(
            [
                {
                    "id": "roswell-roots-festival",
                    "slug": "roswell-roots-festival",
                    "name": "Roswell Roots Festival",
                    "website": "https://roswellroots.com",
                    "description": "Short blurb",
                    "announced_start": None,
                    "announced_end": None,
                }
            ]
        ),
    )
    monkeypatch.setattr("enrich_festivals.fetch_html", lambda *_args, **_kwargs: (html, None))

    stats = prepare_festival_tasks(task_dir=tmp_path)

    assert stats == {"total": 1, "written": 1, "failed": 0, "skipped": 0}

    payload = json.loads(
        (tmp_path / "roswell-roots-festival.json").read_text(encoding="utf-8")
    )
    assert payload["visible_text"].startswith("Roswell Roots celebrates Black History Month")
    assert "Privacy" not in payload["visible_text"]


def test_prepare_festival_tasks_honors_custom_description_threshold(tmp_path, monkeypatch) -> None:
    class _Query:
        def __init__(self, rows):
            self.rows = rows

        def select(self, *_args, **_kwargs):
            return self

        @property
        def not_(self):
            return self

        def is_(self, *_args, **_kwargs):
            return self

        def order(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def execute(self):
            return type("Result", (), {"data": self.rows})()

    class _Client:
        def __init__(self, rows):
            self.rows = rows

        def table(self, _name):
            return _Query(self.rows)

    html = """
    <html>
      <body>
        <div role="main">
          <p>
            This festival celebrates Atlanta makers, live music, and neighborhood
            food vendors through a weekend of community-focused programming.
          </p>
        </div>
      </body>
    </html>
    """

    monkeypatch.setattr(
        "enrich_festivals.get_client",
        lambda: _Client(
            [
                {
                    "id": "makers-fest",
                    "slug": "makers-fest",
                    "name": "Makers Fest",
                    "website": "https://example.com/makers",
                    "description": (
                        "A decent description that is longer than eighty characters but "
                        "still short enough to revisit during the bounded pilot."
                    ),
                    "announced_start": None,
                    "announced_end": None,
                }
            ]
        ),
    )
    monkeypatch.setattr("enrich_festivals.fetch_html", lambda *_args, **_kwargs: (html, None))

    stats = prepare_festival_tasks(
        task_dir=tmp_path,
        min_description_length=140,
    )

    assert stats == {"total": 1, "written": 1, "failed": 0, "skipped": 0}
    assert (tmp_path / "makers-fest.json").exists()


def test_passes_grounding_check_accepts_grounded_description() -> None:
    source_text = (
        "The Lantern Fest returns with illuminated installations, live performances, "
        "artist markets, and food vendors across a three-day weekend."
    )
    description = (
        "Lantern Fest is a three-day festival built around illuminated installations, "
        "live performances, artist markets, and food vendors."
    )

    assert passes_grounding_check(description, source_text) is True


def test_passes_grounding_check_rejects_hallucinated_description() -> None:
    source_text = (
        "The Lantern Fest returns with illuminated installations, live performances, "
        "artist markets, and food vendors across a three-day weekend."
    )
    description = (
        "Lantern Fest centers on celebrity chef pop-ups, waterfront fireworks, "
        "and a drone show above the riverfront."
    )

    assert passes_grounding_check(description, source_text) is False


def test_extract_festival_tasks_writes_result_files(tmp_path, monkeypatch) -> None:
    task_dir = tmp_path / "tasks"
    result_dir = tmp_path / "results"
    task_dir.mkdir()
    task = {
        "schema_version": "festival_llm_task_v1",
        "entity_type": "festival",
        "festival_id": 9,
        "slug": "lantern-fest",
        "name": "Lantern Fest",
        "website": "https://example.com/fest",
        "current_description": None,
        "announced_start": None,
        "announced_end": None,
        "visible_text": (
            "The Lantern Fest returns with illuminated installations, live performances, "
            "artist markets, and food vendors across a three-day weekend."
        ),
        "prepared_at": "2026-04-02T12:00:00Z",
    }
    (task_dir / "lantern-fest.json").write_text(json.dumps(task), encoding="utf-8")

    monkeypatch.setattr(
        "enrich_festivals.generate_text",
        lambda *_args, **_kwargs: (
            "Lantern Fest is a three-day festival with illuminated installations, "
            "live performances, artist markets, and food vendors."
        ),
    )

    stats = extract_festival_tasks(task_dir=task_dir, result_dir=result_dir)

    assert stats == {"total": 1, "written": 1, "failed": 0}
    payload = json.loads((result_dir / "lantern-fest.json").read_text(encoding="utf-8"))
    assert payload["entity_type"] == "festival"
    assert payload["festival_id"] == 9
    assert "live performances" in payload["description"]


def test_apply_festival_results_dry_run_accepts_grounded_result(tmp_path) -> None:
    result_dir = tmp_path / "results"
    result_dir.mkdir()
    payload = {
        "schema_version": "festival_llm_result_v1",
        "entity_type": "festival",
        "festival_id": 9,
        "slug": "lantern-fest",
        "name": "Lantern Fest",
        "website": "https://example.com/fest",
        "description": (
            "Lantern Fest is a three-day festival with illuminated installations, "
            "live performances, artist markets, and food vendors."
        ),
        "source_text": (
            "The Lantern Fest returns with illuminated installations, live performances, "
            "artist markets, and food vendors across a three-day weekend."
        ),
        "extracted_at": "2026-04-02T12:00:00Z",
    }
    (result_dir / "lantern-fest.json").write_text(json.dumps(payload), encoding="utf-8")

    stats = apply_festival_results(dry_run=True, result_dir=result_dir)

    assert stats == {"total": 1, "accepted": 1, "rejected": 0, "updated": 0}
