import subprocess

import pytest

from scripts.check_festival_dates import extract_dates_from_html, fetch_html


def test_extract_dates_from_html_uses_min_max_for_multiple_single_dates() -> None:
    html = """
    <html><body>
      <h1>West End Comedy Fest 2026</h1>
      <p>March 6, 2026 Squids & Giggles</p>
      <p>March 7, 2026 Dirty South Comedy</p>
      <p>March 8, 2026 ATL Hoedown</p>
    </body></html>
    """

    start, end, method = extract_dates_from_html(html)

    assert start == "2026-03-06"
    assert end == "2026-03-08"
    assert method == "regex-multi-single"


def test_extract_dates_from_html_prefers_dense_single_date_cluster_over_stray_date() -> None:
    html = """
    <html><body>
      <p>Friday, April 3, 2026</p>
      <p>Saturday, April 18, 2026 from 10 am to 6 pm</p>
      <p>Sunday, April 19, 2026 from 12 pm to 5 pm</p>
    </body></html>
    """

    start, end, method = extract_dates_from_html(html)

    assert start == "2026-04-18"
    assert end == "2026-04-19"
    assert method == "regex-multi-single"


def test_extract_dates_from_html_keeps_single_date_when_only_one_exists() -> None:
    html = "<html><body><p>October 5, 2026</p></body></html>"

    start, end, method = extract_dates_from_html(html)

    assert start == "2026-10-05"
    assert end == "2026-10-05"
    assert method == "regex-single"


def test_extract_dates_from_html_uses_month_day_cluster_under_page_year() -> None:
    html = """
    <html><body>
      <h1>JAPANFEST ATLANTA 2026</h1>
      <p>September 19 10:00 AM - 6:00 PM</p>
      <p>September 20 10:00 AM - 5:00 PM</p>
    </body></html>
    """

    start, end, method = extract_dates_from_html(html)

    assert start == "2026-09-19"
    assert end == "2026-09-20"
    assert method == "regex-month-day-cluster"


def test_extract_dates_from_html_prefers_visible_range_over_meta_publish_date() -> None:
    html = """
    <html>
      <head>
        <meta property="article:published_time" content="2026-02-27T10:00:00Z" />
      </head>
      <body>
        <h1>Cherry Blossom Festival 2026</h1>
        <p>March 20-29, 2026</p>
      </body>
    </html>
    """

    start, end, method = extract_dates_from_html(html)

    assert start == "2026-03-20"
    assert end == "2026-03-29"
    assert method == "regex-range"


def test_extract_dates_from_html_prefers_slug_targeted_single_date_on_multi_city_pages() -> None:
    html = """
    <html><body>
      <div>CHARLOTTE, NC - May 9, 2026</div>
      <div>ATLANTA, GA - February 28, 2026</div>
      <div>NOVA - May 2, 2026</div>
    </body></html>
    """

    start, end, method = extract_dates_from_html(html, "beer-bourbon-bbq-atlanta")

    assert start == "2026-02-28"
    assert end == "2026-02-28"
    assert method == "regex-single-targeted"


def test_fetch_html_falls_back_to_curl(monkeypatch) -> None:
    def fake_requests_get(*_args, **_kwargs):
        raise RuntimeError("tls failure")

    def fake_run(cmd, check, capture_output, text):
        assert cmd[:2] == ["curl", "-L"]
        assert check is True
        assert capture_output is True
        assert text is True
        return subprocess.CompletedProcess(cmd, 0, stdout="<html>curl fallback</html>", stderr="")

    monkeypatch.setattr("scripts.check_festival_dates.requests.get", fake_requests_get)
    monkeypatch.setattr("scripts.check_festival_dates.subprocess.run", fake_run)

    html = fetch_html("https://example.com")

    assert html == "<html>curl fallback</html>"


def test_fetch_html_raises_when_requests_and_curl_both_fail(monkeypatch) -> None:
    def fake_requests_get(*_args, **_kwargs):
        raise RuntimeError("tls failure")

    def fake_run(*_args, **_kwargs):
        raise subprocess.CalledProcessError(35, ["curl"], stderr="handshake failed")

    monkeypatch.setattr("scripts.check_festival_dates.requests.get", fake_requests_get)
    monkeypatch.setattr("scripts.check_festival_dates.subprocess.run", fake_run)

    with pytest.raises(subprocess.CalledProcessError):
        fetch_html("https://example.com")
