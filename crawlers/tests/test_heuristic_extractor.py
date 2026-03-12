from extractors.heuristic import extract_heuristic_fields


def test_extract_heuristic_fields_rejects_generic_large_images_without_event_context() -> None:
    html = """
    <html>
      <body>
        <img src="_museum-images/spelman-museum-01.jpg" alt="" width="1800" height="1119" />
        <img src="_museum-images/hp-scmfa-student-viewing-gallery.jpg" class="rev-slidebg" width="1800" height="1119" />
      </body>
    </html>
    """

    result = extract_heuristic_fields(html)

    assert "image_url" not in result


def test_extract_heuristic_fields_keeps_contextual_poster_image() -> None:
    html = """
    <html>
      <body>
        <img
          src="/images/sharkys-machine-poster.jpg"
          alt="Sharky's Machine poster"
          width="1200"
          height="1800"
        />
      </body>
    </html>
    """

    result = extract_heuristic_fields(html)

    assert result["image_url"] == "/images/sharkys-machine-poster.jpg"


def test_extract_heuristic_fields_reads_cancelled_ticket_status_from_cta() -> None:
    html = """
    <html>
      <body>
        <a class="buy-tickets" href="https://tickets.example.com/event/123">Postponed</a>
      </body>
    </html>
    """

    result = extract_heuristic_fields(html)

    assert result["ticket_url"] == "https://tickets.example.com/event/123"
    assert result["ticket_status"] == "cancelled"


def test_extract_heuristic_fields_keeps_numeric_price_and_status_separate() -> None:
    html = """
    <html>
      <body>
        <div>Tickets: $25.00</div>
        <a class="buy-tickets" href="https://tickets.example.com/event/123">Sales Ended</a>
      </body>
    </html>
    """

    result = extract_heuristic_fields(html)

    assert result["ticket_url"] == "https://tickets.example.com/event/123"
    assert result["ticket_status"] == "sold-out"
    assert result["price_min"] == 25.0
    assert result["price_note"] == "$25.00"
