#!/usr/bin/env python3
"""
Comprehensive Data Quality Audit for LostCity (FIXED - handles pagination)
"""

from db import get_client
from datetime import datetime, timedelta
import re
from collections import defaultdict

supabase = get_client()

VALID_CATEGORIES = {
    'music', 'film', 'comedy', 'theater', 'art', 'sports', 'food_drink', 
    'nightlife', 'community', 'fitness', 'family', 'learning', 'dance', 
    'tours', 'meetup', 'words', 'religious', 'markets', 'wellness', 
    'support_group', 'gaming', 'outdoors', 'other'
}

TODAY = datetime.now().date()
PAST_THRESHOLD = TODAY - timedelta(days=7)
FAR_FUTURE_THRESHOLD = TODAY + timedelta(days=365)

def print_section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print('='*80)

def get_all_events():
    """Fetch ALL events with pagination"""
    all_events = []
    page_size = 1000
    offset = 0
    
    print("Fetching all events from database...")
    while True:
        response = supabase.table('events').select(
            'id, title, start_date, start_time, venue_id, source_id, category, is_all_day, description'
        ).range(offset, offset + page_size - 1).execute()
        
        if not response.data:
            break
        
        all_events.extend(response.data)
        print(f"  Fetched {len(all_events)} events so far...")
        
        if len(response.data) < page_size:
            break
        
        offset += page_size
    
    print(f"Total events loaded: {len(all_events)}\n")
    return all_events

def get_all_venues():
    """Fetch ALL venues with pagination"""
    all_venues = []
    page_size = 1000
    offset = 0
    
    print("Fetching all venues from database...")
    while True:
        response = supabase.table('venues').select(
            'id, name, lat, lng, city, venue_type'
        ).range(offset, offset + page_size - 1).execute()
        
        if not response.data:
            break
        
        all_venues.extend(response.data)
        
        if len(response.data) < page_size:
            break
        
        offset += page_size
    
    print(f"Total venues loaded: {len(all_venues)}\n")
    return all_venues

def is_garbage_title(title):
    """Detect garbage event titles"""
    if not title or len(title.strip()) == 0:
        return "empty"
    
    title = title.strip()
    
    if len(title) < 3:
        return "too_short"
    if len(title) > 300:
        return "too_long"
    
    if title.replace(' ', '').replace('-', '').replace('/', '').replace(',', '').isdigit():
        return "numeric_only"
    
    if re.match(r'^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$', title):
        return "phone_number"
    
    if title.startswith('http://') or title.startswith('https://') or '.com' in title.lower():
        return "url_like"
    
    generic_words = {
        'events', 'calendar', 'add to calendar', 'view details', 
        'schedule', 'event', 'show', 'more info', 'details', 'buy tickets',
        'rsvp', 'register', 'sign up', 'learn more'
    }
    if title.lower() in generic_words:
        return "generic_word"
    
    if re.match(r'^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$', title):
        return "date_format_1"
    if re.match(r'^[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}$', title):
        return "date_format_2"
    if re.match(r'^\d{1,2}/\d{1,2}(/\d{2,4})?$', title):
        return "date_format_3"
    
    if re.match(r'^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\d{1,2}$', title):
        return "day_number"
    
    if re.match(r'^[A-Z]{3,9}\s+\d{4}$', title):
        return "month_header"
    
    # ALL CAPS short - but exclude artist names (common in music)
    # Only flag if it's really generic-looking
    if title.isupper() and len(title) < 15:
        # Exclude if it looks like a band/artist name
        if not any(word in title.lower() for word in ['the', 'dj', 'and', '&']):
            # Only flag truly suspicious ones
            if title in ['EVENTS', 'CALENDAR', 'SHOW', 'LIVE', 'MUSIC', 'OPEN', 'TONIGHT']:
                return "all_caps_short"
    
    return None

def run_audit():
    findings = {}
    
    # Load all data
    all_events = get_all_events()
    all_venues = get_all_venues()
    
    # ====================
    # 1. GARBAGE TITLES
    # ====================
    print_section("1. GARBAGE TITLES CHECK")
    
    garbage_by_type = defaultdict(list)
    for event in all_events:
        garbage_type = is_garbage_title(event.get('title'))
        if garbage_type:
            garbage_by_type[garbage_type].append(event)
    
    total_garbage = sum(len(events) for events in garbage_by_type.values())
    findings['garbage_titles'] = {
        'total': total_garbage,
        'severity': 'P0' if total_garbage > 50 else 'P1' if total_garbage > 10 else 'OK',
        'breakdown': {k: len(v) for k, v in garbage_by_type.items()}
    }
    
    print(f"Total garbage titles found: {total_garbage}")
    for gtype, events in sorted(garbage_by_type.items(), key=lambda x: -len(x[1])):
        print(f"\n  {gtype}: {len(events)} events")
        for event in events[:5]:
            print(f"    - Event {event['id']}: '{event.get('title')}'")
        if len(events) > 5:
            print(f"    ... and {len(events) - 5} more")
    
    # ====================
    # 2. INVALID CATEGORIES
    # ====================
    print_section("2. INVALID CATEGORIES CHECK")
    
    invalid_cats = []
    for event in all_events:
        cat = event.get('category')
        if cat and cat not in VALID_CATEGORIES:
            invalid_cats.append(event)
    
    findings['invalid_categories'] = {
        'total': len(invalid_cats),
        'severity': 'P0' if len(invalid_cats) > 0 else 'OK'
    }
    
    print(f"Events with invalid categories: {len(invalid_cats)}")
    if invalid_cats:
        cat_counts = defaultdict(int)
        for event in invalid_cats:
            cat_counts[event.get('category')] += 1
        for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1])[:10]:
            print(f"  - '{cat}': {count} events")
    
    # ====================
    # 3. NULL/EMPTY CRITICAL FIELDS
    # ====================
    print_section("3. NULL/EMPTY CRITICAL FIELDS CHECK")
    
    null_checks = {
        'title': 0,
        'start_date': 0,
        'venue_id': 0,
        'source_id': 0,
        'category': 0
    }
    
    for event in all_events:
        for field in null_checks.keys():
            if not event.get(field):
                null_checks[field] += 1
    
    total_null = sum(null_checks.values())
    findings['null_critical_fields'] = {
        'total': total_null,
        'severity': 'P0' if total_null > 0 else 'OK',
        'breakdown': null_checks
    }
    
    print(f"Events with NULL critical fields: {total_null}")
    for field, count in null_checks.items():
        if count > 0:
            print(f"  - {field}: {count} events")
    
    # ====================
    # 4. DUPLICATES
    # ====================
    print_section("4. REMAINING DUPLICATES CHECK")
    
    dup_groups = defaultdict(list)
    for event in all_events:
        key = (
            event.get('title', '').strip().lower(),
            event.get('venue_id'),
            event.get('start_date')
        )
        dup_groups[key].append(event['id'])
    
    duplicates = {k: v for k, v in dup_groups.items() if len(v) > 1}
    total_dup_events = sum(len(v) - 1 for v in duplicates.values())
    
    findings['duplicates'] = {
        'duplicate_groups': len(duplicates),
        'total_extra_events': total_dup_events,
        'severity': 'P0' if len(duplicates) > 20 else 'P1' if len(duplicates) > 0 else 'OK'
    }
    
    print(f"Duplicate groups: {len(duplicates)}, Extra events to delete: {total_dup_events}")
    if duplicates:
        print("\nTop 10 duplicate groups:")
        for (title, venue_id, start_date), event_ids in sorted(duplicates.items(), key=lambda x: -len(x[1]))[:10]:
            print(f"  - '{title[:60]}' | venue={venue_id} | {start_date}: {len(event_ids)} copies")
    
    # ====================
    # 5. PERMANENT ATTRACTIONS
    # ====================
    print_section("5. PERMANENT ATTRACTIONS CHECK")
    
    title_counts = defaultdict(list)
    for event in all_events:
        title = event.get('title', '').strip()
        if title:
            title_counts[title].append(event['id'])
    
    permanent_attractions = {title: ids for title, ids in title_counts.items() if len(ids) > 20}
    
    suspicious_keywords = ['skyride', 'mini golf', 'play at', 'general admission', 'daily', 'open hours']
    keyword_matches = []
    for event in all_events:
        title = event.get('title', '').lower()
        for keyword in suspicious_keywords:
            if keyword in title:
                keyword_matches.append(event)
                break
    
    findings['permanent_attractions'] = {
        'high_frequency_titles': len(permanent_attractions),
        'keyword_matches': len(keyword_matches),
        'severity': 'P0' if len(permanent_attractions) > 5 else 'P1' if len(permanent_attractions) > 0 else 'OK'
    }
    
    print(f"Titles appearing >20 times: {len(permanent_attractions)}")
    if permanent_attractions:
        for title, ids in sorted(permanent_attractions.items(), key=lambda x: -len(x[1]))[:10]:
            print(f"  - '{title}': {len(ids)} events")
    
    print(f"\nKeyword matches: {len(keyword_matches)}")
    
    # ====================
    # 6-7. DATE CHECKS
    # ====================
    print_section("6-7. DATE RANGE CHECKS")
    
    past_events = []
    far_future = []
    
    for event in all_events:
        if event.get('start_date'):
            try:
                event_date = datetime.fromisoformat(event['start_date']).date()
                if event_date < PAST_THRESHOLD:
                    past_events.append(event)
                elif event_date > FAR_FUTURE_THRESHOLD:
                    far_future.append(event)
            except:
                pass
    
    findings['past_events'] = {
        'total': len(past_events),
        'severity': 'P1' if len(past_events) > 100 else 'P2' if len(past_events) > 0 else 'OK'
    }
    
    findings['far_future_events'] = {
        'total': len(far_future),
        'severity': 'P1' if len(far_future) > 10 else 'P2' if len(far_future) > 0 else 'OK'
    }
    
    print(f"Past events (>7 days old): {len(past_events)}")
    print(f"Far future events (>365 days): {len(far_future)}")
    
    # ====================
    # 8. VENUE DATA
    # ====================
    print_section("8. VENUE DATA QUALITY")
    
    missing_coords = [v for v in all_venues if not v.get('lat') or not v.get('lng')]
    missing_city = [v for v in all_venues if not v.get('city')]
    missing_type = [v for v in all_venues if not v.get('venue_type')]
    
    findings['missing_venue_data'] = {
        'missing_coords': len(missing_coords),
        'missing_city': len(missing_city),
        'missing_type': len(missing_type),
        'severity': 'P0' if len(missing_coords) > 50 else 'P1' if len(missing_coords) > 0 else 'OK'
    }
    
    print(f"Venues missing coords: {len(missing_coords)}")
    print(f"Venues missing city: {len(missing_city)}")
    print(f"Venues missing type: {len(missing_type)}")
    
    # ====================
    # 9. ORPHANED EVENTS
    # ====================
    print_section("9. ORPHANED EVENTS CHECK")
    
    sources_response = supabase.table('sources').select('id, is_active').execute()
    active_source_ids = {s['id'] for s in sources_response.data if s.get('is_active')}
    
    orphaned = [e for e in all_events if e.get('source_id') and e['source_id'] not in active_source_ids]
    
    findings['orphaned_events'] = {
        'total': len(orphaned),
        'severity': 'P1' if len(orphaned) > 100 else 'P2' if len(orphaned) > 0 else 'OK'
    }
    
    print(f"Orphaned events: {len(orphaned)}")
    
    # ====================
    # 10. SUSPICIOUS PATTERNS
    # ====================
    print_section("10. SUSPICIOUS PATTERNS")
    
    midnight_not_allday = [e for e in all_events if e.get('start_time') == '00:00:00' and not e.get('is_all_day')]
    allday_with_time = [e for e in all_events if e.get('is_all_day') and e.get('start_time') and e['start_time'] != '00:00:00']
    synthetic_desc = [e for e in all_events if e.get('description') and re.match(r'^Event at .+$', e['description'].strip())]
    
    findings['suspicious_patterns'] = {
        'midnight_not_allday': len(midnight_not_allday),
        'allday_with_time': len(allday_with_time),
        'synthetic_descriptions': len(synthetic_desc),
        'severity': 'P2'
    }
    
    print(f"Midnight but not all-day: {len(midnight_not_allday)}")
    print(f"All-day with time: {len(allday_with_time)}")
    print(f"Synthetic descriptions: {len(synthetic_desc)}")
    
    # ====================
    # 11. CATEGORY DISTRIBUTION
    # ====================
    print_section("11. CATEGORY DISTRIBUTION")
    
    cat_counts = defaultdict(int)
    for event in all_events:
        cat = event.get('category') or 'NULL'
        cat_counts[cat] += 1
    
    findings['category_distribution'] = dict(cat_counts)
    
    print(f"Total events: {len(all_events)}\n")
    for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1]):
        pct = (count / len(all_events) * 100)
        print(f"  {cat:20s}: {count:6d} ({pct:5.2f}%)")
    
    # ====================
    # 12. SOURCE HEALTH
    # ====================
    print_section("12. SOURCE HEALTH")
    
    future_events = [e for e in all_events if e.get('start_date') and datetime.fromisoformat(e['start_date']).date() >= TODAY]
    
    source_future_counts = defaultdict(int)
    for event in future_events:
        if event.get('source_id'):
            source_future_counts[event['source_id']] += 1
    
    active_sources = [s for s in sources_response.data if s.get('is_active')]
    sources_with_no_events = [s for s in active_sources if s['id'] not in source_future_counts]
    
    findings['source_health'] = {
        'active_sources': len(active_sources),
        'sources_with_no_events': len(sources_with_no_events),
        'severity': 'P1' if len(sources_with_no_events) > 50 else 'P2'
    }
    
    print(f"Active sources: {len(active_sources)}")
    print(f"Sources with 0 future events: {len(sources_with_no_events)}")
    
    # ====================
    # SUMMARY
    # ====================
    print_section("SUMMARY OF FINDINGS")
    
    print(f"\n{'Check':<40s} {'Severity':<10s} {'Count/Issue'}")
    print('-' * 80)
    
    summary = [
        ("Garbage titles", findings['garbage_titles']['severity'], findings['garbage_titles']['total']),
        ("Invalid categories", findings['invalid_categories']['severity'], findings['invalid_categories']['total']),
        ("NULL critical fields", findings['null_critical_fields']['severity'], findings['null_critical_fields']['total']),
        ("Duplicate events", findings['duplicates']['severity'], f"{findings['duplicates']['duplicate_groups']} groups"),
        ("Permanent attractions", findings['permanent_attractions']['severity'], findings['permanent_attractions']['high_frequency_titles']),
        ("Past events", findings['past_events']['severity'], findings['past_events']['total']),
        ("Far future events", findings['far_future_events']['severity'], findings['far_future_events']['total']),
        ("Venues missing coords", findings['missing_venue_data']['severity'], findings['missing_venue_data']['missing_coords']),
        ("Orphaned events", findings['orphaned_events']['severity'], findings['orphaned_events']['total']),
        ("Midnight not all-day", findings['suspicious_patterns']['severity'], findings['suspicious_patterns']['midnight_not_allday']),
        ("Sources with no events", findings['source_health']['severity'], findings['source_health']['sources_with_no_events']),
    ]
    
    for check, severity, count in summary:
        print(f"{check:<40s} {severity:<10s} {count}")
    
    p0 = sum(1 for _, sev, _ in summary if sev == 'P0')
    p1 = sum(1 for _, sev, _ in summary if sev == 'P1')
    p2 = sum(1 for _, sev, _ in summary if sev == 'P2')
    
    print(f"\n{'='*80}")
    print(f"  PRIORITY SUMMARY")
    print('='*80)
    print(f"P0 (Fix Now):      {p0} issues")
    print(f"P1 (Fix Soon):     {p1} issues")
    print(f"P2 (Nice to Have): {p2} issues")
    print(f"\nStatus: {'READY FOR CRAWL' if p0 == 0 else 'NEEDS ATTENTION'}")
    print('='*80)

if __name__ == '__main__':
    run_audit()
