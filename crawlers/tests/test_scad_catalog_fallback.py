from sources.scad_fash import (
    _extract_catalog_destination_fields_from_text,
    _extract_catalog_recent_examples,
)


SAMPLE_TEXT = """
SCAD FASH MUSEUMS
Captivating viewers with iconic looks from the runway to the screen, SCAD FASH
Museum of Fashion + Film in Atlanta and SCAD FASH Lacoste celebrate fashion as a
universal language, garments as important conduits of identity, and film as an
immersive and memorable medium.
RECENT SCAD FASH EXHIBITIONS
Christian Dior: Jardins Rêvés Campbell Addy: The Stillness of Elegance Jeanne
Lanvin: Haute Couture Heritage Sandy Powell’s Dressing the Part: Costume Design
for Film Imane Ayissi: From Africa to the World Manish Arora: Life Is Beautiful
Ruth E. Carter: Afrofuturism in Costume Design
SCAD FASH exhibitions like Christian Dior: Jardins Rêvés offer fresh contemplations.
"""


def test_extract_catalog_recent_examples_returns_present_titles():
    examples = _extract_catalog_recent_examples(SAMPLE_TEXT, limit=4)

    assert examples == [
        "Christian Dior: Jardins Rêvés",
        "Campbell Addy: The Stillness of Elegance",
        "Jeanne Lanvin: Haute Couture Heritage",
        "Sandy Powell’s Dressing the Part: Costume Design for Film",
    ]


def test_extract_catalog_destination_fields_builds_destination_first_notes():
    updates = _extract_catalog_destination_fields_from_text(SAMPLE_TEXT)

    assert updates is not None
    assert updates["website"] == "https://scadfash.org"
    assert "fashion as a universal language" in updates["short_description"].lower()
    assert "Cloudflare-blocked" in updates["planning_notes"]
    assert "Christian Dior: Jardins Rêvés" in updates["planning_notes"]
