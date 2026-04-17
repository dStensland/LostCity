# Additional News Sources — Research (Verified)

Status: verified against live RSS endpoints 2026-04-17. All claims below are
backed by actual `curl` + feedparser probes, not priors.

Probe scripts archived at `/tmp/probe_feeds{,2,3}.py`.

## Context

Atlanta portal currently pulls 27 sources. Strong coverage on civic,
arts/culture, food, neighborhoods. Thin on hard news, broadcast, sports,
Black-Atlanta community, community-specific publications.

Two things corrected from the first-pass doc after real probes:

1. **WABE is not ingestible.** Their server returns HTTP 403 to every
   User-Agent tried (Googlebot, Feedly, Chrome, NetNewsWire) on both the main
   feed URL and the known alternate. Active bot-detection, no RSS path works.
   Scratch from the list unless we build a JS-rendering workaround.
2. **Rolling Out is not an Atlanta source despite the HQ.** Its RSS returns
   50 entries 0d old, but inspecting titles confirms it's national Black
   entertainment/politics coverage: Chicago storms, Arizona State coaches,
   airlines, NFL salaries. No local Atlanta content. Scratch.

## Verified — confirmed live, recent, Atlanta-local

Evidence format: `entries · newest-age · category-fit`

| # | Source | URL | Evidence | Fit |
|---|---|---|---|---|
| 1 | **11Alive (WXIA)** | `https://www.11alive.com/feeds/syndication/rss/news/local` | 40 entries · 0d · all local (MARTA NextGen, Spelman, DeKalb crash, Acworth missing child) | Hard-news broadcast. Highest-confidence add. |
| 2 | **WSB-TV** | `https://www.wsbtv.com/arc/outboundfeeds/rss/?outputType=xml` | 15 entries · 0d · all local (Gwinnett police, Forsyth hospital, Apalachee shooting, Angel Reese to Dream) | Hard-news broadcast. Highest-confidence add. |
| 3 | **Fox 5 Atlanta** | `https://www.fox5atlanta.com/rss/category/news` | 25 entries · 0d · local but crime-heavy (DeKalb stabbing, drunk driver, firefighters shot at) | Broadcast. Will skew feed toward crime — consider the editorial fit. |
| 4 | **The Falcoholic** | `https://www.thefalcoholic.com/rss/index.xml` | 10 · 0d · all Falcons (Orhorhoro trade, mock draft, Bijan 5th-year option) | Sports (Falcons). Needs new `sports` category. |
| 5 | **Peachtree Hoops** | `https://www.peachtreehoops.com/rss/index.xml` | 10 · 0d · all Hawks (Knicks series, season grade, Miami loss) | Sports (Hawks). Needs new `sports` category. |
| 6 | **Atlanta Tribune** | `https://atlantatribune.com/feed/` | 6 · 0d · local (Marble Wines ATL expansion, Andrew Young Foundation $100M Peace Center, Fulton County voter registration) | Low volume but legit. Black-business angle. |
| 7 | **Atlanta Studies** | `https://www.atlantastudies.org/feed` | 10 · 3d · all Atlanta scholarship (13th Annual Symposium, Afro-self-determinism and Black Mecca, Cobb Stadium 1957) | Academic/culture. Very low volume, very high signal. |

That's **7 confirmed Atlanta-local sources.** Adding these brings us 27 → 34.

### Deferred — future opt-in only

**Atlanta Jewish Times** (`https://atlantajewishtimes.timesofisrael.com/feed/`)
is a legitimate community source (15 entries, 1d fresh) with an Atlanta/Israel
content mix. Deferred from portal default: Israel/Palestine is a political
landmine we don't need to step on for a go-out-in-the-city product. Keep
available as an opt-in when we ship user-curated feeds; not a portal-default.
See `feedback_avoid_israel_content.md` for the general rule.

## Verified — live but caveats

| Source | Evidence | Caveat | Recommendation |
|---|---|---|---|
| **GPB News** (`https://www.gpb.org/news/rss.xml`) | 20 · 0d · mixed | 60-70% NPR national wire (gasoline prices, Strait of Hormuz, ICE hiring, Netflix "Beef" review), 30-40% Georgia (State Election Board QR codes, Georgia rental-assistance crisis, Atlanta Film Festival 50th, "GPB morning headlines") | **Add with category filter** — only surface entries tagged/matching Georgia keywords. Worth the plumbing because GA-specific items are high-quality. |
| **Peach Pundit** (`https://peachpundit.com/feed/`) | 10 · 6d · GA politics | Opinion blog, strong voice. "Rick Jackson Buys the Blog" suggests ownership change. Not neutral reporting. | **Add if we want commentary**, skip if we want straight news. User call. |
| **Secret Atlanta** (`https://secretatlanta.co/feed/`) | 10 · 0d · Atlanta listicles | Quality skews listicle/clickbait: "23 Fun Things To Do", "Krispy Kreme Strawberry Glazed", "Teriyaki Madness coming to ATL". Free of sponsored-pattern matches but editorially shallow. | **Pass.** Doesn't meet our quality bar — reads like what we'd want to differentiate from, not partner with. |

## Confirmed dead, broken, or not usable

Tested, doesn't work. Each of these is a hard no, not a maybe.

| Source | Why | Status |
|---|---|---|
| **WABE** | HTTP 403 on every UA tried. Active bot detection. | Blocked, no path in |
| **AJC** | 404 on `/feed/`. Paywalled. | Blocked |
| **Atlanta Daily World** | 403 on all endpoints and UAs | Blocked |
| **Axios Atlanta** | No public RSS — `/local/atlanta/feed*` all 403/404 | No feed exists |
| **Atlanta Business Chronicle / Atlanta Inno** | Bizjournals paywall returns 403 | Blocked |
| **Politico Georgia** | 403 | Blocked |
| **Patch Atlanta** | 404 on every feed path | No feed |
| **Emory Wheel** | 403 on most UAs, the one 200 response returns 0 parseable entries | Unusable feed format |
| **GSU Signal** | SSL handshake errors (outdated TLS config) | Server broken |
| **GT Technique** | 200 OK but 0 entries parseable | Feed format broken |
| **Talking Chop** (Braves, SB Nation) | 200 OK, 800KB response, but 0 entries parseable by feedparser. Sister Falcoholic/Peachtree Hoops work fine. Something source-specific is broken. | Feed broken; revisit later |
| **Creative Loafing** | 200 OK, 0 entries on all URLs | Effectively dead |
| **Paste Magazine** | 200 with only "Hello world!" entry from 1459 days ago | Dead feed |
| **Stomp and Stammer** | Live feed, newest entry 1286 days old (Oct 2022) | Site dead |
| **Atlanta INtown** | TLSv1 handshake error — server won't negotiate modern TLS | Server broken |
| **Bitter Southerner** | 200 on `/feed/`, 141KB response, 0 entries parseable | Feed format incompatible |
| **ThreadATL** | 404 | Site dormant |
| **Jezebel Atlanta** | DNS resolution fails | Site dead |
| **Macon Newsroom** | DNS fails | Site dead |
| **Georgia Sun** | DNS fails | Site dead |
| **Beltline Blog** | 404 on every expected path | No feed exposed |
| **Reckon South** | 404 everywhere | No feed |
| **Georgia Voice** (LGBTQ+) | SSL handshake error | Server broken |
| **Georgia Public Policy Foundation** | Last post 1143 days old, feed malformed | Dead |
| **Mercer Center for Collaborative Journalism** | 0 entries | Dead |

## Sources whose name is misleading — do not add

Verified by title inspection. These look Atlanta-local but content isn't.

| Source | What it actually is | Why not |
|---|---|---|
| **Rolling Out** | National Black entertainment + political news | All 8 top titles are national (Chicago storms, Arizona State coach, fuel crisis, NFL salaries, AZ tornadoes). Based in Atlanta, but not about Atlanta. |
| **Atlanta Black Star** | National political/celebrity wire pretending at local flavor | All 8 top titles are Trump/RFK Jr./Erica Campbell national content. No Atlanta. |
| **The Current GA** | Coastal Georgia investigative (Savannah, Glynn, McIntosh, Midway) | Legitimate outlet but geographic mismatch. Add to a future coastal portal, not Atlanta. |
| **Prism** | National (their name resolves to "prismreports.org", not a Georgia pub) | Titles confirm: California parole, Ukrainian ICE detainee, Puerto Rican artist. Zero GA. |

## Checked the WABE blocker one more time

Tried: default requests UA, Chrome browser UA, Googlebot, Feedly fetcher,
NetNewsWire. All return 403 with a 4.8KB response body (which is their block
page, not the feed). They are intentionally blocking RSS readers. Options if
we really want WABE:

- **Workaround:** Run through a feed proxy service (Feed43, RSSHub) that
  renders and re-emits. Adds dependency and fragility.
- **Alternative:** GPB News (verified above) with keyword filter captures
  much of the same public-radio-voice civic/policy content.
- **Accept:** Skip WABE. It's the biggest miss but the cost to ingest is
  disproportionate.

## Recommendation (evidence-based)

### Add now — high confidence

1. **11Alive** — hard-news broadcast (atlanta portal)
2. **WSB-TV** — hard-news broadcast (atlanta portal)
3. **The Falcoholic** — sports (atlanta portal, new `sports` category)
4. **Peachtree Hoops** — sports (atlanta portal, new `sports` category)
5. **Atlanta Tribune** — Black-business, low volume (atlanta portal)
6. **Atlanta Studies** — academic/culture, very low volume (atlanta portal)

Lands us at 33 sources.

**Deferred:** Atlanta Jewish Times — Israel content sensitivity, see above.

### Add with editorial caveat — your call

8. **Fox 5 Atlanta** — broadcast, but expect crime-forward tone
9. **GPB News** — requires adding Georgia-keyword filter layer
10. **Peach Pundit** — GA politics commentary (opinion, not news)

If yes to all three: 37 sources.

### Explicit skip (with evidence, not gut)

- WABE, AJC, Atlanta Daily World, Axios, Atlanta Business Chronicle — blocked/paywalled, no path
- Rolling Out, Atlanta Black Star — names misleading, content is national not Atlanta
- The Current GA, Prism — not Atlanta geographically
- Paste, Stomp and Stammer, Creative Loafing, Atlanta INtown, Bitter Southerner,
  Talking Chop, GT Technique, Emory Wheel, GSU Signal — feeds broken or dead
- Secret Atlanta — editorially shallow, below quality bar
- Patch, Jezebel Atlanta, ThreadATL, Georgia Voice, Beltline Blog, etc. — no
  reachable RSS

### New `sports` category — plumbing needed

Adding Falcoholic/Peachtree Hoops requires:
1. Add `"sports"` to `VALID_CATEGORIES` in
   `crawlers/scrape_network_feeds.py:73`.
2. Add `"sports"` to `CIVIC_EXCLUDE_TITLE_KEYWORDS` in
   `web/lib/network-feed/fetch-network-feed.ts:33` so sports doesn't leak
   into the civic-filter view.
3. Consider whether the Atlanta feed should surface sports by default or
   gate behind an explicit chip — users who don't follow local sports will
   find "Falcons mock draft" noise.

## Future direction — user-curated feeds

(Retained from v1.)

The right long-term answer to "whose editorial voice is this" is letting
readers pick. Settings surface would show the full source catalog
(categories + sample titles) so users subscribe/unsubscribe per-source.
Power users add their own RSS URLs (moderated to prevent PR-wire spam).
Portal default becomes a starting recommendation; each user's feed is a
personalized subset. Out of scope for this pass; revisit after baseline
coverage is respectable.

## Implementation checklist (per source)

1. Confirm RSS URL still returns 200 + recent entries (our probe cache is
   from 2026-04-17; drift is possible).
2. `INSERT INTO network_sources` with correct `owner_portal_id`, `categories`,
   `is_active = true`.
3. `python3 crawlers/scrape_network_feeds.py --source <slug> --dry-run --limit 10`
   — confirm ingest works and sponsored-filter doesn't trip legit content.
4. Run without `--dry-run` once clean.
5. Spot-check the source's posts in the Atlanta portal's "Today in Atlanta"
   section after the next pipeline pass.
6. For sports sources: first add `"sports"` to the category allowlist and
   civic-exclude list (see "New `sports` category" above).
