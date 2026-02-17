#!/usr/bin/env python3
"""
Comprehensive festival data diagnostics.
Analyzes all festival series for date sanity, description quality, 
event linkage anomalies, duplicates, ghost festivals, and fragmentation.
"""

from datetime import datetime, timedelta
import re
from collections import defaultdict
from difflib import SequenceMatcher
from db import get_client

# Today's date for reference
TODAY = datetime.strptime("2026-02-14", "%Y-%m-%d").date()

def similarity_ratio(a: str, b: str) -> float:
    """Calculate similarity between two strings (0.0 to 1.0)."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def looks_like_html(text: str) -> bool:
    """Check if text contains HTML remnants."""
    html_patterns = [
        r'<[^>]+>',  # HTML tags
        r'&[a-z]+;',  # HTML entities
        r'class=',
        r'onclick=',
        r'<script',
        r'<div',
    ]
    return any(re.search(pattern, text, re.IGNORECASE) for pattern in html_patterns)

def looks_like_boilerplate(text: str) -> bool:
    """Check if text looks like scraped navigation/boilerplate."""
    boilerplate_phrases = [
        'skip to content',
        'navigation',
        'menu',
        'cookie policy',
        'privacy policy',
        'subscribe',
        'sign up',
        'follow us',
        'learn more',
        'click here',
    ]
    lower = text.lower()
    return any(phrase in lower for phrase in boilerplate_phrases)

def main():
    client = get_client()
    
    print("=" * 80)
    print("FESTIVAL DATA DEEP DIVE DIAGNOSTIC")
    print("=" * 80)
    print(f"Analysis date: {TODAY}")
    print()
    
    # Fetch all festival series
    result = client.table("series").select("*").in_(
        "series_type", ["festival", "festival_program"]
    ).order("id").execute()
    
    all_festivals = result.data or []
    print(f"Total festival series found: {len(all_festivals)}")
    print()
    
    # ========================================================================
    # 1. DATE SANITY CHECKS
    # ========================================================================
    print("=" * 80)
    print("1. DATE SANITY ISSUES")
    print("=" * 80)
    print()
    
    date_issues = {
        'past_dates': [],
        'inverted_range': [],
        'long_duration': [],
        'null_start_with_events': [],
        'event_date_mismatch': [],
    }
    
    for fest in all_festivals:
        fest_id = fest['id']
        fest_name = fest.get('name', 'UNNAMED')
        fest_type = fest.get('series_type')
        start_date = fest.get('start_date')
        end_date = fest.get('end_date')
        
        # Parse dates
        start = None
        end = None
        if start_date:
            try:
                start = datetime.strptime(start_date, "%Y-%m-%d").date()
            except:
                pass
        if end_date:
            try:
                end = datetime.strptime(end_date, "%Y-%m-%d").date()
            except:
                pass
        
        # Check for past dates
        if start and start < TODAY:
            date_issues['past_dates'].append({
                'id': fest_id,
                'name': fest_name,
                'type': fest_type,
                'start_date': start_date,
                'end_date': end_date,
                'days_ago': (TODAY - start).days
            })
        
        # Check for inverted range
        if start and end and end < start:
            date_issues['inverted_range'].append({
                'id': fest_id,
                'name': fest_name,
                'type': fest_type,
                'start_date': start_date,
                'end_date': end_date,
            })
        
        # Check for very long duration (> 14 days)
        if start and end:
            duration = (end - start).days
            if duration > 14:
                date_issues['long_duration'].append({
                    'id': fest_id,
                    'name': fest_name,
                    'type': fest_type,
                    'start_date': start_date,
                    'end_date': end_date,
                    'duration_days': duration,
                })
        
        # Check for NULL start_date but has events
        if not start_date:
            events = client.table("events").select(
                "id,start_date"
            ).eq("series_id", fest_id).execute().data or []
            
            if events:
                event_dates = sorted([e['start_date'] for e in events if e.get('start_date')])
                date_issues['null_start_with_events'].append({
                    'id': fest_id,
                    'name': fest_name,
                    'type': fest_type,
                    'event_count': len(events),
                    'event_date_range': f"{event_dates[0]} to {event_dates[-1]}" if event_dates else "N/A",
                })
        
        # Check if events fall outside festival window
        if start and end:
            events = client.table("events").select(
                "id,title,start_date"
            ).eq("series_id", fest_id).execute().data or []
            
            outside = []
            for evt in events:
                evt_date_str = evt.get('start_date')
                if not evt_date_str:
                    continue
                try:
                    evt_date = datetime.strptime(evt_date_str, "%Y-%m-%d").date()
                    if evt_date < start or evt_date > end:
                        outside.append({
                            'event_id': evt['id'],
                            'event_title': evt['title'][:60],
                            'event_date': evt_date_str,
                        })
                except:
                    pass
            
            if outside:
                date_issues['event_date_mismatch'].append({
                    'id': fest_id,
                    'name': fest_name,
                    'type': fest_type,
                    'start_date': start_date,
                    'end_date': end_date,
                    'outside_events': outside,
                })
    
    # Print date issues
    if date_issues['past_dates']:
        print(f"CRITICAL: Festivals with start_date in the past ({len(date_issues['past_dates'])})")
        for item in sorted(date_issues['past_dates'], key=lambda x: -x['days_ago'])[:20]:
            print(f"  ID {item['id']}: {item['name']} ({item['type']})")
            print(f"    Start: {item['start_date']} ({item['days_ago']} days ago)")
            print(f"    End: {item['end_date']}")
            print()
    
    if date_issues['inverted_range']:
        print(f"CRITICAL: Festivals with end_date BEFORE start_date ({len(date_issues['inverted_range'])})")
        for item in date_issues['inverted_range']:
            print(f"  ID {item['id']}: {item['name']} ({item['type']})")
            print(f"    Start: {item['start_date']}, End: {item['end_date']}")
            print()
    
    if date_issues['long_duration']:
        print(f"MEDIUM: Festivals with duration > 14 days ({len(date_issues['long_duration'])})")
        for item in sorted(date_issues['long_duration'], key=lambda x: -x['duration_days'])[:15]:
            print(f"  ID {item['id']}: {item['name']} ({item['type']})")
            print(f"    {item['start_date']} to {item['end_date']} ({item['duration_days']} days)")
            print()
    
    if date_issues['null_start_with_events']:
        print(f"CRITICAL: Festivals with NULL start_date but have events ({len(date_issues['null_start_with_events'])})")
        for item in date_issues['null_start_with_events'][:15]:
            print(f"  ID {item['id']}: {item['name']} ({item['type']})")
            print(f"    Events: {item['event_count']}, Date range: {item['event_date_range']}")
            print()
    
    if date_issues['event_date_mismatch']:
        print(f"MEDIUM: Festivals with events outside date window ({len(date_issues['event_date_mismatch'])})")
        for item in date_issues['event_date_mismatch'][:10]:
            print(f"  ID {item['id']}: {item['name']} ({item['type']})")
            print(f"    Festival: {item['start_date']} to {item['end_date']}")
            print(f"    Outside events: {len(item['outside_events'])}")
            for evt in item['outside_events'][:3]:
                print(f"      - {evt['event_title']} ({evt['event_date']})")
            print()
    
    # ========================================================================
    # 2. DESCRIPTION QUALITY
    # ========================================================================
    print("=" * 80)
    print("2. DESCRIPTION QUALITY ISSUES")
    print("=" * 80)
    print()
    
    desc_issues = {
        'no_description': [],
        'short_description': [],
        'html_in_description': [],
        'boilerplate_description': [],
        'duplicate_descriptions': defaultdict(list),
    }
    
    for fest in all_festivals:
        fest_id = fest['id']
        fest_name = fest.get('name', 'UNNAMED')
        fest_type = fest.get('series_type')
        desc = fest.get('description') or ''
        
        # No description
        if not desc:
            desc_issues['no_description'].append({
                'id': fest_id,
                'name': fest_name,
                'type': fest_type,
            })
            continue
        
        # Short description (< 50 chars)
        if len(desc) < 50:
            desc_issues['short_description'].append({
                'id': fest_id,
                'name': fest_name,
                'type': fest_type,
                'length': len(desc),
                'description': desc,
            })
        
        # HTML in description
        if looks_like_html(desc):
            desc_issues['html_in_description'].append({
                'id': fest_id,
                'name': fest_name,
                'type': fest_type,
                'description_preview': desc[:200],
            })
        
        # Boilerplate in description
        if looks_like_boilerplate(desc):
            desc_issues['boilerplate_description'].append({
                'id': fest_id,
                'name': fest_name,
                'type': fest_type,
                'description_preview': desc[:200],
            })
        
        # Track duplicate descriptions
        desc_key = desc.strip().lower()[:200]  # Use first 200 chars as key
        desc_issues['duplicate_descriptions'][desc_key].append({
            'id': fest_id,
            'name': fest_name,
            'type': fest_type,
        })
    
    # Filter to only duplicates (2+ festivals with same desc)
    true_dupes = {k: v for k, v in desc_issues['duplicate_descriptions'].items() if len(v) > 1}
    
    print(f"Festivals with NO description: {len(desc_issues['no_description'])}")
    for item in desc_issues['no_description'][:20]:
        print(f"  ID {item['id']}: {item['name']} ({item['type']})")
    print()
    
    print(f"Festivals with SHORT description (< 50 chars): {len(desc_issues['short_description'])}")
    for item in desc_issues['short_description'][:15]:
        print(f"  ID {item['id']}: {item['name']} ({item['type']})")
        print(f"    Length: {item['length']}, Text: \"{item['description']}\"")
        print()
    
    if desc_issues['html_in_description']:
        print(f"MEDIUM: Descriptions containing HTML: {len(desc_issues['html_in_description'])}")
        for item in desc_issues['html_in_description'][:10]:
            print(f"  ID {item['id']}: {item['name']} ({item['type']})")
            print(f"    Preview: {item['description_preview']}")
            print()
    
    if desc_issues['boilerplate_description']:
        print(f"MEDIUM: Descriptions with boilerplate text: {len(desc_issues['boilerplate_description'])}")
        for item in desc_issues['boilerplate_description'][:10]:
            print(f"  ID {item['id']}: {item['name']} ({item['type']})")
            print(f"    Preview: {item['description_preview']}")
            print()
    
    if true_dupes:
        print(f"MEDIUM: Duplicate descriptions ({len(true_dupes)} groups)")
        for desc_key, festivals in list(true_dupes.items())[:10]:
            print(f"  Shared by {len(festivals)} festivals:")
            for fest in festivals:
                print(f"    - ID {fest['id']}: {fest['name']} ({fest['type']})")
            print()
    
    # ========================================================================
    # 3. EVENT LINKAGE ANOMALIES
    # ========================================================================
    print("=" * 80)
    print("3. EVENT LINKAGE ANOMALIES")
    print("=" * 80)
    print()
    
    linkage_issues = {
        'single_event': [],
        'mixed_categories': [],
        'mixed_sources': [],
        'low_title_similarity': [],
        'classes_linked': [],
    }
    
    for fest in all_festivals:
        fest_id = fest['id']
        fest_name = fest.get('name', 'UNNAMED')
        fest_type = fest.get('series_type')
        
        # Get events for this festival
        events = client.table("events").select(
            "id,title,category,source_id,is_class"
        ).eq("series_id", fest_id).execute().data or []
        
        if not events:
            continue
        
        # Only 1 event
        if len(events) == 1:
            linkage_issues['single_event'].append({
                'id': fest_id,
                'name': fest_name,
                'type': fest_type,
                'event_title': events[0]['title'],
            })
        
        # Check category diversity
        categories = set(e.get('category') for e in events if e.get('category'))
        if len(categories) > 3:
            linkage_issues['mixed_categories'].append({
                'id': fest_id,
                'name': fest_name,
                'type': fest_type,
                'categories': list(categories),
                'event_count': len(events),
            })
        
        # Check source diversity
        sources = set(e.get('source_id') for e in events if e.get('source_id'))
        if len(sources) > 1:
            linkage_issues['mixed_sources'].append({
                'id': fest_id,
                'name': fest_name,
                'type': fest_type,
                'source_count': len(sources),
                'event_count': len(events),
            })
        
        # Check title similarity (if festival has events)
        if len(events) >= 3:
            similarities = []
            for evt in events[:10]:  # Sample first 10
                evt_title = evt.get('title') or ''
                sim = similarity_ratio(fest_name, evt_title)
                similarities.append(sim)
            
            avg_sim = sum(similarities) / len(similarities) if similarities else 0
            if avg_sim < 0.2:  # Very low similarity
                linkage_issues['low_title_similarity'].append({
                    'id': fest_id,
                    'name': fest_name,
                    'type': fest_type,
                    'avg_similarity': round(avg_sim, 2),
                    'sample_titles': [e['title'][:60] for e in events[:3]],
                })
        
        # Check for is_class=true events
        classes = [e for e in events if e.get('is_class')]
        if classes:
            linkage_issues['classes_linked'].append({
                'id': fest_id,
                'name': fest_name,
                'type': fest_type,
                'class_count': len(classes),
                'total_events': len(events),
            })
    
    print(f"Festivals with only 1 event: {len(linkage_issues['single_event'])}")
    for item in linkage_issues['single_event'][:20]:
        print(f"  ID {item['id']}: {item['name']} ({item['type']})")
        print(f"    Event: {item['event_title'][:70]}")
        print()
    
    if linkage_issues['mixed_categories']:
        print(f"MEDIUM: Festivals with 4+ different event categories: {len(linkage_issues['mixed_categories'])}")
        for item in linkage_issues['mixed_categories'][:10]:
            print(f"  ID {item['id']}: {item['name']} ({item['type']})")
            print(f"    {item['event_count']} events across categories: {', '.join(item['categories'])}")
            print()
    
    if linkage_issues['mixed_sources']:
        print(f"CRITICAL: Festivals with events from multiple sources: {len(linkage_issues['mixed_sources'])}")
        for item in linkage_issues['mixed_sources'][:15]:
            print(f"  ID {item['id']}: {item['name']} ({item['type']})")
            print(f"    {item['event_count']} events from {item['source_count']} sources")
            print()
    
    if linkage_issues['low_title_similarity']:
        print(f"MEDIUM: Festivals with low event title similarity: {len(linkage_issues['low_title_similarity'])}")
        for item in linkage_issues['low_title_similarity'][:10]:
            print(f"  ID {item['id']}: {item['name']} ({item['type']})")
            print(f"    Avg similarity: {item['avg_similarity']}")
            print(f"    Sample events:")
            for title in item['sample_titles']:
                print(f"      - {title}")
            print()
    
    if linkage_issues['classes_linked']:
        print(f"MEDIUM: Festivals with is_class=true events: {len(linkage_issues['classes_linked'])}")
        for item in linkage_issues['classes_linked'][:15]:
            print(f"  ID {item['id']}: {item['name']} ({item['type']})")
            print(f"    {item['class_count']} classes out of {item['total_events']} events")
            print()
    
    # ========================================================================
    # 4. DUPLICATE / NEAR-DUPLICATE FESTIVALS
    # ========================================================================
    print("=" * 80)
    print("4. DUPLICATE / NEAR-DUPLICATE FESTIVALS")
    print("=" * 80)
    print()
    
    # Build similarity matrix
    duplicates = []
    checked = set()
    
    for i, fest1 in enumerate(all_festivals):
        for j, fest2 in enumerate(all_festivals):
            if i >= j:
                continue
            
            key = tuple(sorted([fest1['id'], fest2['id']]))
            if key in checked:
                continue
            checked.add(key)
            
            name1 = fest1.get('name', '')
            name2 = fest2.get('name', '')
            
            if not name1 or not name2:
                continue
            
            sim = similarity_ratio(name1, name2)
            
            if sim > 0.7:  # High similarity
                duplicates.append({
                    'similarity': round(sim, 2),
                    'fest1_id': fest1['id'],
                    'fest1_name': name1,
                    'fest1_type': fest1.get('series_type'),
                    'fest2_id': fest2['id'],
                    'fest2_name': name2,
                    'fest2_type': fest2.get('series_type'),
                })
    
    if duplicates:
        print(f"CRITICAL: Similar festival names ({len(duplicates)} pairs)")
        for dup in sorted(duplicates, key=lambda x: -x['similarity'])[:20]:
            print(f"  Similarity: {dup['similarity']}")
            print(f"    ID {dup['fest1_id']}: {dup['fest1_name']} ({dup['fest1_type']})")
            print(f"    ID {dup['fest2_id']}: {dup['fest2_name']} ({dup['fest2_type']})")
            print()
    
    # ========================================================================
    # 5. GHOST FESTIVALS
    # ========================================================================
    print("=" * 80)
    print("5. GHOST FESTIVALS")
    print("=" * 80)
    print()
    
    ghost_festivals = []
    venue_calendar_candidates = []
    
    for fest in all_festivals:
        fest_id = fest['id']
        fest_name = fest.get('name', 'UNNAMED')
        fest_type = fest.get('series_type')
        start_date = fest.get('start_date')
        
        # Get event count
        events = client.table("events").select(
            "id,start_date", count="exact"
        ).eq("series_id", fest_id).execute()
        
        event_count = events.count or 0
        
        # Ghost: 0 events and either no dates or past dates
        if event_count == 0:
            has_future_date = False
            if start_date:
                try:
                    start = datetime.strptime(start_date, "%Y-%m-%d").date()
                    if start >= TODAY:
                        has_future_date = True
                except:
                    pass
            
            if not has_future_date:
                ghost_festivals.append({
                    'id': fest_id,
                    'name': fest_name,
                    'type': fest_type,
                    'start_date': start_date,
                })
        
        # Venue calendar: lots of events but generic name
        if event_count > 20:
            generic_terms = ['calendar', 'events', 'schedule', 'venue']
            if any(term in fest_name.lower() for term in generic_terms):
                venue_calendar_candidates.append({
                    'id': fest_id,
                    'name': fest_name,
                    'type': fest_type,
                    'event_count': event_count,
                })
    
    print(f"Ghost festivals (0 events, no future relevance): {len(ghost_festivals)}")
    for item in ghost_festivals[:20]:
        print(f"  ID {item['id']}: {item['name']} ({item['type']})")
        print(f"    Start: {item['start_date']}")
        print()
    
    if venue_calendar_candidates:
        print(f"MEDIUM: Possible venue calendars misclassified as festivals: {len(venue_calendar_candidates)}")
        for item in venue_calendar_candidates:
            print(f"  ID {item['id']}: {item['name']} ({item['type']})")
            print(f"    Events: {item['event_count']}")
            print()
    
    # ========================================================================
    # 6. FRAGMENTED FESTIVALS
    # ========================================================================
    print("=" * 80)
    print("6. FRAGMENTED FESTIVALS")
    print("=" * 80)
    print()
    
    # Count festival_program series by source
    source_festival_counts = defaultdict(list)
    
    for fest in all_festivals:
        if fest.get('series_type') != 'festival_program':
            continue
        
        # Get a sample event to find source
        events = client.table("events").select(
            "source_id"
        ).eq("series_id", fest['id']).limit(1).execute().data or []
        
        if events:
            source_id = events[0].get('source_id')
            if source_id:
                source_festival_counts[source_id].append({
                    'id': fest['id'],
                    'name': fest.get('name', 'UNNAMED'),
                })
    
    # Find sources with 5+ festival_program series
    fragmented = {k: v for k, v in source_festival_counts.items() if len(v) >= 5}
    
    if fragmented:
        print(f"CRITICAL: Sources creating 5+ festival_program series: {len(fragmented)}")
        for source_id, festivals in sorted(fragmented.items(), key=lambda x: -len(x[1]))[:10]:
            # Get source name
            source_info = client.table("sources").select("name,slug").eq("id", source_id).execute().data
            source_name = source_info[0]['name'] if source_info else f"Source {source_id}"
            source_slug = source_info[0].get('slug', '') if source_info else ''
            
            print(f"  Source: {source_name} ({source_slug}) - {len(festivals)} festival_program series")
            for fest in festivals[:10]:
                print(f"    - ID {fest['id']}: {fest['name']}")
            if len(festivals) > 10:
                print(f"    ... and {len(festivals) - 10} more")
            print()
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    total_critical = (
        len(date_issues['past_dates']) +
        len(date_issues['inverted_range']) +
        len(date_issues['null_start_with_events']) +
        len(linkage_issues['mixed_sources']) +
        len(duplicates) +
        len(fragmented)
    )
    
    total_medium = (
        len(date_issues['long_duration']) +
        len(date_issues['event_date_mismatch']) +
        len(desc_issues['html_in_description']) +
        len(desc_issues['boilerplate_description']) +
        len(true_dupes) +
        len(linkage_issues['mixed_categories']) +
        len(linkage_issues['low_title_similarity']) +
        len(linkage_issues['classes_linked']) +
        len(venue_calendar_candidates)
    )
    
    total_low = (
        len(desc_issues['no_description']) +
        len(desc_issues['short_description']) +
        len(linkage_issues['single_event']) +
        len(ghost_festivals)
    )
    
    print(f"Total festivals analyzed: {len(all_festivals)}")
    print(f"CRITICAL issues: {total_critical}")
    print(f"MEDIUM issues: {total_medium}")
    print(f"LOW issues: {total_low}")
    print()

if __name__ == "__main__":
    main()
