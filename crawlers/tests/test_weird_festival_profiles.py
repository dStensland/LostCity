from pipeline.loader import load_profile


EXPECTED_PROFILES = {
    "atlanta-fringe-festival": "https://www.atlantafringe.org",
    "monsterama-con": "https://monsteramacon.com/monsterama-program-schedule/",
    "oddities-curiosities-expo": "https://odditiesandcuriositiesexpo.com/schedule-%2F-tickets",
    "world-oddities-expo-atlanta": "https://worldodditiesexpo.com/atlanta-ga/",
    "beltline-lantern-parade": "https://beltline.org/art/lantern-parade/",
    "jordancon": "https://www.jordancon.org/activities/programming/",
    "repticon-atlanta": "https://repticon.com/georgia/atlanta",
    "southeast-reptile-expo": "https://www.southeastreptileexpo.com",
    "atlanta-brick-con": "https://atlantabrickcon.com",
    "southern-fried-gaming-expo": "https://www.southernfriedgamingexpo.com",
    "frolicon": "https://frolicon.com/registration/",
}

RENDER_JS_PROFILES = {
    "monsterama-con",
    "beltline-lantern-parade",
    "repticon-atlanta",
}


def test_weird_festival_profiles_use_exact_slugs_and_festival_schedule():
    for slug, url in EXPECTED_PROFILES.items():
        profile = load_profile(slug)

        assert profile.slug == slug
        assert profile.integration_method == "festival_schedule"
        assert profile.discovery.urls == [url]

        expect_render_js = slug in RENDER_JS_PROFILES
        assert profile.discovery.fetch.render_js is expect_render_js
        assert profile.detail.fetch.render_js is expect_render_js
