from sources.scad_atlanta import _is_cloudflare_challenge
from sources.scad_fash import _is_cloudflare_challenge_text


def test_scad_atlanta_detects_cloudflare_challenge():
    html = "<html><title>Just a moment...</title><body>Enable JavaScript and cookies to continue</body></html>"

    assert _is_cloudflare_challenge(html) is True


def test_scad_fash_detects_cloudflare_challenge():
    html = "<html><body>Attention Required! | Cloudflare</body></html>"

    assert _is_cloudflare_challenge_text(html) is True
