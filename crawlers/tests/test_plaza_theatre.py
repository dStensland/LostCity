from sources.plaza_theatre import resolve_showtime_ticket_url


class _FakeButton:
    def __init__(self, page):
        self.page = page

    def click(self, timeout=0):
        self.page.url = "https://www.plazaatlanta.com/checkout/showing/sharkys-machine/2708266"


class _FakePage:
    def __init__(self):
        self.url = "https://www.plazaatlanta.com/now-showing/"
        self.went_back = False

    def wait_for_url(self, pattern, timeout=0):
        if "/checkout/showing/" not in self.url:
            raise RuntimeError("navigation did not occur")

    def go_back(self, wait_until=None, timeout=0):
        self.url = "https://www.plazaatlanta.com/now-showing/"
        self.went_back = True

    def wait_for_timeout(self, ms):
        return None


class _FakeNoopButton:
    def click(self, timeout=0):
        return None


def test_resolve_showtime_ticket_url_returns_checkout_url_and_restores_listing_page():
    page = _FakePage()

    url = resolve_showtime_ticket_url(page, _FakeButton(page))

    assert url == "https://www.plazaatlanta.com/checkout/showing/sharkys-machine/2708266"
    assert page.url == "https://www.plazaatlanta.com/now-showing/"
    assert page.went_back is True


def test_resolve_showtime_ticket_url_returns_none_when_button_does_not_navigate():
    page = _FakePage()

    url = resolve_showtime_ticket_url(page, _FakeNoopButton())

    assert url is None
    assert page.url == "https://www.plazaatlanta.com/now-showing/"
