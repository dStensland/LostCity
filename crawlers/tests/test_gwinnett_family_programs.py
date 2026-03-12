from sources.gwinnett_family_programs import _build_tenant


def test_build_tenant_targets_family_tabs_only() -> None:
    tenant = _build_tenant()

    assert tenant.tenant_slug == "gwinnett-county-parks-recreation"
    assert tenant.crawl_tab_ids == ["930", "822", "821", "823", "955"]
    assert tenant.require_family_relevance is True
    assert "meditation" in tenant.skip_group_keywords
    assert "bachata" in tenant.skip_session_keywords
