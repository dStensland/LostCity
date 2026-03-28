#!/usr/bin/env python3
"""
Comprehensive Feed Block Analysis
Evaluates Regular Hangs (The Scene), Lineup, and Big Stuff blocks.
"""

import sys
import re
from collections import defaultdict, Counter
from datetime import datetime, timedelta

sys.path.insert(0, '.')
from db import get_client

client = get_client()

DATE_START = '2026-03-01'
DATE_END = '2026-03-07'

# ─────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────

def fetch_events_paged(query_builder, page_size=1000):
    """Fetch all rows using offset-based pagination to avoid the 1000-row cap."""
    all_rows = []
    offset = 0
    while True:
        page = query_builder.range(offset, offset + page_size - 1).execute()
        all_rows.extend(page.data)
        if len(page.data) < page_size:
            break
        offset += page_size
    return all_rows


def fetch_all_events():
    """Fetch all active events in the date range with venue names."""
    q = (client.table('events')
         .select('id,title,start_date,category_id,genres,tags,is_recurring,series_id,'
                 'is_class,is_sensitive,is_tentpole,festival_id,is_featured,'
                 'image_url,description,ticket_url,venue_id,content_kind')
         .eq('is_active', True)
         .gte('start_date', DATE_START)
         .lte('start_date', DATE_END))
    events = fetch_events_paged(q)

    # Fetch venue names
    venue_ids = list(set(e['venue_id'] for e in events if e.get('venue_id')))
    venue_map = {}
    # Batch fetch venues (supabase has URL length limits, do 200 at a time)
    for i in range(0, len(venue_ids), 200):
        batch = venue_ids[i:i+200]
        filter_str = ','.join(str(v) for v in batch)
        vq = client.table('places').select('id,name,neighborhood').in_('id', batch)
        vdata = fetch_events_paged(vq)
        for v in vdata:
            venue_map[v['id']] = v

    for e in events:
        vid = e.get('venue_id')
        v = venue_map.get(vid, {})
        e['venue_name'] = v.get('name', 'Unknown')
        e['neighborhood'] = v.get('neighborhood', '')

    return events


# ─────────────────────────────────────────────────────────────────────
# Activity type matching for Regular Hangs
# ─────────────────────────────────────────────────────────────────────

ACTIVITY_TYPES = {
    'trivia': {
        'genres': {'trivia'},
        'title_re': re.compile(r'trivia|pub quiz', re.I),
    },
    'karaoke': {
        'genres': {'karaoke'},
        'title_re': re.compile(r'karaoke', re.I),
    },
    'comedy': {
        'genres': {'comedy', 'stand-up', 'standup', 'improv'},
        'category': 'comedy',
        'title_re': re.compile(r'comedy|stand.up|\bimprov\b', re.I),
    },
    'bingo': {
        'genres': {'bingo'},
        'title_re': re.compile(r'bingo', re.I),
    },
    'dj': {
        'genres': {'dj', 'electronic', 'edm'},
        'title_re': None,
    },
    'drag': {
        'genres': {'drag'},
        'title_re': re.compile(r'drag (show|brunch|bingo|night)', re.I),
    },
    'nerd_stuff': {
        'genres': {'dnd', 'tabletop', 'mtg', 'magic-the-gathering', 'warhammer',
                   'board-games', 'card-games', 'video-games', 'miniatures', 'game-night'},
        'title_re': re.compile(r'\bgame night\b|board game|d&d|dungeons|warhammer|magic.the.gathering', re.I),
    },
    'bar_games': {
        'genres': {'bar-games', 'bowling', 'bocce', 'skee-ball', 'curling', 'darts',
                   'shuffleboard', 'pool', 'billiards', 'cornhole', 'axe-throwing', 'ping-pong'},
        'title_re': re.compile(r'bowl|skee.?ball|darts|shuffleboard|bocce|cornhole|billiards|curling', re.I),
    },
    'food_specials': {
        'genres': {'specials', 'happy-hour', 'wings', 'taco', 'burger', 'crawfish'},
        'title_re': re.compile(r'happy hour|wing night|taco|burger night|crawfish', re.I),
    },
    'brunch': {
        'genres': {'brunch', 'bottomless'},
        'title_re': re.compile(r'brunch', re.I),
    },
    'jazz_blues': {
        'genres': {'jazz', 'blues', 'jazz-blues'},
        'title_re': re.compile(r'jazz|blues', re.I),
    },
    'dance': {
        'genres': {'dance-party', 'dance-night', 'line-dancing'},
        'title_re': re.compile(r'dance party|dance night', re.I),
    },
    'poker': {
        'genres': {'poker'},
        'title_re': re.compile(r'poker', re.I),
    },
    'line_dancing': {
        'genres': {'line-dancing', 'country-dance', 'two-step'},
        'title_re': re.compile(r'line danc|two.step|country dance', re.I),
    },
    'latin_night': {
        'genres': {'latin-night', 'bachata', 'salsa-night', 'reggaeton'},
        'title_re': re.compile(r'latin night|bachata|salsa night|reggaeton', re.I),
    },
    'run_fitness': {
        'genres': {'running', 'run-club', 'fitness', '5k', '10k'},
        'title_re': re.compile(r'run club|running|5k|10k', re.I),
    },
    'viewing_party': {
        'genres': {'viewing-party', 'watch-party'},
        'title_re': re.compile(r'watch party|viewing party|game day', re.I),
    },
    'tasting': {
        'genres': {'tasting', 'wine-tasting', 'beer-tasting', 'whiskey'},
        'title_re': re.compile(r'tasting|wine night|beer flight', re.I),
    },
    'skate_night': {
        'genres': {'skating', 'roller-skating', 'ice-skating'},
        'title_re': re.compile(r'skate night|roller skat', re.I),
    },
    'open_mic': {
        'genres': {'open-mic', 'openmic'},
        'title_re': re.compile(r'open mic', re.I),
    },
    'live_music': {
        'genres': set(),  # catchall for category=music
        'category': 'music',
        'title_re': None,
    },
}


EXCLUDE_TAGS = {'touring', 'album-release', 'one-night-only'}
EXCLUDE_CATEGORIES = {'film', 'theater', 'community', 'wellness', 'family', 'learning', 'words'}


def classify_activity(event):
    """Return list of activity types an event matches."""
    genres = set(event.get('genres') or [])
    title = event.get('title') or ''
    cat = event.get('category_id') or ''

    matched = []
    for atype, rules in ACTIVITY_TYPES.items():
        # Genre match
        if rules['genres'] & genres:
            matched.append(atype)
            continue
        # Category match (for comedy, live_music)
        if rules.get('category') and cat == rules['category']:
            matched.append(atype)
            continue
        # Title regex match
        if rules.get('title_re') and rules['title_re'].search(title):
            matched.append(atype)
            continue

    return matched


def is_scene_eligible(event):
    """Check if event passes the Regular Hangs filter (before activity matching)."""
    # Must be recurring or have series_id
    if not (event.get('is_recurring') or event.get('series_id')):
        return False
    # Exclusions
    if event.get('is_class'):
        return False
    if event.get('is_sensitive'):
        return False
    if event.get('is_tentpole'):
        return False
    if event.get('festival_id'):
        return False
    # Tag exclusions
    tags = set(event.get('tags') or [])
    if tags & EXCLUDE_TAGS:
        return False
    # Category exclusions
    cat = event.get('category_id') or ''
    if cat in EXCLUDE_CATEGORIES:
        return False
    return True


# ─────────────────────────────────────────────────────────────────────
# Block classification
# ─────────────────────────────────────────────────────────────────────

def classify_blocks(events):
    """Classify all events into the three blocks."""
    scene_events = []      # Regular Hangs
    big_stuff_events = []  # Big Stuff
    lineup_events = []     # Lineup

    scene_ids = set()
    big_stuff_ids = set()
    lineup_ids = set()

    for e in events:
        eid = e['id']

        # ── Big Stuff ──
        if e.get('is_tentpole') or e.get('festival_id'):
            big_stuff_events.append(e)
            big_stuff_ids.add(eid)
            continue

        # ── Regular Hangs candidate ──
        if is_scene_eligible(e):
            activities = classify_activity(e)
            e['_activities'] = activities
            if activities:
                scene_events.append(e)
                scene_ids.add(eid)
                continue
            else:
                # Recurring but no activity match — track separately
                e['_activities'] = []
                e['_unmatched_recurring'] = True

        # ── Lineup ──
        # Exclude classes, sensitive, tentpole, festival (already handled)
        if e.get('is_class') or e.get('is_sensitive'):
            continue
        # Exclude film series (category=film AND series_id set)
        cat = e.get('category_id') or ''
        if cat == 'film' and e.get('series_id'):
            continue
        # Exclude recurring without premium tags (already handled scene-eligible ones)
        # If it was scene-eligible but unmatched, it's still recurring — skip from lineup
        if e.get('_unmatched_recurring'):
            # These are recurring events that don't match any activity — they fall through
            # We'll still track them
            pass

        lineup_events.append(e)
        lineup_ids.add(eid)

    return scene_events, lineup_events, big_stuff_events, scene_ids, lineup_ids, big_stuff_ids


# ─────────────────────────────────────────────────────────────────────
# Reporting
# ─────────────────────────────────────────────────────────────────────

def print_separator(title):
    print()
    print('=' * 80)
    print(f'  {title}')
    print('=' * 80)


def report_scene(scene_events, all_events):
    """Report on Regular Hangs (The Scene) block."""
    print_separator('1. REGULAR HANGS (The Scene)')

    # Count unmatched recurring
    unmatched = [e for e in all_events if e.get('_unmatched_recurring')]

    # Activity type breakdown
    activity_counts = Counter()
    activity_samples = defaultdict(list)

    for e in scene_events:
        for a in e.get('_activities', []):
            activity_counts[a] += 1
            if len(activity_samples[a]) < 3:
                activity_samples[a].append(e)

    print(f'\n  Total Scene events: {len(scene_events)}')
    print(f'  Unmatched recurring (excluded from Scene): {len(unmatched)}')
    print(f'  Events per day avg: {len(scene_events)/7:.1f}')

    print(f'\n  {"Activity Type":<20} {"Count":>6}   Sample Events')
    print(f'  {"─"*20} {"─"*6}   {"─"*48}')

    for atype, count in sorted(activity_counts.items(), key=lambda x: -x[1]):
        samples = activity_samples[atype]
        sample_str = ', '.join(f'"{s["title"][:40]}"' for s in samples[:2])
        print(f'  {atype:<20} {count:>6}   {sample_str}')

    # Day-of-week breakdown
    print(f'\n  Per-day breakdown:')
    day_counts = Counter()
    for e in scene_events:
        day_counts[e['start_date']] += 1
    for d in sorted(day_counts.keys()):
        dow = datetime.strptime(d, '%Y-%m-%d').strftime('%A')
        print(f'    {d} ({dow:>9}): {day_counts[d]:>4} events')

    # Unmatched recurring sample
    if unmatched:
        print(f'\n  Unmatched recurring events (sample, max 15):')
        for e in unmatched[:15]:
            genres = e.get('genres') or []
            cat = e.get('category_id', '')
            print(f'    - [{cat}] "{e["title"][:55]}" @ {e["venue_name"][:25]} | genres: {genres}')

    # Category distribution within Scene
    cat_counts = Counter(e.get('category_id', 'none') for e in scene_events)
    print(f'\n  Category distribution within Scene:')
    for cat, cnt in sorted(cat_counts.items(), key=lambda x: -x[1]):
        print(f'    {cat or "none":<20} {cnt:>4}')


def report_lineup(lineup_events):
    """Report on Lineup block."""
    print_separator('2. LINEUP')

    print(f'\n  Total Lineup events: {len(lineup_events)}')
    print(f'  Events per day avg: {len(lineup_events)/7:.1f}')

    # Category breakdown
    cat_counts = Counter(e.get('category_id', 'none') for e in lineup_events)
    print(f'\n  Category breakdown:')
    for cat, cnt in sorted(cat_counts.items(), key=lambda x: -x[1]):
        print(f'    {cat or "none":<20} {cnt:>4}')

    # Per-day counts
    print(f'\n  Per-day breakdown:')
    day_counts = Counter()
    for e in lineup_events:
        day_counts[e['start_date']] += 1
    for d in sorted(day_counts.keys()):
        dow = datetime.strptime(d, '%Y-%m-%d').strftime('%A')
        print(f'    {d} ({dow:>9}): {day_counts[d]:>4} events')

    # Quality signals
    has_image = sum(1 for e in lineup_events if e.get('image_url'))
    has_desc = sum(1 for e in lineup_events if e.get('description') and len(e['description']) > 50)
    has_ticket = sum(1 for e in lineup_events if e.get('ticket_url'))
    has_all = sum(1 for e in lineup_events if e.get('image_url') and e.get('description') and e.get('ticket_url'))

    print(f'\n  Quality signals:')
    print(f'    Has image:       {has_image:>4} ({has_image/max(len(lineup_events),1)*100:.0f}%)')
    print(f'    Has description: {has_desc:>4} ({has_desc/max(len(lineup_events),1)*100:.0f}%)')
    print(f'    Has ticket URL:  {has_ticket:>4} ({has_ticket/max(len(lineup_events),1)*100:.0f}%)')
    print(f'    Has all three:   {has_all:>4} ({has_all/max(len(lineup_events),1)*100:.0f}%)')

    # Top 10 by quality (score = image + desc + ticket + featured)
    def quality_score(e):
        score = 0
        if e.get('image_url'): score += 1
        if e.get('description') and len(e['description']) > 50: score += 1
        if e.get('ticket_url'): score += 1
        if e.get('is_featured'): score += 2
        return score

    top = sorted(lineup_events, key=quality_score, reverse=True)[:10]
    print(f'\n  Top 10 events by quality score:')
    for i, e in enumerate(top, 1):
        qs = quality_score(e)
        cat = e.get('category_id', '')
        print(f'    {i:>2}. [{cat}] "{e["title"][:50]}" @ {e["venue_name"][:25]} (score={qs})')

    # Check for recurring events that leaked into lineup
    recurring_in_lineup = [e for e in lineup_events if e.get('is_recurring') or e.get('series_id')]
    print(f'\n  Recurring/series events in Lineup: {len(recurring_in_lineup)}')
    if recurring_in_lineup:
        print(f'  (These are recurring events that passed through because they were in excluded categories or had premium tags)')
        for e in recurring_in_lineup[:10]:
            tags = e.get('tags') or []
            cat = e.get('category_id', '')
            genres = e.get('genres') or []
            recur = 'recurring' if e.get('is_recurring') else 'series'
            print(f'    - [{cat}] ({recur}) "{e["title"][:45]}" | tags={tags} genres={genres}')


def report_big_stuff(big_stuff_events):
    """Report on Big Stuff block."""
    print_separator('3. BIG STUFF')

    print(f'\n  Total Big Stuff events: {len(big_stuff_events)}')

    if not big_stuff_events:
        print('  (No tentpole or festival events in this date range)')
        return

    # Category breakdown
    cat_counts = Counter(e.get('category_id', 'none') for e in big_stuff_events)
    print(f'\n  Category breakdown:')
    for cat, cnt in sorted(cat_counts.items(), key=lambda x: -x[1]):
        print(f'    {cat or "none":<20} {cnt:>4}')

    # List all
    print(f'\n  All Big Stuff events:')
    for e in sorted(big_stuff_events, key=lambda x: x['start_date']):
        cat = e.get('category_id', '')
        tent = 'tentpole' if e.get('is_tentpole') else 'festival'
        fid = e.get('festival_id', '')
        print(f'    [{e["start_date"]}] [{cat}] ({tent}) "{e["title"][:50]}" @ {e["venue_name"][:30]}')
        if fid:
            print(f'      festival_id={fid}')


def report_overlaps(scene_ids, lineup_ids, big_stuff_ids):
    """Check for events appearing in multiple blocks."""
    print_separator('4. OVERLAP CHECK')

    scene_lineup = scene_ids & lineup_ids
    scene_big = scene_ids & big_stuff_ids
    lineup_big = lineup_ids & big_stuff_ids
    all_three = scene_ids & lineup_ids & big_stuff_ids

    print(f'\n  Scene & Lineup overlap:    {len(scene_lineup)} events')
    print(f'  Scene & Big Stuff overlap: {len(scene_big)} events')
    print(f'  Lineup & Big Stuff overlap: {len(lineup_big)} events')
    print(f'  All three blocks overlap:  {len(all_three)} events')

    if scene_lineup or scene_big or lineup_big:
        print('\n  WARNING: Overlapping events found!')
        if scene_lineup:
            print(f'  Scene & Lineup overlapping IDs: {list(scene_lineup)[:10]}')
        if scene_big:
            print(f'  Scene & Big Stuff overlapping IDs: {list(scene_big)[:10]}')
        if lineup_big:
            print(f'  Lineup & Big Stuff overlapping IDs: {list(lineup_big)[:10]}')
    else:
        print('\n  No overlaps detected. Event routing is clean.')


def report_summary(scene_events, lineup_events, big_stuff_events):
    """Summary comparison table."""
    print_separator('5. SUMMARY TABLE')

    total = len(scene_events) + len(lineup_events) + len(big_stuff_events)

    def top_cats(events, n=3):
        cats = Counter(e.get('category_id', 'none') for e in events)
        return ', '.join(f'{c}({n})' for c, n in cats.most_common(n))

    def health(events, block):
        if block == 'scene':
            if len(events) < 50:
                return 'LOW - needs more recurring events'
            elif len(events) > 300:
                return 'HIGH - may need filtering'
            else:
                return 'HEALTHY'
        elif block == 'lineup':
            if len(events) < 30:
                return 'LOW - sparse calendar'
            elif len(events) > 500:
                return 'HIGH - may overwhelm users'
            else:
                return 'HEALTHY'
        elif block == 'big_stuff':
            if len(events) == 0:
                return 'EMPTY - no marquee events'
            elif len(events) > 20:
                return 'HIGH - too many tentpoles?'
            else:
                return 'HEALTHY'

    print(f'\n  {"Block":<22} {"Count":>6} {"Evts/Day":>9} {"% of Total":>11}  Top Categories                   Health')
    print(f'  {"─"*22} {"─"*6} {"─"*9} {"─"*11}  {"─"*32} {"─"*30}')

    rows = [
        ('Regular Hangs (Scene)', scene_events, 'scene'),
        ('Lineup', lineup_events, 'lineup'),
        ('Big Stuff', big_stuff_events, 'big_stuff'),
    ]

    for name, evts, block in rows:
        cnt = len(evts)
        per_day = cnt / 7
        pct = cnt / max(total, 1) * 100
        cats = top_cats(evts)
        h = health(evts, block)
        print(f'  {name:<22} {cnt:>6} {per_day:>9.1f} {pct:>10.0f}%  {cats:<32} {h}')

    print(f'\n  {"TOTAL":<22} {total:>6} {total/7:>9.1f} {"100%":>11}')

    # Events with no block assignment
    all_ids = set(e['id'] for e in scene_events + lineup_events + big_stuff_events)
    # We'd need all_events for this — pass it in

    print()


def report_unaccounted(all_events, scene_ids, lineup_ids, big_stuff_ids):
    """Events that didn't land in any block."""
    all_assigned = scene_ids | lineup_ids | big_stuff_ids
    unaccounted = [e for e in all_events if e['id'] not in all_assigned]

    print(f'\n  Unaccounted events (not in any block): {len(unaccounted)}')
    if unaccounted:
        # Breakdown by reason
        class_count = sum(1 for e in unaccounted if e.get('is_class'))
        sensitive_count = sum(1 for e in unaccounted if e.get('is_sensitive'))
        film_series = sum(1 for e in unaccounted if e.get('category_id') == 'film' and e.get('series_id'))
        unmatched_recurring = sum(1 for e in unaccounted if e.get('_unmatched_recurring'))

        print(f'    Classes:             {class_count}')
        print(f'    Sensitive:           {sensitive_count}')
        print(f'    Film series:         {film_series}')
        print(f'    Unmatched recurring:  {unmatched_recurring}')
        other = len(unaccounted) - class_count - sensitive_count - film_series - unmatched_recurring
        print(f'    Other:               {other}')

        if other > 0:
            others = [e for e in unaccounted
                      if not e.get('is_class') and not e.get('is_sensitive')
                      and not (e.get('category_id') == 'film' and e.get('series_id'))
                      and not e.get('_unmatched_recurring')]
            print(f'\n    "Other" unaccounted samples (max 10):')
            for e in others[:10]:
                cat = e.get('category_id', '')
                recur = 'recurring' if e.get('is_recurring') else ('series' if e.get('series_id') else 'one-off')
                tags = e.get('tags') or []
                genres = e.get('genres') or []
                tent = e.get('is_tentpole')
                fest = e.get('festival_id')
                print(f'      - [{cat}] ({recur}) "{e["title"][:50]}" @ {e["venue_name"][:25]}')
                print(f'        tags={tags}, genres={genres}, tentpole={tent}, festival={fest}')


# ─────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────

def main():
    print('=' * 80)
    print('  FEED BLOCK ANALYSIS')
    print(f'  Date range: {DATE_START} to {DATE_END}')
    print('=' * 80)

    print('\nFetching events...')
    all_events = fetch_all_events()
    print(f'Total active events in range: {len(all_events)}')

    # Classify into blocks
    scene_events, lineup_events, big_stuff_events, scene_ids, lineup_ids, big_stuff_ids = classify_blocks(all_events)

    # Reports
    report_scene(scene_events, all_events)
    report_lineup(lineup_events)
    report_big_stuff(big_stuff_events)
    report_overlaps(scene_ids, lineup_ids, big_stuff_ids)
    report_summary(scene_events, lineup_events, big_stuff_events)
    report_unaccounted(all_events, scene_ids, lineup_ids, big_stuff_ids)

    print('\n' + '=' * 80)
    print('  END OF ANALYSIS')
    print('=' * 80)


if __name__ == '__main__':
    main()
