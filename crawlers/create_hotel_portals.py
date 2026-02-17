"""
Create Bellyard Hotel and Hotel Clermont portal configurations.
These use the hotel vertical template with appropriate branding.
"""

from config import get_config
from supabase import create_client
import json
from datetime import datetime

def create_hotel_portals():
    """Create Bellyard and Clermont hotel portals."""
    cfg = get_config()
    client = create_client(cfg.database.supabase_url, cfg.database.supabase_service_key)

    # Get Atlanta portal ID as parent
    atlanta_result = client.table('portals').select('id').eq('slug', 'atlanta').execute()
    if not atlanta_result.data:
        print("Error: Atlanta portal not found. Need parent_portal_id.")
        return

    atlanta_id = atlanta_result.data[0]['id']
    print(f"Using Atlanta portal as parent: {atlanta_id}")

    # Portal 1: Bellyard Hotel
    bellyard = {
        "slug": "bellyard",
        "name": "Bellyard Hotel",
        "tagline": "Your guide to Atlanta's Westside",
        "portal_type": "business",
        "status": "active",
        "visibility": "public",
        "plan": "enterprise",
        "parent_portal_id": atlanta_id,
        "filters": {
            "city": "Atlanta",
            "state": "GA",
            "geo_center": [33.7705, -84.4022],  # 427 W Marietta St NW
            "geo_radius_km": 5,
            "neighborhoods": ["West Midtown", "Westside", "Home Park", "English Avenue"],
            "exclude_adult": True
        },
        "branding": {
            "theme_mode": "light",
            "primary_color": "#2D3436",      # dark charcoal
            "secondary_color": "#636E72",    # warm gray
            "accent_color": "#D4A574",       # warm terracotta/copper
            "background_color": "#FAF8F5",   # warm white
            "text_color": "#2D3436",
            "muted_color": "#A9A8A6",
            "button_color": "#D4A574",
            "button_text_color": "#2D3436",
            "border_color": "#E8E4DD",
            "card_color": "#FFFFFF",
            "font_heading": "Cormorant Garamond",
            "font_body": "Inter",
            "visual_preset": "custom",
            "header": {
                "template": "minimal",
                "logo_position": "left",
                "logo_size": "sm",
                "nav_style": "text",
                "show_search_in_header": True,
                "transparent_on_top": False
            },
            "ambient": {
                "effect": "none",
                "intensity": "off"
            },
            "component_style": {
                "border_radius": "lg",
                "shadows": "soft",
                "card_style": "flat",
                "button_style": "rounded",
                "glow_enabled": False,
                "glow_intensity": "off",
                "animations": "low",
                "glass_enabled": False
            }
        },
        "settings": {
            "vertical": "hotel",
            "meta_title": "Bellyard Hotel Atlanta - Your guide to Atlanta's Westside",
            "meta_description": "Discover the best events and experiences near Bellyard Hotel in West Midtown, curated for our guests.",
            "nav_labels": {
                "feed": "Tonight",
                "events": "Events",
                "spots": "Explore"
            },
            "default_view": "feed",
            "show_map": False,
            "show_categories": False,
            "show_neighborhoods": False,
            "icon_glow": False,
            "exclude_adult": True,
            "hide_attribution": False,
            "custom_footer_text": "Curated for Bellyard Hotel guests",
            "sharing_brand_name": "Bellyard Hotel",
            "feed": {
                "feed_type": "sections",
                "default_layout": "list",
                "items_per_section": 6,
                "show_activity_tab": False
            }
        }
    }

    # Portal 2: Hotel Clermont
    clermont = {
        "slug": "clermont",
        "name": "Hotel Clermont",
        "tagline": "Atlanta, unfiltered",
        "portal_type": "business",
        "status": "active",
        "visibility": "public",
        "plan": "enterprise",
        "parent_portal_id": atlanta_id,
        "filters": {
            "city": "Atlanta",
            "state": "GA",
            "geo_center": [33.7744, -84.3605],  # 789 Ponce de Leon Ave NE
            "geo_radius_km": 5,
            "neighborhoods": ["Poncey-Highland", "Virginia-Highland", "Little Five Points", "Inman Park", "Old Fourth Ward"],
            "exclude_adult": False  # Clermont Lounge is part of the brand identity
        },
        "branding": {
            "theme_mode": "dark",
            "primary_color": "#1A1A2E",      # deep navy/black
            "secondary_color": "#E94560",    # neon pink/red
            "accent_color": "#FFC947",       # warm yellow/gold
            "background_color": "#0F0F1A",   # near black
            "text_color": "#F2F2F2",
            "muted_color": "#8B8B9E",
            "button_color": "#E94560",
            "button_text_color": "#FFFFFF",
            "border_color": "#2A2A3E",
            "card_color": "#1A1A2E",
            "font_heading": "Space Grotesk",
            "font_body": "Inter",
            "visual_preset": "custom",
            "header": {
                "template": "minimal",
                "logo_position": "left",
                "logo_size": "sm",
                "nav_style": "text",
                "show_search_in_header": True,
                "transparent_on_top": False
            },
            "ambient": {
                "effect": "none",
                "intensity": "off"
            },
            "component_style": {
                "border_radius": "md",
                "shadows": "medium",
                "card_style": "bordered",
                "button_style": "default",
                "glow_enabled": True,
                "glow_intensity": "medium",
                "animations": "low",
                "glass_enabled": False
            }
        },
        "settings": {
            "vertical": "hotel",
            "meta_title": "Hotel Clermont - Atlanta, unfiltered",
            "meta_description": "Discover the best events and experiences near Hotel Clermont in Poncey-Highland, curated for our guests.",
            "nav_labels": {
                "feed": "Tonight",
                "events": "Events",
                "spots": "Explore"
            },
            "default_view": "feed",
            "show_map": False,
            "show_categories": False,
            "show_neighborhoods": False,
            "icon_glow": False,
            "exclude_adult": False,
            "hide_attribution": False,
            "custom_footer_text": "Curated for Hotel Clermont guests",
            "sharing_brand_name": "Hotel Clermont",
            "feed": {
                "feed_type": "sections",
                "default_layout": "list",
                "items_per_section": 6,
                "show_activity_tab": False
            }
        }
    }

    # Insert portals
    portals_created = []

    for portal_data in [bellyard, clermont]:
        # Check if already exists
        existing = client.table('portals').select('id').eq('slug', portal_data['slug']).execute()

        if existing.data:
            print(f"Portal '{portal_data['slug']}' already exists (id: {existing.data[0]['id']})")
            print(f"  URL: /{portal_data['slug']}")
            portals_created.append(portal_data['slug'])
        else:
            # Insert new portal
            result = client.table('portals').insert(portal_data).execute()
            if result.data:
                created = result.data[0]
                print(f"Created portal '{created['slug']}' (id: {created['id']})")
                print(f"  Name: {created['name']}")
                print(f"  Tagline: {created['tagline']}")
                print(f"  Vertical: {created['settings']['vertical']}")
                print(f"  URL: /{created['slug']}")
                portals_created.append(created['slug'])
            else:
                print(f"Error creating portal '{portal_data['slug']}': {result}")

    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Portals ready: {', '.join(portals_created)}")
    print("\nURLs:")
    for slug in portals_created:
        print(f"  - /{slug}")
    print("\nBoth portals use the hotel vertical template.")
    print("They will automatically route to HotelConciergeFeed component.")

    return portals_created

if __name__ == "__main__":
    create_hotel_portals()
