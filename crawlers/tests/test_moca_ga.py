from sources.moca_ga import (
    _extract_exhibition_records,
    _parse_schedule_text,
)


class _FakeResponse:
    def __init__(self, text: str):
        self.text = text

    def raise_for_status(self) -> None:
        return None


class _FakeSession:
    def __init__(self, responses):
        self._responses = responses

    def get(self, url: str, timeout: int = 30):
        return _FakeResponse(self._responses[url])


def test_parse_schedule_text_handles_live_event_calendar_format():
    start_date, start_time, end_time = _parse_schedule_text("Aug 3, 2026 4:00 pm - 7:00 pm")

    assert start_date == "2026-08-03"
    assert start_time == "16:00"
    assert end_time == "19:00"


def test_extract_exhibition_records_parses_image_blocks():
    html = """
    <html><body>
      <div class="image-content-container">
        <div class="image-container" style="background-image: url(_museum-images/show-a.jpg);"></div>
        <div class="content-container">
          <div class="image-content">
            <h3><strong>Runaway Universe</strong><br/><strong>Nov. 8, 2026 - Jan. 10, 2027</strong></h3>
            <p><a href="exhibitions/runaway-universe.html">Runaway Universe</a> is an exhibition of recent paintings and works on paper.</p>
          </div>
        </div>
      </div>
    </body></html>
    """

    records = _extract_exhibition_records(
        _FakeSession(
            {
                "https://www.mocaga.org/exhibitions-events/current-upcoming-exhibitions/": html,
            }
        )
    )

    assert len(records) == 1
    assert records[0]["title"] == "Runaway Universe"
    assert records[0]["start_date"] == "2026-11-08"
    assert records[0]["end_date"] == "2027-01-10"
    assert records[0]["image_url"].endswith("/_museum-images/show-a.jpg")
