from pipeline.loader import load_profile


EXPECTED_PROFILES = {
    "blade-show": "https://www.bladeshow.com/show-info/",
    "collect-a-con-atlanta-fall": "https://collectaconusa.com/atlanta-2/",
    "conjuration": "https://www.conjurationcon.com/",
    "southeastern-stamp-expo": "http://www.sefsc.org",
    "toylanta": "https://www.toylanta.net/schedule",
    "atlantacon": "https://ipmsusa.org/event/atlantacon-2026",
    "atlanta-pen-show": "https://atlpenshow.com/pages/show-schedule",
    "original-sewing-quilt-expo": "https://www.sewingexpo.com/Events/Atlanta-GA",
    "greater-atlanta-coin-show": "http://atlcoin.com/",
    "atlanta-toy-model-train-show": "https://www.tcatrains.org/event/tca-terminus-chapter-meet-7/",
    "bellpoint-gem-show": "https://bellpointgemshow.com/pages/show-dates",
    "verticon": "https://verticon.org/attendee-faq/",
    "ga-mineral-society-show": "https://gamineral.org/showmain.html",
    "atlanta-bead-show": "https://beadshows.com/georgia-bead-shows/",
}

RENDER_JS_PROFILES = {
    "atlanta-bead-show",
    "conjuration",
    "toylanta",
}


def test_unconventional_convention_profiles_use_exact_slugs_and_urls():
    for slug, url in EXPECTED_PROFILES.items():
        profile = load_profile(slug)

        assert profile.slug == slug
        assert profile.integration_method == "festival_schedule"
        assert profile.discovery.urls == [url]

        expect_render_js = slug in RENDER_JS_PROFILES
        assert profile.discovery.fetch.render_js is expect_render_js
        assert profile.detail.fetch.render_js is expect_render_js
