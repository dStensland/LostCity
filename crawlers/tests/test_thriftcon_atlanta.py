from datetime import date

import pytest

from sources.thriftcon_atlanta import parse_official_page


def test_parse_official_page_rejects_past_cycle() -> None:
    html = """
    <html>
      <body>
        <h1>ThriftCon Atlanta 2026</h1>
        <p>2026/02/28 10:00:00</p>
        <p>ThriftCon Atlanta 2026 GICC Saturday, February 28 | 10am - 5pm</p>
      </body>
    </html>
    """

    with pytest.raises(ValueError, match="past-dated"):
        parse_official_page(html, today=date(2026, 3, 11))
