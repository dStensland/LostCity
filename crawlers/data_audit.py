"""
Comprehensive Data Audit for Lost City Events
Analyzes event data quality, duplicates, categorization, and completeness.
"""

import sys
from datetime import datetime, date
from typing import Optional, Dict, List, Tuple
from collections import defaultdict, Counter
from supabase import Client
from db import get_client
from dedupe import generate_content_hash, normalize_text
from rapidfuzz import fuzz

# Category validation - matches frontend CATEGORIES in web/lib/search.ts
VALID_CATEGORIES = [
    'music', 'art', 'comedy', 'theater', 'film', 'sports',
    'food_drink', 'nightlife', 'community', 'fitness', 'family',
    'learning', 'dance', 'tours', 'meetup', 'words', 'religious',
    'markets', 'wellness', 'gaming', 'outdoors', 'activism', 'other'
]

# Subcategories by category - matches frontend SUBCATEGORIES in web/lib/search.ts
VALID_SUBCATEGORIES = {
    'music': ['music.live', 'music.live.rock', 'music.live.hiphop', 'music.live.electronic',
              'music.live.jazz', 'music.live.country', 'music.live.metal', 'music.classical', 'music.openmic',
              'concert', 'dj', 'open-mic', 'karaoke', 'jam-session', 'music-festival', 'live_music',
              'jazz', 'rock', 'indie', 'rnb', 'classical', 'festival'],
    'art': ['exhibition', 'gallery-opening', 'art-walk', 'workshop', 'artist-talk', 'gallery', 'visual-art'],
    'comedy': ['comedy.standup', 'comedy.improv', 'comedy.openmic', 'stand-up', 'improv', 'sketch', 'standup'],
    'theater': ['theater.play', 'theater.musical', 'theater.dance', 'theater.opera',
                'play', 'musical', 'dance', 'opera', 'ballet', 'performance-art', 'performance'],
    'film': ['film.new', 'film.repertory', 'film.documentary', 'film.festival',
             'screening', 'cinema', 'special-screening', 'festival', 'premiere'],
    'sports': ['basketball', 'baseball', 'softball', 'football', 'soccer', 'hockey', 'volleyball',
               'mens_basketball', 'womens_basketball', 'racing', 'game', 'tournament', 'race', 'match'],
    'food_drink': ['restaurant', 'brewery', 'winery', 'food-festival', 'tasting', 'festival'],
    'nightlife': ['nightlife.dj', 'nightlife.drag', 'nightlife.trivia', 'nightlife.strip',
                  'nightlife.burlesque', 'nightlife.lifestyle', 'nightlife.revue',
                  'club', 'bar', 'dance-party', 'dj-night', 'special_event'],
    'community': ['community.volunteer', 'community.meetup', 'community.networking', 'community.lgbtq',
                  'meeting', 'fundraiser', 'volunteer', 'market', 'fair', 'campus', 'activism', 'lecture'],
    'fitness': ['class', 'workout', 'yoga', 'run', 'cycling', 'sports', 'dance-fitness'],
    'family': ['kids', 'family-friendly', 'educational', 'park', 'zoo', 'festival', 'maternity'],
    'learning': ['class', 'workshop', 'seminar', 'lecture', 'training'],
    'words': ['words.reading', 'words.bookclub', 'words.poetry', 'words.storytelling',
              'words.workshop', 'words.lecture', 'reading', 'book-club', 'poetry', 'author-talk'],
    'meetup': ['meetup.tech', 'meetup.professional', 'meetup.social', 'meetup.hobbies',
               'meetup.outdoors', 'meetup.learning', 'meetup.health', 'meetup.creative',
               'meetup.sports', 'meetup.food', 'meetup.parents', 'meetup.lgbtq'],
    'gaming': ['video-games', 'board-games', 'esports', 'tabletop', 'convention'],
    'outdoors': ['hiking', 'nature', 'park', 'adventure', 'sightseeing'],
    'markets': ['farmers-market', 'flea-market', 'craft-fair', 'festival'],
    'wellness': ['meditation', 'spa', 'holistic', 'mental-health'],
    'religious': ['worship', 'spiritual', 'interfaith'],
    'activism': ['protest', 'rally', 'advocacy', 'political'],
    'dance': ['social-dance', 'ballroom', 'latin', 'swing'],
    'tours': ['walking-tour', 'food-tour', 'history-tour', 'stadium-tour'],
    'other': []
}


class DataAudit:
    def __init__(self):
        self.client: Client = get_client()
        self.events: List[dict] = []
        self.venues: Dict[int, dict] = {}
        self.sources: Dict[int, dict] = {}
        self.series: Dict[str, dict] = {}
        
        # Audit results
        self.total_events = 0
        self.duplicates: List[Tuple[int, int, str]] = []  # (id1, id2, reason)
        self.missing_descriptions: List[dict] = []
        self.missing_images: List[dict] = []
        self.missing_categories: List[dict] = []
        self.missing_subcategories: List[dict] = []
        self.missing_genres: List[dict] = []
        self.invalid_categories: List[dict] = []
        self.uncategorizable: List[dict] = []
        
    def load_data(self, limit: Optional[int] = None):
        """Load events and related data from database."""
        print("Loading data from database...")
        
        # Load sources
        sources_result = self.client.table("sources").select("*").execute()
        self.sources = {s['id']: s for s in sources_result.data}
        print(f"  Loaded {len(self.sources)} sources")
        
        # Load venues
        venues_result = self.client.table("venues").select("*").execute()
        self.venues = {v['id']: v for v in venues_result.data}
        print(f"  Loaded {len(self.venues)} venues")
        
        # Load series
        series_result = self.client.table("series").select("*").execute()
        self.series = {s['id']: s for s in series_result.data}
        print(f"  Loaded {len(self.series)} series")
        
        # Load events (only future events for relevance)
        query = self.client.table("events").select("*").gte("start_date", str(date.today()))
        if limit:
            query = query.limit(limit)
        
        events_result = query.execute()
        self.events = events_result.data
        self.total_events = len(self.events)
        print(f"  Loaded {self.total_events} events (future only)\n")
    
    def find_duplicates(self):
        """Find duplicate events using multiple strategies."""
        print("Analyzing duplicates...")
        
        # Strategy 1: Exact content hash matches
        hash_map = defaultdict(list)
        for event in self.events:
            if event.get('venue_id') and event.get('start_date'):
                venue = self.venues.get(event['venue_id'])
                if venue:
                    content_hash = generate_content_hash(
                        event['title'],
                        venue['name'],
                        event['start_date']
                    )
                    hash_map[content_hash].append(event)
        
        for hash_val, events in hash_map.items():
            if len(events) > 1:
                # Sort by ID to get canonical first
                events.sort(key=lambda e: e['id'])
                for i in range(1, len(events)):
                    self.duplicates.append((
                        events[0]['id'],
                        events[i]['id'],
                        "exact_hash"
                    ))
        
        # Strategy 2: Fuzzy matching on same date/venue
        date_venue_map = defaultdict(list)
        for event in self.events:
            key = (event.get('start_date'), event.get('venue_id'))
            if key[0] and key[1]:
                date_venue_map[key].append(event)
        
        for (date, venue_id), events in date_venue_map.items():
            if len(events) > 1:
                # Compare each pair
                for i in range(len(events)):
                    for j in range(i + 1, len(events)):
                        title_sim = fuzz.ratio(
                            normalize_text(events[i]['title']),
                            normalize_text(events[j]['title'])
                        )
                        if title_sim >= 85:
                            # Check if not already marked as duplicate
                            dup_tuple = (events[i]['id'], events[j]['id'], "fuzzy_match")
                            if not any(d[:2] == dup_tuple[:2] for d in self.duplicates):
                                self.duplicates.append(dup_tuple)
        
        print(f"  Found {len(self.duplicates)} potential duplicates\n")
    
    def check_missing_data(self):
        """Identify events with missing descriptions, images, etc."""
        print("Checking for missing data...")

        for event in self.events:
            # Missing or poor descriptions
            desc = (event.get('description') or '').strip()
            if not desc or len(desc) < 50:
                self.missing_descriptions.append({
                    'id': event['id'],
                    'title': event['title'],
                    'source': self.sources.get(event.get('source_id'), {}).get('name', 'Unknown'),
                    'desc_length': len(desc) if desc else 0
                })
            
            # Missing images
            if not event.get('image_url'):
                self.missing_images.append({
                    'id': event['id'],
                    'title': event['title'],
                    'category': event.get('category'),
                    'source': self.sources.get(event.get('source_id'), {}).get('name', 'Unknown')
                })
        
        print(f"  {len(self.missing_descriptions)} events with missing/poor descriptions")
        print(f"  {len(self.missing_images)} events with missing images\n")
    
    def check_categorization(self):
        """Analyze category, subcategory, and genre assignments."""
        print("Analyzing categorization...")
        
        for event in self.events:
            event_id = event['id']
            title = event['title']
            category = event.get('category')
            subcategory = event.get('subcategory')
            genres = event.get('genres', [])
            series_id = event.get('series_id')
            
            # Check for missing category
            if not category:
                self.missing_categories.append({
                    'id': event_id,
                    'title': title,
                    'source': self.sources.get(event.get('source_id'), {}).get('name', 'Unknown')
                })
                continue
            
            # Check for invalid category
            if category not in VALID_CATEGORIES:
                self.invalid_categories.append({
                    'id': event_id,
                    'title': title,
                    'category': category,
                    'source': self.sources.get(event.get('source_id'), {}).get('name', 'Unknown')
                })
            
            # Check for missing subcategory (some categories should have them)
            if category in ['music', 'art', 'comedy', 'theater', 'film'] and not subcategory:
                self.missing_subcategories.append({
                    'id': event_id,
                    'title': title,
                    'category': category,
                    'source': self.sources.get(event.get('source_id'), {}).get('name', 'Unknown')
                })
            
            # Check for missing genres (should have genres OR be part of series with genres)
            if category in ['music', 'film', 'theater', 'sports']:
                has_genres = genres and len(genres) > 0
                series_has_genres = False
                
                if series_id and series_id in self.series:
                    series_genres = self.series[series_id].get('genres', [])
                    series_has_genres = series_genres and len(series_genres) > 0
                
                if not has_genres and not series_has_genres:
                    self.missing_genres.append({
                        'id': event_id,
                        'title': title,
                        'category': category,
                        'series_id': series_id,
                        'source': self.sources.get(event.get('source_id'), {}).get('name', 'Unknown')
                    })
            
            # Check for uncategorizable (category = 'other' or suspicious patterns)
            if category == 'other':
                self.uncategorizable.append({
                    'id': event_id,
                    'title': title,
                    'description': (event.get('description') or '')[:200],
                    'venue': self.venues.get(event.get('venue_id'), {}).get('name', 'Unknown'),
                    'source': self.sources.get(event.get('source_id'), {}).get('name', 'Unknown')
                })
        
        print(f"  {len(self.missing_categories)} events without category")
        print(f"  {len(self.invalid_categories)} events with invalid category")
        print(f"  {len(self.missing_subcategories)} events missing subcategory")
        print(f"  {len(self.missing_genres)} events missing genres")
        print(f"  {len(self.uncategorizable)} events categorized as 'other'\n")
    
    def print_summary(self):
        """Print comprehensive audit summary."""
        print("\n" + "="*80)
        print("DATA AUDIT SUMMARY")
        print("="*80)
        print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Total Events Analyzed: {self.total_events}")
        print()
        
        # Overview statistics
        print("OVERVIEW STATISTICS")
        print("-" * 80)
        
        # Category distribution
        category_counts = Counter(e.get('category', 'MISSING') for e in self.events)
        print("\nCategory Distribution:")
        for cat, count in category_counts.most_common():
            pct = (count / self.total_events) * 100
            print(f"  {cat:20s}: {count:5d} ({pct:5.1f}%)")
        
        # Source distribution
        source_counts = Counter(self.sources.get(e.get('source_id'), {}).get('name', 'Unknown') 
                                for e in self.events)
        print("\nTop 10 Sources:")
        for source, count in source_counts.most_common(10):
            pct = (count / self.total_events) * 100
            print(f"  {source:30s}: {count:5d} ({pct:5.1f}%)")
        
        print("\n" + "="*80)
        print("DUPLICATES")
        print("="*80)
        print(f"Total Duplicates Found: {len(self.duplicates)}")
        
        if self.duplicates:
            print("\nDuplicate Examples (first 10):")
            for i, (id1, id2, reason) in enumerate(self.duplicates[:10]):
                event1 = next((e for e in self.events if e['id'] == id1), None)
                event2 = next((e for e in self.events if e['id'] == id2), None)
                if event1 and event2:
                    print(f"\n  {i+1}. Match Type: {reason}")
                    print(f"     Event {id1}: {event1['title']}")
                    print(f"     Event {id2}: {event2['title']}")
                    print(f"     Date: {event1['start_date']} | Venue: {self.venues.get(event1.get('venue_id'), {}).get('name', 'Unknown')}")
                    print(f"     Sources: {self.sources.get(event1.get('source_id'), {}).get('name')} vs {self.sources.get(event2.get('source_id'), {}).get('name')}")
        
        print("\n" + "="*80)
        print("MISSING DATA")
        print("="*80)
        print(f"Missing Descriptions: {len(self.missing_descriptions)} ({(len(self.missing_descriptions)/self.total_events)*100:.1f}%)")
        print(f"Missing Images: {len(self.missing_images)} ({(len(self.missing_images)/self.total_events)*100:.1f}%)")
        
        # Missing descriptions by source
        if self.missing_descriptions:
            desc_by_source = Counter(e['source'] for e in self.missing_descriptions)
            print("\n  Missing Descriptions by Source:")
            for source, count in desc_by_source.most_common(10):
                print(f"    {source:30s}: {count:5d}")
        
        # Missing images by source
        if self.missing_images:
            img_by_source = Counter(e['source'] for e in self.missing_images)
            print("\n  Missing Images by Source:")
            for source, count in img_by_source.most_common(10):
                print(f"    {source:30s}: {count:5d}")
        
        print("\n" + "="*80)
        print("CATEGORIZATION ISSUES")
        print("="*80)
        print(f"Missing Category: {len(self.missing_categories)}")
        print(f"Invalid Category: {len(self.invalid_categories)}")
        print(f"Missing Subcategory: {len(self.missing_subcategories)}")
        print(f"Missing Genres: {len(self.missing_genres)}")
        print(f"Categorized as 'Other': {len(self.uncategorizable)}")
        
        # Missing categories by source
        if self.missing_categories:
            cat_by_source = Counter(e['source'] for e in self.missing_categories)
            print("\n  Missing Category by Source:")
            for source, count in cat_by_source.most_common():
                print(f"    {source:30s}: {count:5d}")
        
        # Missing subcategories by category
        if self.missing_subcategories:
            subcat_by_cat = Counter(e['category'] for e in self.missing_subcategories)
            print("\n  Missing Subcategory by Category:")
            for cat, count in subcat_by_cat.most_common():
                print(f"    {cat:20s}: {count:5d}")
        
        # Missing genres by category
        if self.missing_genres:
            genre_by_cat = Counter(e['category'] for e in self.missing_genres)
            print("\n  Missing Genres by Category:")
            for cat, count in genre_by_cat.most_common():
                print(f"    {cat:20s}: {count:5d}")
        
        print("\n" + "="*80)
        print("UNCATEGORIZABLE EVENTS")
        print("="*80)
        print(f"Total: {len(self.uncategorizable)}")
        
        if self.uncategorizable:
            print("\nExamples (first 15):")
            for i, event in enumerate(self.uncategorizable[:15]):
                print(f"\n  {i+1}. ID {event['id']}: {event['title']}")
                print(f"     Venue: {event['venue']}")
                print(f"     Source: {event['source']}")
                if event['description']:
                    print(f"     Description: {event['description'][:150]}...")
        
        print("\n" + "="*80)
        print("RECOMMENDATIONS")
        print("="*80)
        
        print("\n1. DEDUPLICATION:")
        if len(self.duplicates) > 0:
            print(f"   - Review {len(self.duplicates)} duplicate pairs")
            print(f"   - Merge duplicates, keeping the canonical event")
            print(f"   - Consider improving content_hash for better dedup")
        else:
            print("   - No duplicates found. Deduplication is working well!")
        
        print("\n2. DESCRIPTIONS:")
        if len(self.missing_descriptions) > 50:
            desc_by_source = Counter(e['source'] for e in self.missing_descriptions)
            top_source = desc_by_source.most_common(1)[0][0]
            print(f"   - Focus on '{top_source}' crawler - {desc_by_source[top_source]} events missing descriptions")
            print(f"   - Review extraction prompts to capture more complete descriptions")
        elif len(self.missing_descriptions) > 0:
            print(f"   - {len(self.missing_descriptions)} events need descriptions - review manually")
        else:
            print("   - All events have adequate descriptions!")
        
        print("\n3. IMAGES:")
        if len(self.missing_images) > 0:
            img_by_cat = Counter(e['category'] for e in self.missing_images if e.get('category'))
            print(f"   - {len(self.missing_images)} events missing images")
            if 'film' in img_by_cat:
                print(f"   - Film events: Consider enabling TMDB poster fetching (already in db.py)")
            if 'music' in img_by_cat:
                print(f"   - Music events: Consider enabling artist image fetching (already in db.py)")
        else:
            print("   - All events have images!")
        
        print("\n4. CATEGORIZATION:")
        if len(self.missing_categories) > 0:
            print(f"   - {len(self.missing_categories)} events need categories - these must be fixed")
            print(f"   - Review extraction prompts to ensure category is always extracted")
        if len(self.missing_subcategories) > 10:
            print(f"   - {len(self.missing_subcategories)} events need subcategories")
            print(f"   - Consider adding subcategory inference logic in tag_inference.py")
        if len(self.missing_genres) > 10:
            print(f"   - {len(self.missing_genres)} events need genres")
            print(f"   - Film/Music events: Enable automatic genre fetching from TMDB/Spotify")
            print(f"   - Theater/Sports: Add genre extraction to prompts")
        
        print("\n5. UNCATEGORIZABLE:")
        if len(self.uncategorizable) > 10:
            print(f"   - {len(self.uncategorizable)} events categorized as 'other'")
            print(f"   - Review these manually to improve categorization rules")
            print(f"   - Consider adding new categories if there are clear patterns")
        
        print("\n" + "="*80)
        print()
    
    def export_detailed_report(self, filename: str = "data_audit_detailed.txt"):
        """Export detailed findings to file."""
        filepath = f"/Users/coach/Projects/LostCity/{filename}"
        
        with open(filepath, 'w') as f:
            f.write("LOST CITY DATA AUDIT - DETAILED REPORT\n")
            f.write("="*80 + "\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Total Events: {self.total_events}\n\n")
            
            # Duplicates
            f.write("\n" + "="*80 + "\n")
            f.write("DUPLICATE EVENTS\n")
            f.write("="*80 + "\n")
            for id1, id2, reason in self.duplicates:
                event1 = next((e for e in self.events if e['id'] == id1), None)
                event2 = next((e for e in self.events if e['id'] == id2), None)
                if event1 and event2:
                    f.write(f"\nDuplicate ({reason}):\n")
                    f.write(f"  ID {id1}: {event1['title']}\n")
                    f.write(f"  ID {id2}: {event2['title']}\n")
                    f.write(f"  Date: {event1['start_date']}\n")
                    f.write(f"  Venue: {self.venues.get(event1.get('venue_id'), {}).get('name', 'Unknown')}\n")
                    f.write(f"  Sources: {self.sources.get(event1.get('source_id'), {}).get('name')} vs {self.sources.get(event2.get('source_id'), {}).get('name')}\n")
            
            # Missing descriptions
            f.write("\n" + "="*80 + "\n")
            f.write("EVENTS MISSING DESCRIPTIONS\n")
            f.write("="*80 + "\n")
            for event in self.missing_descriptions:
                f.write(f"ID {event['id']}: {event['title']} (Source: {event['source']}, Length: {event['desc_length']})\n")
            
            # Missing images
            f.write("\n" + "="*80 + "\n")
            f.write("EVENTS MISSING IMAGES\n")
            f.write("="*80 + "\n")
            for event in self.missing_images:
                f.write(f"ID {event['id']}: {event['title']} (Category: {event['category']}, Source: {event['source']})\n")
            
            # Missing categories
            f.write("\n" + "="*80 + "\n")
            f.write("EVENTS MISSING CATEGORIES\n")
            f.write("="*80 + "\n")
            for event in self.missing_categories:
                f.write(f"ID {event['id']}: {event['title']} (Source: {event['source']})\n")
            
            # Missing subcategories
            f.write("\n" + "="*80 + "\n")
            f.write("EVENTS MISSING SUBCATEGORIES\n")
            f.write("="*80 + "\n")
            for event in self.missing_subcategories:
                f.write(f"ID {event['id']}: {event['title']} (Category: {event['category']}, Source: {event['source']})\n")
            
            # Missing genres
            f.write("\n" + "="*80 + "\n")
            f.write("EVENTS MISSING GENRES\n")
            f.write("="*80 + "\n")
            for event in self.missing_genres:
                series_note = f", Series: {event['series_id']}" if event['series_id'] else ""
                f.write(f"ID {event['id']}: {event['title']} (Category: {event['category']}{series_note}, Source: {event['source']})\n")
            
            # Uncategorizable
            f.write("\n" + "="*80 + "\n")
            f.write("UNCATEGORIZABLE EVENTS (CATEGORY = 'OTHER')\n")
            f.write("="*80 + "\n")
            for event in self.uncategorizable:
                f.write(f"\nID {event['id']}: {event['title']}\n")
                f.write(f"  Venue: {event['venue']}\n")
                f.write(f"  Source: {event['source']}\n")
                f.write(f"  Description: {event['description'][:200]}...\n")
        
        print(f"Detailed report exported to: {filepath}")
    
    def run(self, limit: Optional[int] = None, export: bool = True):
        """Run complete audit."""
        self.load_data(limit)
        self.find_duplicates()
        self.check_missing_data()
        self.check_categorization()
        self.print_summary()
        
        if export:
            self.export_detailed_report()


def main():
    """Run data audit."""
    # Parse arguments
    limit = None
    if len(sys.argv) > 1:
        try:
            limit = int(sys.argv[1])
            print(f"Limiting analysis to {limit} events\n")
        except ValueError:
            print("Usage: python data_audit.py [limit]")
            return
    
    audit = DataAudit()
    audit.run(limit=limit, export=True)


if __name__ == "__main__":
    main()
