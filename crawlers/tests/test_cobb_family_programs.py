from sources.cobb_family_programs import _build_tenant


def test_build_tenant_targets_family_tabs_only() -> None:
    tenant = _build_tenant()

    assert tenant.tenant_slug == "cobb-county-ga"
    assert tenant.crawl_tab_ids == ["4319", "20238", "4321", "4320", "4317"]
    assert tenant.require_family_relevance is True
    assert "pickleball" in tenant.skip_group_keywords
