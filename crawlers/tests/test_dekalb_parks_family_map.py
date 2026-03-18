from sources.dekalb_parks_family_map import (
    _build_envelope,
    _extract_region_entries,
    _is_supported_family_destination,
    _parse_aquatics_entries,
)


def test_extract_region_entries_parses_multiple_parks_from_inventory_block():
    html = """
    <html>
      <body>
        <p>
          <strong>Exchange</strong><br/>
          2771 Columbia Dr., Decatur<br/>
          Acres: 173<br/>
          Baseball, softball, football, multi-use field, tennis courts, playground, picnic area, lake and trails<br/><br/>
          <strong>Midway/Recreation Center</strong><br/>
          3181 Midway Rd., Decatur (404) 286-3328<br/>
          Acres: 22<br/>
          Baseball, softball, football, multi-use field, tennis courts, swimming pool, recreation center, playground, picnic area and trails
        </p>
      </body>
    </html>
    """

    entries = _extract_region_entries(html, "https://www.dekalbcountyga.gov/parks/decatur")

    assert [entry["name"] for entry in entries] == ["Exchange", "Midway/Recreation Center"]
    assert entries[0]["address"] == "2771 Columbia Dr."
    assert entries[0]["city"] == "Decatur"
    assert entries[0]["destination_type"] == "park"
    assert "playground" in entries[0]["amenities_text"].lower()
    assert entries[1]["destination_type"] == "community_recreation_center"
    assert "swimming pool" in entries[1]["amenities_text"].lower()


def test_parse_aquatics_entries_extracts_pool_and_splash_rows():
    html = """
    <html>
      <body>
        <p><strong>Pool Location and Hours</strong></p>
        <p>Gresham Pool- 3113 Gresham Rd. Atlanta, GA 30319, (404)244-4937</p>
        <p>Medlock Pool - 874 Gaylemont Circle Decatur, GA 30033, (404)679-5926</p>
        <p><strong>Splash Pad Location and Hours</strong></p>
        <p>Exchange Splash Pad - 2771 Columbia Dr. Decatur, GA 30034</p>
      </body>
    </html>
    """

    entries = _parse_aquatics_entries(html)

    assert [entry["name"] for entry in entries] == [
        "Gresham Pool",
        "Medlock Pool",
        "Exchange Splash Pad",
    ]
    assert entries[0]["address"] == "3113 Gresham Rd."
    assert entries[0]["city"] == "Atlanta"
    assert entries[1]["city"] == "Decatur"
    assert entries[2]["kind"] == "splash_pad"


def test_supported_family_destination_excludes_golf_only_rows():
    assert not _is_supported_family_destination(
        {
            "name": "Mystery Valley Golf Course",
            "amenities_text": "18-hole golf course and clubhouse",
        }
    )
    assert _is_supported_family_destination(
        {
            "name": "Exchange",
            "amenities_text": "playground, picnic area, lake and trails",
        }
    )


def test_build_envelope_adds_deeper_park_features():
    entry = {
        "name": "Exchange",
        "source_url": "https://www.dekalbcountyga.gov/parks/decatur",
        "destination_type": "park",
    }

    envelope = _build_envelope(
        entry,
        venue_id=88,
        add_destination_details=False,
        add_playground_feature=False,
        add_water_play_feature=False,
        add_trail_feature=False,
        add_rec_center_feature=False,
        add_sports_feature=True,
        add_picnic_feature=True,
        add_nature_feature=True,
    )

    assert {feature["slug"] for feature in envelope.venue_features} == {
        "official-county-youth-sports-fields",
        "official-county-picnic-pavilions",
        "official-county-nature-and-open-space",
    }
