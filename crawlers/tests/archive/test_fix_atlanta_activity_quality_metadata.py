from scripts.fix_atlanta_activity_quality_metadata import VENUE_METADATA_FIXES


def test_fix_pack_covers_core_audit_findings() -> None:
    assert VENUE_METADATA_FIXES["main-event-atlanta"]["venue_type"] == "entertainment"
    assert VENUE_METADATA_FIXES["metro-fun-center"]["website"] == "https://metrofuncenter.com/"
    assert VENUE_METADATA_FIXES["sparkles-family-fun-center-kennesaw"]["venue_type"] == "games"
    assert VENUE_METADATA_FIXES["stars-and-strikes-dacula"]["venue_type"] == "games"


def test_all_patched_websites_use_https() -> None:
    websites = [
        patch["website"]
        for patch in VENUE_METADATA_FIXES.values()
        if "website" in patch
    ]
    assert websites
    assert all(url.startswith("https://") for url in websites)
