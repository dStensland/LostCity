from sources.milton_parks_rec import _build_tenant


def test_build_tenant_targets_family_tabs_only() -> None:
    tenant = _build_tenant()

    assert tenant.tenant_slug == "city-of-milton"
    assert tenant.crawl_tab_ids == ["1357", "16620", "22636", "26452", "26453", "22291"]
    assert "after camp care" in tenant.skip_group_keywords
    assert tenant.default_venue.city == "Milton"
