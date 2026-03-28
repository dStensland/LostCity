from sources.cobb_parks_family_map import (
    _build_envelope,
    _extract_detail_paths,
    _maybe_patch_existing_venue,
    _parse_park_page,
)


def test_extract_detail_paths_dedupes_park_links() -> None:
    html = """
    <html><body>
      <a href="/parks/find-park/east-cobb-park">East Cobb Park</a>
      <a href="/parks/find-park/east-cobb-park">East Cobb Park</a>
      <a href="/parks/find-park/fullers-park">Fullers Park</a>
      <a href="/not-a-park">Ignore</a>
    </body></html>
    """
    assert _extract_detail_paths(html) == [
        "/parks/find-park/east-cobb-park",
        "/parks/find-park/fullers-park",
    ]


def test_parse_park_page_reads_next_data_fields() -> None:
    html = """
    <html><body>
      <script id="__NEXT_DATA__" type="application/json">
      {
        "props": {
          "pageProps": {
            "nodeResource": {
              "title": "East Cobb Park",
              "summary": "A family park with playgrounds and walking trails.",
              "address": {
                "addressLine1": "3322 Roswell Road",
                "locality": "Marietta",
                "administrativeArea": "GA",
                "postalCode": "30068"
              },
              "sidebarContent": {
                "processed": "<ul><li><strong>Playgrounds:</strong> Two playgrounds.</li><li><strong>Trails:</strong> Walking loop.</li></ul>"
              }
            }
          }
        }
      }
      </script>
    </body></html>
    """
    parsed = _parse_park_page(html, "https://www.cobbcounty.gov/parks/find-park/east-cobb-park")
    assert parsed["name"] == "East Cobb Park"
    assert parsed["slug"] == "east-cobb-park"
    assert parsed["address"] == "3322 Roswell Road"
    assert parsed["city"] == "Marietta"
    assert "Playgrounds: Two playgrounds." in parsed["feature_lines"]


def test_build_envelope_adds_family_park_features() -> None:
    park = {
        "name": "East Cobb Park",
        "url": "https://www.cobbcounty.gov/parks/find-park/east-cobb-park",
        "summary": "A family park with playgrounds and trails.",
        "feature_lines": [
            "Playgrounds: Two playgrounds, one upper and one lower.",
            "Trails: Walking paths and loop.",
            "Splash Pad: Seasonal water play area.",
        ],
    }
    envelope = _build_envelope(
        park,
        venue_id=99,
        add_destination_details=True,
        add_playground_feature=True,
        add_water_play_feature=True,
        add_trail_feature=True,
        add_sports_feature=True,
        add_picnic_feature=True,
        add_nature_feature=False,
    )
    assert envelope.destination_details[0]["destination_type"] == "park"
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "official-county-playground",
        "official-county-water-play",
        "official-county-trails-and-walking-loops",
        "official-county-youth-sports-fields",
        "official-county-picnic-pavilions",
    }


def test_maybe_patch_existing_venue_backfills_missing_location_fields() -> None:
    updates: list[tuple[dict, int]] = []

    class _FakeQuery:
        def __init__(self, payload: dict) -> None:
            self.payload = payload

        def eq(self, field: str, value: int) -> "_FakeQuery":
            updates.append((self.payload, value))
            return self

        def execute(self) -> object:
            return object()

    class _FakeClient:
        def table(self, name: str) -> "_FakeClient":
            assert name == "places"
            return self

        def update(self, payload: dict) -> _FakeQuery:
            return _FakeQuery(payload)

    venue = {
        "id": 2008,
        "name": "Allatoona Creek Park",
        "address": "5690 Old Stilesboro Rd NW, Acworth, GA 30101, USA",
        "city": None,
        "state": None,
        "zip": "30101",
    }
    park = {
        "address": "5690 Old Stilesboro Road",
        "city": "Acworth",
        "state": "GA",
        "zip": "30101",
    }

    patched = _maybe_patch_existing_venue(_FakeClient(), venue, park)

    assert patched["city"] == "Acworth"
    assert patched["state"] == "GA"
    assert updates == [({"city": "Acworth", "state": "GA"}, 2008)]
