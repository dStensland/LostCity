from sources.center_stage import extract_detail_fields_from_html, fetch_detail_fields


def test_extract_detail_fields_reads_ticketmaster_cta_and_status():
    html = """
    <html>
      <body>
        <div class="price">SOLD OUT</div>
        <a class="buy-tickets" href="https://www.ticketmaster.com/event/0E00636796DF7AD4">
          SOLD OUT
        </a>
      </body>
    </html>
    """

    fields = extract_detail_fields_from_html(html)

    assert fields["ticket_url"] == "https://www.ticketmaster.com/event/0E00636796DF7AD4"
    assert fields["price_note"] == "Sold Out"
    assert fields["price_min"] is None
    assert fields["price_max"] is None


def test_extract_detail_fields_reads_price_range_when_present():
    html = """
    <html>
      <body>
        <div class="price">$29.50 ADV / $35 DOS</div>
        <a class="buy-tickets" href="https://www.ticketmaster.com/event/ABC123">
          Buy Tickets
        </a>
      </body>
    </html>
    """

    fields = extract_detail_fields_from_html(html)

    assert fields["ticket_url"] == "https://www.ticketmaster.com/event/ABC123"
    assert fields["price_min"] == 29.5
    assert fields["price_max"] == 35.0
    assert fields["price_note"] == "$29.50 ADV / $35 DOS"


def test_fetch_detail_fields_returns_empty_without_event_url():
    assert fetch_detail_fields(context=None, event_url=None) == {}
