from scripts import backfill_event_artists as backfill


def test_run_artist_backfill_forwards_allow_single_entity_true(monkeypatch):
    captured: dict[str, bool] = {}

    def fake_backfill_pass(**kwargs):
        captured["allow_single_entity"] = bool(kwargs.get("allow_single_entity"))
        return {"backfill_checked": 0, "backfill_added": 0}

    monkeypatch.setattr(backfill, "run_backfill_pass", fake_backfill_pass)

    result = backfill.run_artist_backfill(
        categories=["music"],
        cleanup=False,
        backfill=True,
        dry_run=True,
        allow_single_entity=True,
    )

    assert result["backfill_checked"] == 0
    assert captured["allow_single_entity"] is True


def test_run_artist_backfill_forwards_allow_single_entity_false_by_default(monkeypatch):
    captured: dict[str, bool] = {}

    def fake_backfill_pass(**kwargs):
        captured["allow_single_entity"] = bool(kwargs.get("allow_single_entity"))
        return {"backfill_checked": 0, "backfill_added": 0}

    monkeypatch.setattr(backfill, "run_backfill_pass", fake_backfill_pass)

    backfill.run_artist_backfill(
        categories=["music"],
        cleanup=False,
        backfill=True,
        dry_run=True,
    )

    assert captured["allow_single_entity"] is False


def test_high_confidence_backfill_allows_long_ensemble_name() -> None:
    assert backfill._is_high_confidence_backfill(  # noqa: SLF001
        title="ASO Education Presents: Columbus State University's Schwob Percussion Ensemble",
        category="music",
        artists=[{"name": "Columbus State University's Schwob Percussion Ensemble"}],
        allow_single_entity=True,
    )


def test_high_confidence_backfill_rejects_overly_long_single_entity() -> None:
    assert not backfill._is_high_confidence_backfill(  # noqa: SLF001
        title="One Two Three Four Five Six Seven Eight Nine",
        category="music",
        artists=[{"name": "One Two Three Four Five Six Seven Eight Nine"}],
        allow_single_entity=True,
    )


def test_fallback_single_entity_from_masquerade_description() -> None:
    rows = backfill._fallback_single_entity_from_source(  # noqa: SLF001
        source_slug="the-masquerade",
        source_url="https://www.masqueradeatlanta.com/events/choker/",
        description=(
            "Hell at The Masquerade Choker is a Detroit-born singer, songwriter, "
            "and producer."
        ),
    )
    assert rows[0]["name"] == "Choker"


def test_fallback_single_entity_from_masquerade_url_slug() -> None:
    rows = backfill._fallback_single_entity_from_source(  # noqa: SLF001
        source_slug="the-masquerade",
        source_url="https://www.masqueradeatlanta.com/events/the-dear-hunter-2/",
        description="Hell at The Masquerade.",
    )
    assert rows[0]["name"] == "The Dear Hunter"


def test_fallback_single_entity_masquerade_special_slug_mapping() -> None:
    rows = backfill._fallback_single_entity_from_source(  # noqa: SLF001
        source_slug="the-masquerade",
        source_url="https://www.masqueradeatlanta.com/events/theartit-2/",
        description="Purgatory at The Masquerade.",
    )
    assert rows[0]["name"] == "TheARTI$T"
