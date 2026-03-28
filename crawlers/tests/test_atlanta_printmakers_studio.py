from __future__ import annotations

from datetime import date

from bs4 import BeautifulSoup


SAMPLE_HTML = """
<html>
  <body>
    <div data-block-type="2"><div class="sqs-block-content">Now on view: RISO Pin-up Show</div></div>
    <div data-block-type="47"><hr /></div>
    <div data-block-type="5"><img src="https://example.com/current.jpg" /></div>
    <div data-block-type="47"><hr /></div>
    <div data-block-type="5"><img src="https://example.com/future.jpg" /></div>
    <div data-block-type="2">
      <div class="sqs-block-content">
        Spring Ink Invitational April 20, 2026 - May 25, 2026 Opening Reception: April 20. A juried print exhibition.
      </div>
    </div>
    <div data-block-type="2">
      <div class="sqs-block-content">
        Past Exhibits - 2025 IMPRINT: Atlanta Printmakers Studio at 20 November 6, 2025 - January 23, 2026 Archival listing.
      </div>
    </div>
    <div data-block-type="2">
      <div class="sqs-block-content">
        Past Exhibits - 2024 Paths - Trayectos: Print Exchange Portfolio December 1 - 31 Archival listing.
      </div>
    </div>
  </body>
</html>
"""


def test_extract_candidates_parses_current_and_dated_exhibitions():
    import sources.atlanta_printmakers_studio as crawler

    soup = BeautifulSoup(SAMPLE_HTML, "html.parser")

    candidates = crawler._extract_candidates(soup, today=date(2026, 3, 17))

    assert len(candidates) == 2

    current = candidates[0]
    assert current.title == "RISO Pin-up Show"
    assert current.current_without_dates is True
    assert current.event_start_date == "2026-03-17"
    assert current.opening_date is None
    assert current.image_url == "https://example.com/current.jpg"

    dated = candidates[1]
    assert dated.title == "Spring Ink Invitational"
    assert dated.current_without_dates is False
    assert dated.event_start_date == "2026-04-20"
    assert dated.opening_date == "2026-04-20"
    assert dated.closing_date == "2026-05-25"
    assert dated.image_url == "https://example.com/future.jpg"


def test_crawl_writes_exhibitions_only(monkeypatch):
    """Exhibitions go to exhibitions table only — no event writes."""
    import sources.atlanta_printmakers_studio as crawler

    soup = BeautifulSoup(SAMPLE_HTML, "html.parser")
    inserted_exhibitions: list[dict] = []

    monkeypatch.setattr(crawler, "_today", lambda: date(2026, 3, 17))
    monkeypatch.setattr(crawler, "_fetch_soup", lambda _url: soup)
    monkeypatch.setattr(crawler, "get_or_create_place", lambda _venue: 77)
    monkeypatch.setattr(
        crawler,
        "insert_exhibition",
        lambda payload: inserted_exhibitions.append(payload) or "exh-id",
    )

    found, new, updated = crawler.crawl({"id": 11})

    assert (found, new, updated) == (2, 2, 0)
    assert [row["title"] for row in inserted_exhibitions] == [
        "RISO Pin-up Show",
        "Spring Ink Invitational",
    ]
    assert inserted_exhibitions[0]["opening_date"] is None
    assert inserted_exhibitions[0]["metadata"] == {"date_precision": "current_no_dates"}
    assert inserted_exhibitions[1]["opening_date"] == "2026-04-20"
    assert inserted_exhibitions[1]["closing_date"] == "2026-05-25"
