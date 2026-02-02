#!/usr/bin/env python3
"""
Import comprehensive Nashville destinations beyond the Eater 38.
Includes bars, coffee shops, breweries, and attractions from curator research.

Categories imported:
- Bars & Nightlife (30+)
- Coffee Shops (15+)
- Breweries & Distilleries (15+)
- Attractions & Entertainment (20+)
- Music Venues (25+)

Target: 100+ additional destinations
"""

import sys
import logging
import re
import db

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


def slugify(text):
    """Simple slugify function."""
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    text = text.strip('-')
    return text


# BARS & NIGHTLIFE - Comprehensive Nashville bar scene
BARS_NIGHTLIFE = [
    # COCKTAIL BARS
    {
        'name': 'Patterson House',
        'address': '1711 Division St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Midtown',
        'venue_type': 'bar',
        'description': 'Speakeasy-style cocktail bar with craft cocktails and upscale atmosphere.',
        'vibes': ['speakeasy', 'cocktails', 'upscale', 'craft-cocktails']
    },
    {
        'name': 'Attaboy',
        'address': '1808 Division St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Midtown',
        'venue_type': 'bar',
        'description': 'No-menu cocktail bar. Tell the bartender what you like and trust them.',
        'vibes': ['cocktails', 'no-menu', 'intimate', 'craft-cocktails']
    },
    {
        'name': 'The Fox Bar & Cocktail Club',
        'address': '2905 12th Ave S',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': '12 South',
        'venue_type': 'bar',
        'description': 'Vintage cocktail bar in 12 South with craft drinks and mid-century vibe.',
        'vibes': ['cocktails', 'vintage', 'craft-cocktails', '12south']
    },
    {
        'name': 'The Sutler Saloon',
        'address': '2600 Franklin Pike',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Melrose',
        'venue_type': 'bar',
        'description': 'Upscale honky-tonk with live music, craft cocktails, and Nashville spirit.',
        'vibes': ['honky-tonk', 'live-music', 'cocktails', 'upscale-casual']
    },
    {
        'name': 'Rosemary & Beauty Queen',
        'address': '1212 4th Ave N',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Germantown',
        'venue_type': 'bar',
        'description': 'Cocktail bar and restaurant in Germantown with Southern charm.',
        'vibes': ['cocktails', 'southern', 'germantown', 'food']
    },
    
    # HONKY-TONKS (beyond Eater 38)
    {
        'name': "Robert's Western World",
        'address': '416 Broadway',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Downtown',
        'venue_type': 'bar',
        'description': 'Iconic honky-tonk on Broadway. Famous for fried bologna sandwiches and live country music all day.',
        'vibes': ['honky-tonk', 'live-music', 'broadway', 'country', 'dive-bar', 'local-favorite']
    },
    {
        'name': "Tootsie's Orchid Lounge",
        'address': '422 Broadway',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Downtown',
        'venue_type': 'bar',
        'description': 'The most famous honky-tonk in Nashville. Live music on multiple floors 7 days a week.',
        'vibes': ['honky-tonk', 'live-music', 'broadway', 'iconic', 'tourist-favorite']
    },
    {
        'name': "Layla's Bluegrass Inn",
        'address': '418 Broadway',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Downtown',
        'venue_type': 'bar',
        'description': '3-floor honky-tonk on Broadway with bluegrass music and rooftop bar.',
        'vibes': ['honky-tonk', 'live-music', 'broadway', 'bluegrass', 'rooftop']
    },
    {
        'name': 'Acme Feed & Seed',
        'address': '101 Broadway',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Downtown',
        'venue_type': 'bar',
        'description': 'Multi-level bar and restaurant on Broadway with rooftop views of downtown.',
        'vibes': ['honky-tonk', 'live-music', 'broadway', 'rooftop', 'food', 'views']
    },
    {
        'name': 'Legends Corner',
        'address': '428 Broadway',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Downtown',
        'venue_type': 'bar',
        'description': 'Broadway honky-tonk with Johnny Cash and Waylon Jennings memorabilia.',
        'vibes': ['honky-tonk', 'live-music', 'broadway', 'historic', 'memorabilia']
    },
    
    # DIVE BARS
    {
        'name': "Santa's Pub",
        'address': '2225 Bransford Ave',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Berry Hill',
        'venue_type': 'bar',
        'description': 'Double-wide trailer dive bar. Karaoke, cheap drinks, and pure Nashville weird.',
        'vibes': ['dive-bar', 'karaoke', 'unique-space', 'local-favorite', 'cash-only']
    },
    {
        'name': "Mickey's Tavern",
        'address': '2907 Gallatin Pike',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'bar',
        'description': 'Classic East Nashville dive bar with cheap beer and pool tables.',
        'vibes': ['dive-bar', 'pool-tables', 'local-favorite', 'cheap']
    },
    {
        'name': "The Springwater Supper Club & Lounge",
        'address': '115 27th Ave N',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Midtown',
        'venue_type': 'bar',
        'description': 'Historic dive bar since 1950s. Cash-only, vintage vibes.',
        'vibes': ['dive-bar', 'historic', 'cash-only', 'vintage', 'local-favorite']
    },
    {
        'name': 'The 5 Spot',
        'address': '1006 Forrest Ave',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'bar',
        'description': 'Live music venue and bar in Five Points. Eclectic lineup of indie, rock, and local bands.',
        'vibes': ['live-music', 'dive-bar', 'indie', 'local-music', 'five-points']
    },
    
    # JAZZ & SPECIALTY BARS
    {
        'name': "Rudy's Jazz Room",
        'address': '809 Gleaves St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'The Gulch',
        'venue_type': 'bar',
        'description': 'Intimate jazz club in The Gulch. Live jazz nightly.',
        'vibes': ['jazz', 'live-music', 'intimate', 'upscale']
    },
    {
        'name': 'Bourbon Street Blues & Boogie Bar',
        'address': '220 Printers Alley',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Downtown',
        'venue_type': 'bar',
        'description': 'Blues bar in historic Printers Alley. Live blues music nightly.',
        'vibes': ['blues', 'live-music', 'historic', 'printers-alley']
    },
    
    # LGBTQ+ BARS
    {
        'name': 'Play Dance Bar',
        'address': '1519 Church St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Midtown',
        'venue_type': 'bar',
        'description': 'LGBTQ+ dance club with DJs, drag shows, and dance parties.',
        'vibes': ['lgbtq', 'dance-club', 'drag-shows', 'nightclub']
    },
    {
        'name': 'Lipstick Lounge',
        'address': '1400 Woodland St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'bar',
        'description': 'Lesbian bar and music venue in East Nashville. Live music and DJ nights.',
        'vibes': ['lgbtq', 'lesbian-bar', 'live-music', 'dive-bar', 'local-favorite']
    },
    {
        'name': 'Tribe',
        'address': '1517A Church St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Midtown',
        'venue_type': 'bar',
        'description': 'LGBTQ+ dance club and bar. DJs and themed nights.',
        'vibes': ['lgbtq', 'dance-club', 'nightclub']
    },
    {
        'name': 'Canvas Lounge & Bar',
        'address': '1707 Church St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Midtown',
        'venue_type': 'bar',
        'description': 'LGBTQ+ lounge with craft cocktails and relaxed atmosphere.',
        'vibes': ['lgbtq', 'lounge', 'cocktails']
    },
    
    # BEER BARS
    {
        'name': 'The Crying Wolf',
        'address': '823 Woodland St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'bar',
        'description': 'Punk rock dive bar with live music. Local and touring indie/punk bands.',
        'vibes': ['dive-bar', 'punk', 'live-music', 'local-music']
    },
    {
        'name': "Neighbors of Sylvan Park Bar & Bikes",
        'address': '5701 Utah Ave',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Sylvan Park',
        'venue_type': 'bar',
        'description': 'Neighborhood bar with bike shop. Patio and casual vibes.',
        'vibes': ['neighborhood-bar', 'patio', 'bike-shop', 'casual']
    },
]


# COFFEE SHOPS - Nashville coffee culture
COFFEE_SHOPS = [
    {
        'name': 'Barista Parlor - East Nashville',
        'address': '519 Gallatin Ave',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'coffee_shop',
        'description': 'High-end coffee roaster in converted transmission shop. Multiple locations.',
        'vibes': ['specialty-coffee', 'roastery', 'industrial', 'hipster', 'local-roaster']
    },
    {
        'name': 'Barista Parlor - Germantown',
        'address': '1230 4th Ave N',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Germantown',
        'venue_type': 'coffee_shop',
        'description': 'Barista Parlor location in Germantown. Craft coffee and unique space.',
        'vibes': ['specialty-coffee', 'roastery', 'germantown', 'local-roaster']
    },
    {
        'name': 'Barista Parlor - The Gulch',
        'address': '1008 Division St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'The Gulch',
        'venue_type': 'coffee_shop',
        'description': 'Barista Parlor in The Gulch. Espresso bar and coffee cocktails.',
        'vibes': ['specialty-coffee', 'roastery', 'the-gulch', 'local-roaster']
    },
    {
        'name': 'Frothy Monkey - 12 South',
        'address': '2509 12th Ave S',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': '12 South',
        'venue_type': 'coffee_shop',
        'description': 'Local coffee chain. Coffee, brunch, and all-day cafe. Multiple locations.',
        'vibes': ['coffee', 'brunch', 'cafe', 'local-chain', '12south']
    },
    {
        'name': 'Frothy Monkey - The Gulch',
        'address': '235 11th Ave S',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'The Gulch',
        'venue_type': 'coffee_shop',
        'description': 'Frothy Monkey location in The Gulch. Coffee and all-day dining.',
        'vibes': ['coffee', 'brunch', 'cafe', 'local-chain']
    },
    {
        'name': 'Eighth & Roast',
        'address': '2108 8th Ave S',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Melrose',
        'venue_type': 'coffee_shop',
        'description': 'Specialty coffee roaster with small-batch roasting and espresso bar.',
        'vibes': ['specialty-coffee', 'roastery', 'local-roaster', 'small-batch']
    },
    {
        'name': 'Crema Coffee Roasters',
        'address': '15 Hermitage Ave',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Downtown',
        'venue_type': 'coffee_shop',
        'description': 'Local coffee roaster with downtown location. Espresso and pour-overs.',
        'vibes': ['specialty-coffee', 'roastery', 'local-roaster', 'downtown']
    },
    {
        'name': 'Bongo Java - Belmont',
        'address': '2007 Belmont Blvd',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Belmont',
        'venue_type': 'coffee_shop',
        'description': 'Nashville coffee institution since 1993. Community hub near Belmont University.',
        'vibes': ['coffee', 'community', 'historic', 'belmont']
    },
    {
        'name': 'Bongo Java East',
        'address': '107 S 11th St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'coffee_shop',
        'description': 'East Nashville location of Bongo Java. Coffee and community events.',
        'vibes': ['coffee', 'community', 'east-nashville']
    },
    {
        'name': 'The Red Bicycle Coffee & Crepes',
        'address': '1200 Villa Pl',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Edgehill Village',
        'venue_type': 'coffee_shop',
        'description': 'Coffee shop and creperie in historic Edgehill Village trolley barns.',
        'vibes': ['coffee', 'crepes', 'historic', 'unique-space']
    },
    {
        'name': 'Dose Coffee & Tea',
        'address': '3431 Murphy Rd',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Sylvan Park',
        'venue_type': 'coffee_shop',
        'description': 'Neighborhood coffee shop in Sylvan Park. Coffee, tea, and light food.',
        'vibes': ['coffee', 'tea', 'neighborhood', 'sylvan-park']
    },
    {
        'name': 'Ugly Mugs Coffee & Tea',
        'address': '1886 Eastland Ave',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'coffee_shop',
        'description': 'East Nashville coffee shop with outdoor seating and community vibe.',
        'vibes': ['coffee', 'tea', 'community', 'patio']
    },
    {
        'name': 'Steadfast Coffee',
        'address': '603 Taylor St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Germantown',
        'venue_type': 'coffee_shop',
        'description': 'Specialty coffee in Germantown. Pour-overs and espresso.',
        'vibes': ['specialty-coffee', 'germantown', 'pour-over']
    },
    {
        'name': 'Stay Golden',
        'address': '1104 Woodland St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'coffee_shop',
        'description': 'East Nashville coffee shop with vintage vibes and all-day breakfast.',
        'vibes': ['coffee', 'breakfast', 'vintage', 'all-day']
    },
    {
        'name': 'Proper Bagel',
        'address': '2007 Belmont Blvd',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Hillsboro Village',
        'venue_type': 'coffee_shop',
        'description': 'New York-style bagels and coffee. Multiple locations.',
        'vibes': ['bagels', 'coffee', 'ny-style', 'breakfast']
    },
]


# BREWERIES & DISTILLERIES - Nashville craft beverage scene
BREWERIES_DISTILLERIES = [
    {
        'name': 'Yazoo Brewing Company',
        'address': '910 Division St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'The Gulch',
        'venue_type': 'brewery',
        'description': "Nashville's original craft brewery since 2003. Taproom and tours.",
        'vibes': ['brewery', 'taproom', 'tours', 'local-brewery', 'the-gulch']
    },
    {
        'name': 'Bearded Iris Brewing',
        'address': '101 Van Buren St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Germantown',
        'venue_type': 'brewery',
        'description': 'Known for hazy IPAs and innovative beers. Multiple locations.',
        'vibes': ['brewery', 'taproom', 'hazy-ipa', 'craft-beer']
    },
    {
        'name': 'Bearded Iris - Sylvan Heights',
        'address': '2311 Clifton Ave',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Sylvan Heights',
        'venue_type': 'brewery',
        'description': 'Second Bearded Iris location with taproom and outdoor space.',
        'vibes': ['brewery', 'taproom', 'patio', 'craft-beer']
    },
    {
        'name': 'Southern Grist Brewing - East Nashville',
        'address': '1201 Porter Rd',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'brewery',
        'description': 'Innovative craft brewery with experimental beers. Multiple locations.',
        'vibes': ['brewery', 'taproom', 'experimental', 'craft-beer']
    },
    {
        'name': 'Southern Grist Brewing - Germantown',
        'address': '1002 8th Ave S',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Germantown',
        'venue_type': 'brewery',
        'description': 'Southern Grist taproom in Germantown neighborhood.',
        'vibes': ['brewery', 'taproom', 'germantown', 'craft-beer']
    },
    {
        'name': 'Jackalope Brewing Company',
        'address': '701 8th Ave S',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Wedgewood Houston',
        'venue_type': 'brewery',
        'description': 'Local brewery in The Nations. Known for Bearwalker Maple Brown.',
        'vibes': ['brewery', 'taproom', 'local-brewery', 'wedgewood-houston']
    },
    {
        'name': 'TailGate Brewery - Music Row',
        'address': '1538 Demonbreun St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Music Row',
        'venue_type': 'brewery',
        'description': 'Brewery with food and rooftop patio. Multiple locations.',
        'vibes': ['brewery', 'taproom', 'food', 'rooftop', 'music-row']
    },
    {
        'name': 'TailGate Brewery - East Nashville',
        'address': '814 Division St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'brewery',
        'description': 'East Nashville TailGate location with full menu.',
        'vibes': ['brewery', 'taproom', 'food', 'east-nashville']
    },
    {
        'name': 'Fat Bottom Brewing',
        'address': '800 44th Ave N',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'The Nations',
        'venue_type': 'brewery',
        'description': 'Brewery in The Nations with taproom and beer garden.',
        'vibes': ['brewery', 'taproom', 'beer-garden', 'the-nations']
    },
    {
        'name': 'Tennessee Brew Works',
        'address': '809 Ewing Ave',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'The Gulch',
        'venue_type': 'brewery',
        'description': 'Craft brewery in old trolley barn. Tours and taproom.',
        'vibes': ['brewery', 'taproom', 'tours', 'historic-building']
    },
    {
        'name': 'Smith & Lentz Brewing',
        'address': '903 Main St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'brewery',
        'description': 'Small-batch brewery in East Nashville. German-inspired beers.',
        'vibes': ['brewery', 'taproom', 'german-beer', 'small-batch']
    },
    {
        'name': 'East Nashville Beer Works',
        'address': '320 E Trinity Ln',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'brewery',
        'description': 'Neighborhood brewery with rotating taps and food trucks.',
        'vibes': ['brewery', 'taproom', 'neighborhood', 'food-trucks']
    },
    {
        'name': 'Black Abbey Brewing Company',
        'address': '2952 Sidco Dr',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'South Nashville',
        'venue_type': 'brewery',
        'description': 'Belgian-inspired craft brewery. Award-winning beers.',
        'vibes': ['brewery', 'taproom', 'belgian-beer', 'award-winning']
    },
    {
        'name': 'Little Harpeth Brewing',
        'address': '30 Oldham St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Germantown',
        'venue_type': 'brewery',
        'description': 'German lager specialists. Taproom in Germantown.',
        'vibes': ['brewery', 'taproom', 'german-lager', 'germantown']
    },
    
    # DISTILLERIES
    {
        'name': 'Corsair Distillery',
        'address': '1200 Clinton St #110',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Marathon Village',
        'venue_type': 'distillery',
        'description': 'Award-winning craft distillery. Whiskey, gin, vodka. Tours and tastings.',
        'vibes': ['distillery', 'whiskey', 'tours', 'tastings', 'craft-spirits']
    },
    {
        'name': "Nelson's Green Brier Distillery",
        'address': '1414 Clinton St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Marathon Village',
        'venue_type': 'distillery',
        'description': 'Historic Tennessee whiskey brand revived. Tours and tastings.',
        'vibes': ['distillery', 'whiskey', 'tours', 'tastings', 'historic']
    },
]


# MUSIC VENUES - Beyond the honky-tonks
MUSIC_VENUES = [
    {
        'name': 'Grand Ole Opry',
        'address': '2804 Opryland Dr',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Music Valley',
        'venue_type': 'music_venue',
        'description': 'The most famous country music venue in the world. Weekly live radio show since 1925.',
        'vibes': ['iconic', 'country-music', 'live-music', 'historic', 'family-friendly']
    },
    {
        'name': 'Ryman Auditorium',
        'address': '116 5th Ave N',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Downtown',
        'venue_type': 'music_venue',
        'description': 'The Mother Church of Country Music. Historic venue with incredible acoustics.',
        'vibes': ['iconic', 'historic', 'live-music', 'all-genres', 'downtown']
    },
    {
        'name': 'Bluebird Cafe',
        'address': '4104 Hillsboro Pike',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Green Hills',
        'venue_type': 'music_venue',
        'description': 'Intimate songwriter venue. In-the-round performances by hit songwriters.',
        'vibes': ['songwriter-rounds', 'intimate', 'acoustic', 'iconic']
    },
    {
        'name': 'Exit/In',
        'address': '2208 Elliston Pl',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Midtown',
        'venue_type': 'music_venue',
        'description': 'Legendary rock club since 1971. Indie, rock, and alternative music.',
        'vibes': ['rock', 'indie', 'historic', 'live-music']
    },
    {
        'name': 'The Basement',
        'address': '1604 8th Ave S',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Midtown',
        'venue_type': 'music_venue',
        'description': 'Underground music venue. Rock, indie, and singer-songwriter shows.',
        'vibes': ['rock', 'indie', 'underground', 'live-music']
    },
    {
        'name': 'The Basement East',
        'address': '917 Woodland St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'music_venue',
        'description': 'Sister venue to The Basement. Rebuilt after 2020 tornado. Local and touring acts.',
        'vibes': ['rock', 'indie', 'local-music', 'live-music']
    },
    {
        'name': 'Mercy Lounge',
        'address': '1 Cannery Row',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Cannery Row',
        'venue_type': 'music_venue',
        'description': 'Multi-level venue complex with Mercy Lounge, Cannery Ballroom, and High Watt.',
        'vibes': ['rock', 'indie', 'multi-venue', 'live-music']
    },
    {
        'name': 'Cannery Ballroom',
        'address': '1 Cannery Row',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Cannery Row',
        'venue_type': 'music_venue',
        'description': 'Larger room in Mercy Lounge complex. Touring acts and local shows.',
        'vibes': ['rock', 'indie', 'concert-venue', 'live-music']
    },
    {
        'name': 'The High Watt',
        'address': '1 Cannery Row',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Cannery Row',
        'venue_type': 'music_venue',
        'description': 'Smallest room in Mercy Lounge complex. Intimate shows.',
        'vibes': ['indie', 'intimate', 'live-music']
    },
    {
        'name': '3rd & Lindsley',
        'address': '818 3rd Ave S',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'SoBro',
        'venue_type': 'music_venue',
        'description': 'Bar and grill with live music stage. Rock, blues, and Americana.',
        'vibes': ['rock', 'blues', 'americana', 'live-music', 'food']
    },
    {
        'name': 'Station Inn',
        'address': '402 12th Ave S',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'The Gulch',
        'venue_type': 'music_venue',
        'description': 'Legendary bluegrass venue since 1974. Intimate and authentic.',
        'vibes': ['bluegrass', 'intimate', 'historic', 'iconic']
    },
    {
        'name': 'Brooklyn Bowl Nashville',
        'address': '925 3rd Ave S',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Germantown',
        'venue_type': 'music_venue',
        'description': 'Music venue, bowling alley, and restaurant. National touring acts.',
        'vibes': ['concert-venue', 'bowling', 'food', 'live-music']
    },
    {
        'name': 'Marathon Music Works',
        'address': '1402 Clinton St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Marathon Village',
        'venue_type': 'music_venue',
        'description': 'Large venue in converted auto factory. Touring acts and events.',
        'vibes': ['concert-venue', 'industrial', 'live-music']
    },
    {
        'name': 'City Winery Nashville',
        'address': '609 Lafayette St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Germantown',
        'venue_type': 'music_venue',
        'description': 'Wine bar and music venue. Intimate concerts and wine tastings.',
        'vibes': ['wine', 'live-music', 'intimate', 'upscale']
    },
    {
        'name': 'The Listening Room Cafe',
        'address': '618 4th Ave S',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Downtown',
        'venue_type': 'music_venue',
        'description': 'Songwriter venue with dinner service. In-the-round performances.',
        'vibes': ['songwriter-rounds', 'acoustic', 'dinner-show', 'intimate']
    },
    {
        'name': 'Douglas Corner Cafe',
        'address': '2106 8th Ave S',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Melrose',
        'venue_type': 'music_venue',
        'description': 'Songwriter venue and restaurant. Intimate acoustic shows.',
        'vibes': ['songwriter-rounds', 'acoustic', 'food', 'intimate']
    },
    {
        'name': 'Bridgestone Arena',
        'address': '501 Broadway',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Downtown',
        'venue_type': 'arena',
        'description': 'NHL arena (Nashville Predators) and major concert venue.',
        'vibes': ['arena', 'concerts', 'sports', 'large-venue']
    },
    {
        'name': 'Ascend Amphitheater',
        'address': '310 1st Ave S',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Riverfront',
        'venue_type': 'music_venue',
        'description': 'Outdoor amphitheater on the riverfront. Summer concert series.',
        'vibes': ['amphitheater', 'outdoor', 'concerts', 'riverfront']
    },
    {
        'name': 'The Owl Farm',
        'address': '1204 Villa Pl',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Edgehill Village',
        'venue_type': 'music_venue',
        'description': 'Intimate venue in historic trolley barn. Indie and experimental music.',
        'vibes': ['indie', 'experimental', 'intimate', 'historic-building']
    },
    {
        'name': 'Five Points Pizza',
        'address': '1012 Woodland St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'restaurant',
        'description': 'Pizza restaurant with live music stage. Local bands and singer-songwriters.',
        'vibes': ['pizza', 'live-music', 'casual', 'neighborhood']
    },
    {
        'name': "Dee's Country Cocktail Lounge",
        'address': '102 N Dupont Ave',
        'city': 'Madison',
        'state': 'TN',
        'neighborhood': 'Madison',
        'venue_type': 'bar',
        'description': 'Legendary dive bar and music venue. Country music and honky-tonk.',
        'vibes': ['dive-bar', 'country-music', 'live-music', 'historic']
    },
    {
        'name': 'Wildhorse Saloon',
        'address': '120 2nd Ave N',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Downtown',
        'venue_type': 'bar',
        'description': 'Large country music venue with dance floor. Line dancing lessons.',
        'vibes': ['country-music', 'dance-club', 'live-music', 'line-dancing']
    },
    {
        'name': 'Nashville Palace',
        'address': '2611 McGavock Pike',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Music Valley',
        'venue_type': 'bar',
        'description': 'Country music venue near Grand Ole Opry. Live music nightly.',
        'vibes': ['country-music', 'live-music', 'honky-tonk']
    },
    {
        'name': 'Drkmttr',
        'address': '407 Gallatin Ave',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'East Nashville',
        'venue_type': 'music_venue',
        'description': 'Electronic music venue in East Nashville. DJs and experimental music.',
        'vibes': ['electronic', 'experimental', 'dj', 'nightclub']
    },
]


# ATTRACTIONS & ENTERTAINMENT
ATTRACTIONS = [
    # MUSEUMS
    {
        'name': 'Country Music Hall of Fame',
        'address': '222 Rep. John Lewis Way S',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Downtown',
        'venue_type': 'museum',
        'description': 'The premier museum of country music history. Exhibits, artifacts, and concerts.',
        'vibes': ['museum', 'country-music', 'historic', 'family-friendly', 'iconic']
    },
    {
        'name': 'Frist Art Museum',
        'address': '919 Broadway',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Downtown',
        'venue_type': 'museum',
        'description': 'Art museum in Art Deco post office building. Rotating exhibitions.',
        'vibes': ['museum', 'art', 'art-deco', 'family-friendly']
    },
    {
        'name': 'National Museum of African American Music',
        'address': '510 Broadway',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Downtown',
        'venue_type': 'museum',
        'description': 'NMAAM. Interactive museum celebrating African American music history.',
        'vibes': ['museum', 'music-history', 'interactive', 'family-friendly']
    },
    {
        'name': 'Johnny Cash Museum',
        'address': '119 3rd Ave S',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Downtown',
        'venue_type': 'museum',
        'description': 'Museum dedicated to Johnny Cash. Memorabilia and artifacts.',
        'vibes': ['museum', 'johnny-cash', 'music-history', 'downtown']
    },
    {
        'name': 'Musicians Hall of Fame',
        'address': '401 Gay St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Downtown',
        'venue_type': 'museum',
        'description': 'Honoring musicians of all genres. Studio instruments and exhibits.',
        'vibes': ['museum', 'music-history', 'all-genres']
    },
    {
        'name': 'Parthenon',
        'address': '2500 West End Ave',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Centennial Park',
        'venue_type': 'attraction',
        'description': 'Full-scale replica of Athens Parthenon. Art museum and Nashville icon.',
        'vibes': ['museum', 'art', 'architecture', 'unique', 'family-friendly']
    },
    {
        'name': 'Tennessee State Museum',
        'address': '1000 Rosa L Parks Blvd',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Downtown',
        'venue_type': 'museum',
        'description': 'Tennessee history museum. Free admission.',
        'vibes': ['museum', 'history', 'free', 'family-friendly']
    },
    {
        'name': 'Lane Motor Museum',
        'address': '702 Murfreesboro Pike',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'South Nashville',
        'venue_type': 'museum',
        'description': 'Unique car museum featuring European vehicles and microcars.',
        'vibes': ['museum', 'cars', 'unique', 'family-friendly']
    },
    
    # HISTORIC SITES
    {
        'name': 'Cheekwood Estate & Gardens',
        'address': '1200 Forrest Park Dr',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Belle Meade',
        'venue_type': 'attraction',
        'description': 'Botanical garden and art museum on historic estate. Seasonal events.',
        'vibes': ['gardens', 'art-museum', 'historic', 'family-friendly', 'seasonal']
    },
    {
        'name': 'Belle Meade Historic Site & Winery',
        'address': '5025 Harding Pike',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Belle Meade',
        'venue_type': 'attraction',
        'description': 'Historic plantation and winery. Tours and wine tastings.',
        'vibes': ['historic', 'winery', 'tours', 'tastings']
    },
    {
        'name': 'The Hermitage',
        'address': '4580 Rachel\'s Ln',
        'city': 'Hermitage',
        'state': 'TN',
        'neighborhood': 'Hermitage',
        'venue_type': 'attraction',
        'description': 'Andrew Jackson\'s historic home and estate. Tours and events.',
        'vibes': ['historic', 'tours', 'presidential', 'family-friendly']
    },
    {
        'name': 'Belmont Mansion',
        'address': '1900 Belmont Blvd',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Belmont',
        'venue_type': 'attraction',
        'description': 'Antebellum mansion on Belmont University campus. Tours available.',
        'vibes': ['historic', 'tours', 'architecture', 'belmont']
    },
    
    # FAMILY & ENTERTAINMENT
    {
        'name': 'Nashville Zoo',
        'address': '3777 Nolensville Pike',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'South Nashville',
        'venue_type': 'attraction',
        'description': 'Zoo with over 3,000 animals. Family-friendly attraction.',
        'vibes': ['zoo', 'family-friendly', 'kids', 'outdoor']
    },
    {
        'name': 'Adventure Science Center',
        'address': '800 Fort Negley Blvd',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'South Nashville',
        'venue_type': 'attraction',
        'description': 'Interactive science museum with planetarium. Great for kids.',
        'vibes': ['science', 'planetarium', 'family-friendly', 'kids', 'interactive']
    },
    {
        'name': 'Nashville Shores Water Park',
        'address': '4001 Bell Rd',
        'city': 'Hermitage',
        'state': 'TN',
        'neighborhood': 'Hermitage',
        'venue_type': 'attraction',
        'description': 'Water park on Percy Priest Lake. Summer attraction.',
        'vibes': ['water-park', 'family-friendly', 'kids', 'summer', 'seasonal']
    },
    {
        'name': 'Gaylord Opryland Resort',
        'address': '2800 Opryland Dr',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Music Valley',
        'venue_type': 'hotel',
        'description': 'Massive resort hotel with indoor gardens. Famous for Christmas at Gaylord.',
        'vibes': ['hotel', 'resort', 'family-friendly', 'gardens', 'holiday']
    },
    {
        'name': 'Opry Mills Mall',
        'address': '433 Opry Mills Dr',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Music Valley',
        'venue_type': 'shopping',
        'description': 'Large outlet mall near Opry. Shopping and dining.',
        'vibes': ['shopping', 'mall', 'outlet', 'family-friendly']
    },
    
    # PERFORMING ARTS
    {
        'name': 'TPAC - Tennessee Performing Arts Center',
        'address': '505 Deaderick St',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Downtown',
        'venue_type': 'theater',
        'description': 'Major performing arts venue. Broadway tours, ballet, opera.',
        'vibes': ['theater', 'broadway', 'performing-arts', 'downtown']
    },
    {
        'name': 'Schermerhorn Symphony Center',
        'address': '1 Symphony Pl',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Downtown',
        'venue_type': 'concert_hall',
        'description': 'Home of Nashville Symphony. Classical music and special events.',
        'vibes': ['symphony', 'classical', 'concert-hall', 'upscale']
    },
    {
        'name': 'Belcourt Theatre',
        'address': '2102 Belcourt Ave',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Hillsboro Village',
        'venue_type': 'theater',
        'description': 'Historic indie movie theater. Art films, classics, and live music.',
        'vibes': ['movie-theater', 'indie-films', 'historic', 'live-music']
    },
    {
        'name': 'OZ Arts Nashville',
        'address': '6172 Cockrill Bend Cir',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'The Nations',
        'venue_type': 'theater',
        'description': 'Contemporary arts venue. Dance, theater, visual arts.',
        'vibes': ['contemporary-arts', 'dance', 'theater', 'visual-arts']
    },
    
    # COMEDY & THEATER
    {
        'name': 'Third Coast Comedy Club',
        'address': '2021 Broadway',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Midtown',
        'venue_type': 'comedy_club',
        'description': 'Stand-up comedy club with national and local comics.',
        'vibes': ['comedy', 'stand-up', 'nightlife']
    },
    {
        'name': 'Zanies Comedy Night Club',
        'address': '2025 8th Ave S',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'Melrose',
        'venue_type': 'comedy_club',
        'description': 'National comedy club chain. Stand-up shows nightly.',
        'vibes': ['comedy', 'stand-up', 'nightlife']
    },
    {
        'name': "Chaffin's Barn Dinner Theatre",
        'address': '8204 TN-100',
        'city': 'Nashville',
        'state': 'TN',
        'neighborhood': 'West Nashville',
        'venue_type': 'theater',
        'description': 'Dinner theater in converted barn. Musicals and comedy shows.',
        'vibes': ['dinner-theater', 'musicals', 'family-friendly']
    },
]


def import_all_venues():
    """Import all comprehensive Nashville venues."""
    client = db.get_client()
    
    # Combine all venue categories
    all_venues = (
        BARS_NIGHTLIFE + 
        COFFEE_SHOPS + 
        BREWERIES_DISTILLERIES + 
        MUSIC_VENUES + 
        ATTRACTIONS
    )
    
    total = len(all_venues)
    created = 0
    updated = 0
    skipped = 0
    
    logger.info(f"Starting comprehensive import of {total} Nashville venues...")
    logger.info(f"  - Bars & Nightlife: {len(BARS_NIGHTLIFE)}")
    logger.info(f"  - Coffee Shops: {len(COFFEE_SHOPS)}")
    logger.info(f"  - Breweries & Distilleries: {len(BREWERIES_DISTILLERIES)}")
    logger.info(f"  - Music Venues: {len(MUSIC_VENUES)}")
    logger.info(f"  - Attractions: {len(ATTRACTIONS)}")
    logger.info("")
    
    for i, venue_data in enumerate(all_venues, 1):
        try:
            # Generate slug
            if 'slug' not in venue_data:
                venue_data['slug'] = slugify(venue_data['name'])
            
            # Add curator vibe tag
            existing_vibes = venue_data.get('vibes', [])
            curator_vibes = ['curator-vetted']
            venue_data['vibes'] = list(set(existing_vibes + curator_vibes))
            
            # Check if venue exists
            existing = client.table('venues').select('id, name').eq('slug', venue_data['slug']).execute()
            
            if existing.data:
                # Update existing venue
                venue_id = existing.data[0]['id']
                result = client.table('venues').update(venue_data).eq('id', venue_id).execute()
                logger.info(f"[{i}/{total}] Updated: {venue_data['name']} ({venue_data['venue_type']})")
                updated += 1
            else:
                # Insert new venue
                result = client.table('venues').insert(venue_data).execute()
                logger.info(f"[{i}/{total}] Created: {venue_data['name']} ({venue_data['venue_type']})")
                created += 1
        
        except Exception as e:
            logger.error(f"[{i}/{total}] Error importing {venue_data['name']}: {e}")
            skipped += 1
            continue
    
    logger.info("\n" + "="*70)
    logger.info("COMPREHENSIVE NASHVILLE IMPORT COMPLETE!")
    logger.info("="*70)
    logger.info(f"Total venues processed: {total}")
    logger.info(f"  - Created: {created}")
    logger.info(f"  - Updated: {updated}")
    logger.info(f"  - Skipped (errors): {skipped}")
    logger.info("")
    logger.info("Breakdown by category:")
    logger.info(f"  - Bars & Nightlife: {len(BARS_NIGHTLIFE)} venues")
    logger.info(f"  - Coffee Shops: {len(COFFEE_SHOPS)} venues")
    logger.info(f"  - Breweries & Distilleries: {len(BREWERIES_DISTILLERIES)} venues")
    logger.info(f"  - Music Venues: {len(MUSIC_VENUES)} venues")
    logger.info(f"  - Attractions & Entertainment: {len(ATTRACTIONS)} venues")
    logger.info("="*70)
    logger.info("")
    logger.info("These venues complement the Eater 38 restaurants already imported.")
    logger.info("Total Nashville destinations: 38 (Eater) + " + str(created + updated) + " = " + str(38 + created + updated))


if __name__ == "__main__":
    try:
        import_all_venues()
    except KeyboardInterrupt:
        logger.info("\nImport interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
