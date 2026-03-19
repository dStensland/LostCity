from pathlib import Path

from scripts.audit_source_entity_capabilities import extract_declared_capabilities


ROOT = Path(__file__).resolve().parents[2]


def test_extract_declared_capabilities_reads_family_source() -> None:
    result = extract_declared_capabilities(
        ROOT / "crawlers" / "sources" / "atlanta_family_programs.py"
    )

    assert result["declared"] is True
    assert result["capabilities"]["events"] is True
    assert result["capabilities"]["programs"] is True


def test_extract_declared_capabilities_reads_destination_source() -> None:
    result = extract_declared_capabilities(
        ROOT / "crawlers" / "sources" / "dolls_head_trail.py"
    )

    assert result["declared"] is True
    assert result["capabilities"]["destinations"] is True
    assert result["capabilities"]["destination_details"] is True
    assert result["capabilities"]["venue_features"] is True
