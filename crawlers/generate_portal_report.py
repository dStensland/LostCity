#!/usr/bin/env python3
"""
Generate a standalone HTML report showing event distribution across portals.

This diagnostic tool helps identify:
- Which events belong to which portal (Atlanta, Nashville, Piedmont)
- Events that are unassigned (portal_id = NULL)
- Daily event counts for capacity planning
- Category distribution per portal
- Source attribution for unassigned events
"""

from datetime import datetime, timedelta
from collections import defaultdict
from db import get_client

def query_portal_summary():
    """Get total event counts by portal."""
    client = get_client()

    # Get all future events with portal info
    result = client.table('events').select(
        'id, portal_id, portals(name, slug)'
    ).gte('start_date', datetime.now().strftime('%Y-%m-%d')).execute()

    # Aggregate by portal
    portal_counts = defaultdict(int)
    portal_slugs = {}

    for event in result.data:
        portal = event.get('portals')
        if portal:
            portal_name = portal['name']
            portal_slug = portal['slug']
        else:
            portal_name = 'Unassigned'
            portal_slug = 'null'

        portal_counts[portal_name] += 1
        portal_slugs[portal_name] = portal_slug

    # Convert to list format
    summary = [
        {
            'portal_name': name,
            'portal_slug': portal_slugs[name],
            'event_count': count
        }
        for name, count in portal_counts.items()
    ]

    # Sort by count descending
    summary.sort(key=lambda x: x['event_count'], reverse=True)

    return summary

def query_daily_counts():
    """Get event counts per portal per day for the next 60 days."""
    client = get_client()
    end_date = (datetime.now() + timedelta(days=60)).strftime('%Y-%m-%d')
    
    # Direct query
    result = client.table('events').select(
        'start_date, portal_id, portals(name, slug)'
    ).gte('start_date', datetime.now().strftime('%Y-%m-%d')).lte(
        'start_date', end_date
    ).execute()
    
    # Organize by date and portal
    daily_data = defaultdict(lambda: defaultdict(int))
    for event in result.data:
        date = event['start_date']
        portal = event.get('portals')
        portal_name = portal['name'] if portal else 'Unassigned'
        daily_data[date][portal_name] += 1
    
    return daily_data

def query_category_breakdown():
    """Get category counts per portal."""
    client = get_client()
    
    result = client.table('events').select(
        'category, portal_id, portals(name, slug)'
    ).gte('start_date', datetime.now().strftime('%Y-%m-%d')).execute()
    
    # Organize by portal and category
    category_data = defaultdict(lambda: defaultdict(int))
    for event in result.data:
        category = event.get('category') or 'uncategorized'
        portal = event.get('portals')
        portal_name = portal['name'] if portal else 'Unassigned'
        category_data[portal_name][category] += 1
    
    return category_data

def query_unassigned_sources():
    """Get source breakdown for unassigned events."""
    client = get_client()

    # Get all events with source info and portal info
    result = client.table('events').select(
        'source_id, portal_id, sources(name, slug)'
    ).gte('start_date', datetime.now().strftime('%Y-%m-%d')).execute()

    # Filter for NULL portal_id in Python (Supabase .is_() doesn't work reliably)
    source_counts = defaultdict(int)
    for event in result.data:
        if event.get('portal_id') is None:
            source = event.get('sources')
            source_name = source['name'] if source else 'Unknown'
            source_counts[source_name] += 1

    return source_counts

def generate_html_report(portal_summary, daily_counts, category_breakdown, unassigned_sources):
    """Generate a self-contained HTML report with inline CSS and charts."""
    
    # Sort dates
    sorted_dates = sorted(daily_counts.keys())
    
    # Get all portal names
    all_portals = set()
    for counts in daily_counts.values():
        all_portals.update(counts.keys())
    all_portals = sorted(all_portals)
    
    # Calculate max for scaling
    max_daily = max(sum(counts.values()) for counts in daily_counts.values()) if daily_counts else 1
    
    # Generate HTML
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Events by Portal - LostCity Diagnostic Report</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            padding: 2rem;
            line-height: 1.6;
        }}
        
        .container {{
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }}
        
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            text-align: center;
        }}
        
        .header h1 {{
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            font-weight: 700;
        }}
        
        .header .timestamp {{
            opacity: 0.9;
            font-size: 0.95rem;
        }}
        
        .content {{
            padding: 2rem;
        }}
        
        .section {{
            margin-bottom: 3rem;
        }}
        
        .section h2 {{
            font-size: 1.8rem;
            margin-bottom: 1rem;
            color: #667eea;
            border-bottom: 3px solid #667eea;
            padding-bottom: 0.5rem;
        }}
        
        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            margin-top: 1.5rem;
        }}
        
        .summary-card {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 1.5rem;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }}
        
        .summary-card.unassigned {{
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }}
        
        .summary-card h3 {{
            font-size: 1rem;
            margin-bottom: 0.5rem;
            opacity: 0.9;
        }}
        
        .summary-card .count {{
            font-size: 2.5rem;
            font-weight: 700;
        }}
        
        .chart-container {{
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 8px;
            margin-top: 1.5rem;
            overflow-x: auto;
        }}
        
        .daily-chart {{
            min-width: 800px;
        }}
        
        .day-bar {{
            display: flex;
            align-items: center;
            margin-bottom: 0.5rem;
        }}
        
        .day-label {{
            width: 100px;
            font-size: 0.85rem;
            font-weight: 600;
            color: #555;
        }}
        
        .bar-stack {{
            flex: 1;
            display: flex;
            height: 24px;
            background: #e9ecef;
            border-radius: 4px;
            overflow: hidden;
        }}
        
        .bar-segment {{
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            font-weight: 600;
            color: white;
            transition: opacity 0.2s;
        }}
        
        .bar-segment:hover {{
            opacity: 0.8;
        }}
        
        .bar-segment.atlanta {{
            background: #667eea;
        }}
        
        .bar-segment.nashville {{
            background: #f093fb;
        }}
        
        .bar-segment.piedmont {{
            background: #4bc0c8;
        }}
        
        .bar-segment.unassigned {{
            background: #f5576c;
        }}
        
        .count-label {{
            width: 60px;
            text-align: right;
            font-size: 0.85rem;
            font-weight: 600;
            color: #666;
            padding-left: 0.5rem;
        }}
        
        .category-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-top: 1.5rem;
        }}
        
        .category-card {{
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 8px;
        }}
        
        .category-card h3 {{
            font-size: 1.3rem;
            margin-bottom: 1rem;
            color: #667eea;
        }}
        
        .category-bar {{
            display: flex;
            align-items: center;
            margin-bottom: 0.75rem;
        }}
        
        .category-name {{
            width: 120px;
            font-size: 0.9rem;
            font-weight: 500;
            color: #555;
        }}
        
        .category-bar-fill {{
            flex: 1;
            height: 20px;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            border-radius: 4px;
            position: relative;
        }}
        
        .category-count {{
            width: 50px;
            text-align: right;
            font-size: 0.85rem;
            font-weight: 600;
            color: #666;
            padding-left: 0.5rem;
        }}
        
        .source-table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 1.5rem;
            background: white;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            border-radius: 8px;
            overflow: hidden;
        }}
        
        .source-table th {{
            background: #667eea;
            color: white;
            padding: 1rem;
            text-align: left;
            font-weight: 600;
        }}
        
        .source-table td {{
            padding: 0.75rem 1rem;
            border-bottom: 1px solid #e9ecef;
        }}
        
        .source-table tr:last-child td {{
            border-bottom: none;
        }}
        
        .source-table tr:hover {{
            background: #f8f9fa;
        }}
        
        .legend {{
            display: flex;
            flex-wrap: wrap;
            gap: 1.5rem;
            margin-top: 1rem;
            padding: 1rem;
            background: #f8f9fa;
            border-radius: 8px;
        }}
        
        .legend-item {{
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }}
        
        .legend-color {{
            width: 20px;
            height: 20px;
            border-radius: 4px;
        }}
        
        .legend-label {{
            font-size: 0.9rem;
            font-weight: 500;
        }}
        
        @media (max-width: 768px) {{
            body {{
                padding: 1rem;
            }}
            
            .header h1 {{
                font-size: 1.8rem;
            }}
            
            .summary-grid {{
                grid-template-columns: 1fr;
            }}
            
            .category-grid {{
                grid-template-columns: 1fr;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Events by Portal</h1>
            <p class="timestamp">Generated: {datetime.now().strftime('%B %d, %Y at %I:%M %p %Z')}</p>
        </div>
        
        <div class="content">
            <!-- Summary Section -->
            <div class="section">
                <h2>Portal Summary</h2>
                <div class="summary-grid">
"""
    
    # Add portal summary cards
    for portal in portal_summary:
        card_class = "unassigned" if portal.get('portal_slug') == 'null' else ""
        html += f"""
                    <div class="summary-card {card_class}">
                        <h3>{portal.get('portal_name', 'Unknown')}</h3>
                        <div class="count">{portal.get('event_count', 0):,}</div>
                    </div>
"""
    
    html += """
                </div>
                
                <div class="legend">
                    <div class="legend-item">
                        <div class="legend-color" style="background: #667eea;"></div>
                        <span class="legend-label">Atlanta</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: #f093fb;"></div>
                        <span class="legend-label">Nashville</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: #4bc0c8;"></div>
                        <span class="legend-label">Piedmont</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: #f5576c;"></div>
                        <span class="legend-label">Unassigned</span>
                    </div>
                </div>
            </div>
            
            <!-- Daily Breakdown Section -->
            <div class="section">
                <h2>Daily Event Counts (Next 60 Days)</h2>
                <div class="chart-container">
                    <div class="daily-chart">
"""
    
    # Add daily bars
    for date in sorted_dates[:60]:  # Limit to 60 days
        counts = daily_counts[date]
        total = sum(counts.values())
        
        # Format date
        date_obj = datetime.strptime(date, '%Y-%m-%d')
        date_label = date_obj.strftime('%b %d')
        
        html += f"""
                        <div class="day-bar">
                            <div class="day-label">{date_label}</div>
                            <div class="bar-stack">
"""
        
        # Add segments for each portal
        for portal in ['Atlanta', 'Nashville', 'Piedmont', 'Unassigned']:
            count = counts.get(portal, 0)
            if count > 0:
                width_pct = (count / total * 100) if total > 0 else 0
                portal_class = portal.lower()
                html += f"""
                                <div class="bar-segment {portal_class}" style="width: {width_pct}%;" title="{portal}: {count}">
                                    {count if count > 5 else ''}
                                </div>
"""
        
        html += f"""
                            </div>
                            <div class="count-label">{total}</div>
                        </div>
"""
    
    html += """
                    </div>
                </div>
            </div>
            
            <!-- Category Breakdown Section -->
            <div class="section">
                <h2>Category Breakdown by Portal</h2>
                <div class="category-grid">
"""
    
    # Add category cards for each portal
    for portal_name in sorted(category_breakdown.keys()):
        categories = category_breakdown[portal_name]
        max_count = max(categories.values()) if categories else 1
        
        html += f"""
                    <div class="category-card">
                        <h3>{portal_name}</h3>
"""
        
        # Sort categories by count
        sorted_categories = sorted(categories.items(), key=lambda x: x[1], reverse=True)
        for category, count in sorted_categories[:10]:  # Top 10 categories
            width_pct = (count / max_count * 100) if max_count > 0 else 0
            html += f"""
                        <div class="category-bar">
                            <div class="category-name">{category}</div>
                            <div class="category-bar-fill" style="width: {width_pct}%;"></div>
                            <div class="category-count">{count}</div>
                        </div>
"""
        
        html += """
                    </div>
"""
    
    html += """
                </div>
            </div>
            
            <!-- Unassigned Sources Section -->
            <div class="section">
                <h2>Unassigned Events - Source Breakdown</h2>
                <table class="source-table">
                    <thead>
                        <tr>
                            <th>Source Name</th>
                            <th style="text-align: right;">Event Count</th>
                        </tr>
                    </thead>
                    <tbody>
"""
    
    # Add source rows
    sorted_sources = sorted(unassigned_sources.items(), key=lambda x: x[1], reverse=True)
    for source_name, count in sorted_sources:
        html += f"""
                        <tr>
                            <td>{source_name}</td>
                            <td style="text-align: right; font-weight: 600;">{count:,}</td>
                        </tr>
"""
    
    html += f"""
                    </tbody>
                </table>
                <p style="margin-top: 1rem; color: #666; font-style: italic;">
                    Total unassigned events: {sum(unassigned_sources.values()):,}
                </p>
            </div>
        </div>
    </div>
</body>
</html>
"""
    
    return html

def main():
    """Generate the portal events report."""
    print("Querying portal summary...")
    portal_summary = query_portal_summary()
    
    print("Querying daily event counts...")
    daily_counts = query_daily_counts()
    
    print("Querying category breakdown...")
    category_breakdown = query_category_breakdown()
    
    print("Querying unassigned sources...")
    unassigned_sources = query_unassigned_sources()
    
    print("Generating HTML report...")
    html = generate_html_report(
        portal_summary,
        daily_counts,
        category_breakdown,
        unassigned_sources
    )
    
    # Save to file
    output_path = "/Users/coach/Projects/LostCity/web/public/diagnostics/events-by-portal.html"
    
    # Ensure directory exists
    import os
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w') as f:
        f.write(html)
    
    print(f"\nReport generated successfully!")
    print(f"Location: {output_path}")
    print(f"\nSummary:")
    for portal in portal_summary:
        print(f"  - {portal.get('portal_name', 'Unknown')}: {portal.get('event_count', 0):,} events")
    print(f"\nUnassigned events: {sum(unassigned_sources.values()):,}")
    print(f"Top unassigned source: {max(unassigned_sources.items(), key=lambda x: x[1])[0] if unassigned_sources else 'N/A'}")

if __name__ == "__main__":
    main()
