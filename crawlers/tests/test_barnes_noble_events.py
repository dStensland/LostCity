from __future__ import annotations


def test_build_browser_launch_args_hides_window_on_macos(monkeypatch):
    from sources import barnes_noble_events as bn

    monkeypatch.setattr(bn.sys, "platform", "darwin")
    monkeypatch.delenv("CRAWLER_SHOW_BARNES_NOBLE_BROWSER", raising=False)

    args = bn._build_browser_launch_args()

    assert "--disable-blink-features=AutomationControlled" in args
    assert "--window-position=-2400,0" in args
    assert "--window-size=1280,900" in args


def test_build_browser_launch_args_keeps_window_visible_when_overridden(monkeypatch):
    from sources import barnes_noble_events as bn

    monkeypatch.setattr(bn.sys, "platform", "darwin")
    monkeypatch.setenv("CRAWLER_SHOW_BARNES_NOBLE_BROWSER", "1")

    args = bn._build_browser_launch_args()

    assert "--window-position=-2400,0" not in args
    assert "--window-size=1280,900" not in args
