from sources.city_winery import derive_category, map_genres


# ---------------------------------------------------------------------------
# map_genres
# ---------------------------------------------------------------------------


def test_map_genres_comedy_tag():
    assert map_genres(["COMEDY"]) == ["comedy"]


def test_map_genres_unknown_tag_falls_back_to_live_music():
    assert map_genres(["UNKNOWN_TAG"]) == ["live-music"]


def test_map_genres_empty_returns_live_music():
    assert map_genres([]) == ["live-music"]


def test_map_genres_none_returns_live_music():
    assert map_genres(None) == ["live-music"]


def test_map_genres_multiple_tags():
    result = map_genres(["JAZZ", "SOUL"])
    assert "jazz" in result
    assert "soul" in result


# ---------------------------------------------------------------------------
# derive_category — comedy
# ---------------------------------------------------------------------------


def test_comedy_genre_alone_gives_comedy():
    assert derive_category(["comedy"], "Some Comic Live") == "comedy"


def test_stand_up_genre_gives_comedy():
    assert derive_category(["stand-up"], "Open Mic Night") == "comedy"


def test_comedy_with_live_music_stays_music():
    # If the API tags the show as BOTH comedy and live-music it's a variety
    # show headlined by a musician — keep it as music.
    assert derive_category(["comedy", "live-music"], "Comedy & Music Night") == "music"


# ---------------------------------------------------------------------------
# derive_category — nightlife
# ---------------------------------------------------------------------------


def test_drag_genre_gives_nightlife():
    assert derive_category(["drag"], "Drag Extravaganza") == "nightlife"


# ---------------------------------------------------------------------------
# derive_category — food_drink
# ---------------------------------------------------------------------------


def test_tasting_keyword_gives_food_drink():
    assert derive_category(["live-music"], "Wine Tasting Evening") == "food_drink"


def test_dinner_keyword_gives_food_drink():
    assert derive_category(["live-music"], "Jazz Dinner Series") == "food_drink"


def test_brunch_keyword_gives_food_drink():
    assert derive_category(["live-music"], "Sunday Brunch with Live Music") == "food_drink"


def test_chef_keyword_gives_food_drink():
    assert derive_category([], "Chef Collaboration Night") == "food_drink"


def test_winemaker_keyword_gives_food_drink():
    assert derive_category(["live-music"], "Winemaker Dinner") == "food_drink"


# ---------------------------------------------------------------------------
# derive_category — default music
# ---------------------------------------------------------------------------


def test_music_genres_give_music():
    assert derive_category(["jazz", "soul"], "Late Night Jazz") == "music"


def test_live_music_fallback_genre_gives_music():
    assert derive_category(["live-music"], "An Evening of Song") == "music"


def test_empty_genres_no_keywords_give_music():
    assert derive_category([], "Artist Name Live") == "music"


# ---------------------------------------------------------------------------
# derive_category — priority order
# ---------------------------------------------------------------------------


def test_comedy_takes_priority_over_food_drink():
    # A comedy dinner show: comedy genre should win over title keyword.
    assert derive_category(["comedy"], "Comedy Dinner Show") == "comedy"


def test_drag_takes_priority_over_food_drink():
    assert derive_category(["drag"], "Drag Brunch") == "nightlife"
