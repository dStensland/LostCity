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
        """Analyze category and genre assignments."""
        print("Analyzing categorization...")

        for event in self.events:
            event_id = event['id']
            title = event['title']
            category = event.get('category')
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
