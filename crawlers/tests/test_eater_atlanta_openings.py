from sources.eater_atlanta_openings import (
    ArticleMetadata,
    build_venue_data,
    is_roundup_article,
    select_restaurant_name,
)


def test_is_roundup_article_detects_list_story():
    assert is_roundup_article(
        "Highly Anticipated Restaurant Openings in Atlanta, 2026",
        "Busy Bee Cafe heads to Centennial Yards; Lucian Books and Wine to open Sargent.",
    )


def test_select_restaurant_name_prefers_emphasized_term():
    article_meta = ArticleMetadata(
        image_url=None,
        meta_description="So. Fox will open next door to Kinship in Virginia-Highland this spring.",
        lead_text="The duo behind Kinship is now opening So. Fox next door.",
        emphasized_terms=["So. Fox"],
    )
    name = select_restaurant_name(
        title="Kinship Butcher & Sundry Team to Open New Restaurant",
        description="The duo behind Kinship is in expansion mode.",
        article_url="https://atlanta.eater.com/openings/86874/kinship-butcher-sundry-new-restaurant-so-fox-atlanta",
        article_meta=article_meta,
    )
    assert name == "So. Fox"


def test_build_venue_data_uses_restaurant_venue_when_identified():
    article_meta = ArticleMetadata(
        image_url=None,
        meta_description="Here is a look inside Ikara, expected to open at Atlantic Station this winter.",
        lead_text="Ikara will replace Allora in the Twelve Midtown building.",
        emphasized_terms=[],
    )
    venue_data, is_specific = build_venue_data(
        title="A Gorgeous Indian Fine Dining Restaurant Is Taking Over Allora at Atlantic Station",
        description="Ikara will replace Italian restaurant Allora.",
        article_url="https://atlanta.eater.com/openings/86701/new-indian-fine-dining-restaurant-ikara-atlantic-station-atlanta",
        article_meta=article_meta,
    )
    assert is_specific is True
    assert venue_data["name"] == "Ikara"
    assert venue_data["venue_type"] == "restaurant"
    assert venue_data["neighborhood"] == "Atlantic Station"


def test_build_venue_data_falls_back_for_roundup():
    article_meta = ArticleMetadata(
        image_url=None,
        meta_description="A list of opening restaurants this year.",
        lead_text="Many different restaurant projects are coming soon.",
        emphasized_terms=[],
    )
    venue_data, is_specific = build_venue_data(
        title="Highly Anticipated Restaurant Openings in Atlanta, 2026",
        description="A broad look at upcoming restaurant openings.",
        article_url="https://atlanta.eater.com/openings/86653/highly-anticipated-restaurant-openings-atlanta-2026",
        article_meta=article_meta,
    )
    assert is_specific is False
    assert venue_data["slug"] == "atlanta-restaurant-scene"


def test_select_restaurant_name_from_first_look_title():
    article_meta = ArticleMetadata(
        image_url=None,
        meta_description="A first look inside Luella in Buckhead.",
        lead_text="Luella opens this month in Buckhead.",
        emphasized_terms=[],
    )
    name = select_restaurant_name(
        title="First Look at Luella: Buckhead’s Newest Spot for Steak, Pasta, and Sushi",
        description="A first look at Luella in Buckhead.",
        article_url="https://atlanta.eater.com/restaurant-news/86260/luella-buckhead-steakhouse-photos",
        article_meta=article_meta,
    )
    assert name == "Luella"
