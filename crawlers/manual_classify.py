"""
Manual classification for the 92 venues that rules couldn't handle.
Also catches additional junk patterns and fixes misclassifications.
"""

from db import get_client

# Manual classifications: venue_id → new venue_type or "DEACTIVATE"
MANUAL = {
    # ── DEACTIVATE: Out-of-area venues ──
    2035: "DEACTIVATE",  # Bierstadt Lagerhaus (Denver)
    1938: "DEACTIVATE",  # Birmingham Crossplex (Birmingham, AL)
    2054: "DEACTIVATE",  # Catch One (LA)
    982:  "DEACTIVATE",  # Cyprus Hartford (Hartford, CT)
    2031: "DEACTIVATE",  # Denver Milk Market (Denver)
    2118: "DEACTIVATE",  # Estadio Alfredo Harp Helú Béisbol (Mexico City)
    1994: "DEACTIVATE",  # Freedom Hall (Johnson City, TN)
    1979: "DEACTIVATE",  # Grande Dunes Golf Club (Myrtle Beach)
    2121: "DEACTIVATE",  # Historic Bowman Field (Williamsport, PA)
    1983: "DEACTIVATE",  # IU Tennis Center (Indiana)
    1981: "DEACTIVATE",  # Lexington CC (out of area)
    2120: "DEACTIVATE",  # MLB at Field of Dreams (Dyersville, Iowa)
    2083: "DEACTIVATE",  # Mississippi State (out of area)
    1995: "DEACTIVATE",  # Mitchell Center (Mobile, AL)
    1977: "DEACTIVATE",  # Neil Schiff Tennis Center (out of area)
    2036: "DEACTIVATE",  # Sipping N' Painting Hampden (Denver)
    2056: "DEACTIVATE",  # Sofitel Los Angeles at Beverly Hills
    2041: "DEACTIVATE",  # SPARK Social SF (San Francisco)
    2068: "DEACTIVATE",  # Subterranean (Chicago)
    1425: "DEACTIVATE",  # The Laugh Shop (Calgary!)
    2039: "DEACTIVATE",  # The Crossing at East Cut (SF)
    2027: "DEACTIVATE",  # The U.S. Capitol Visitor Center (DC)
    2057: "DEACTIVATE",  # The Vermont Hollywood (LA)
    2028: "DEACTIVATE",  # THRōW Social DC (DC)
    2033: "DEACTIVATE",  # Viewhouse Ballpark (Denver)
    1980: "DEACTIVATE",  # Waynesville Inn (out of area)
    2034: "DEACTIVATE",  # Glaze & Phase (Denver)
    2047: "DEACTIVATE",  # Congo Square (New Orleans)

    # ── DEACTIVATE: City/state names not caught by regex ──
    2087: "DEACTIVATE",  # Auburn (just a name)
    1933: "DEACTIVATE",  # Charleston, S.C.
    1932: "DEACTIVATE",  # Chattanooga, Tenn.
    1936: "DEACTIVATE",  # Columbia, S.C.
    2086: "DEACTIVATE",  # Furman (university out of area)
    1975: "DEACTIVATE",  # Gainesville, Fla.
    1935: "DEACTIVATE",  # Greenville, S.C.
    2005: "DEACTIVATE",  # Lihu'e, HI
    2045: "DEACTIVATE",  # Lower Greenville (Dallas neighborhood)
    1957: "DEACTIVATE",  # North Florida (too vague)
    1947: "DEACTIVATE",  # Rock Hill, S.C.
    2044: "DEACTIVATE",  # Sounders (Dallas?)
    1958: "DEACTIVATE",  # Stetson (Florida university)
    2084: "DEACTIVATE",  # Wofford (SC college)
    2010: "DEACTIVATE",  # Wichita, Kansas
    2001: "DEACTIVATE",  # Wilmington, N.C.

    # ── DEACTIVATE: Junk/placeholder/duplicates ──
    2082: "DEACTIVATE",  # Adams Tennis Complex
    2078: "DEACTIVATE",  # Airport
    1998: "DEACTIVATE",  # Altar at The Masquerade (sub-venue)
    2002: "DEACTIVATE",  # Heaven at The Masquerade (sub-venue)
    2009: "DEACTIVATE",  # Heaven, Hell, Purgatory, and Altar at The Masquerade
    2000: "DEACTIVATE",  # Hell at The Masquerade (sub-venue)
    1997: "DEACTIVATE",  # Purgatory at The Masquerade (sub-venue)
    2111: "DEACTIVATE",  # Beth Inman's residence (private home)
    1978: "DEACTIVATE",  # Betty Siegel Courts (campus tennis)
    1984: "DEACTIVATE",  # Burrows-Burleson Tennis Center (campus)
    1961: "DEACTIVATE",  # GSU Baseball Complex
    1956: "DEACTIVATE",  # GSU Clarkston Tennis Complex
    1951: "DEACTIVATE",  # GSU Clarkston Tennis Complex, Atlanta, GA (dupe)
    1945: "DEACTIVATE",  # GSU Soccer Complex
    1934: "DEACTIVATE",  # GSU Soccer Complex, Atlanta, Ga. (dupe)
    1962: "DEACTIVATE",  # Gwinnett Field (generic)
    1677: "DEACTIVATE",  # Franklin Area (just "area")
    1499: "DEACTIVATE",  # Nashville (just the city name)
    1432: "DEACTIVATE",  # Nashville Area (just an area)
    1954: "DEACTIVATE",  # Convocation Center (too generic)
    2134: "DEACTIVATE",  # Tully Gymnasium
    1431: "DEACTIVATE",  # The End - Nashville (dupe of 1522)
    2071: "DEACTIVATE",  # Opry House (dupe of Grand Ole Opry House)

    # ── music_venue ──
    1844: "music_venue",  # 3rd and Lindsley (Nashville)
    2116: "music_venue",  # 40 Watt Club (Athens, GA - legendary!)
    1506: "music_venue",  # Bobby's Idle Hour (Nashville)
    1420: "music_venue",  # Cannery Hall (Nashville)
    1480: "music_venue",  # Springwater (Nashville)
    1893: "music_venue",  # The Basement-TN (Nashville)
    1415: "music_venue",  # The Blue Room - TN (Nashville)
    1402: "music_venue",  # The East Room (Nashville)
    1522: "music_venue",  # The End (Nashville)
    1519: "music_venue",  # The Legendary Kimbros (Nashville)
    1418: "music_venue",  # The Mil at Cannery Hall (Nashville)
    1494: "music_venue",  # The Station Inn (Nashville - legendary bluegrass!)
    1498: "music_venue",  # The Troubadour (Nashville)
    1419: "music_venue",  # The Pinnacle - TN (Nashville)

    # ── comedy_club ──
    1511: "comedy_club",  # Zanies (Nashville)
    1489: "comedy_club",  # Zanies Comedy Club (Nashville - possibly dupe)
    1513: "comedy_club",  # The Lab at Zanies (Nashville)
    1491: "comedy_club",  # The Lab at Zanies Nashville (dupe?)

    # ── bar ──
    1508: "bar",          # Acme Feed and Seed (Nashville)
    1424: "bar",          # Chief's on Broadway (Nashville honky tonk)
    1515: "bar",          # Gray & Dudley (Nashville)
    1533: "bar",          # Jelly Roll's Goodnight Nashville
    1438: "bar",          # Night We Met (Nashville)
    1503: "bar",          # Rawhides (Nashville)
    1504: "bar",          # Skinny Dennis (Nashville)
    1537: "bar",          # Tin Roof Cool Springs (Nashville)
    1517: "bar",          # Tin Roof Demonbreun (Nashville)
    2099: "bar",          # Padriac's (Vinings)
    2095: "bar",          # Jimmy Mac's (Marietta)
    2112: "bar",          # Dr. Scofflaw's (Atlanta)
    968:  "bar",          # The Possum Den (Atlanta)
    1923: "bar",          # The Exclusive (Atlanta)
    1683: "bar",          # Twin Peaks - Kennesaw
    2104: "bar",          # WR Social House (Marietta)
    2103: "bar",          # Whelan (W Midtown)
    1482: "bar",          # Rare Bird Nashville
    978:  "bar",          # Standard at Alpharetta
    2038: "bar",          # Pandora's Box
    2065: "bar",          # Lore

    # ── restaurant ──
    1704: "restaurant",   # Bell Street Burritos (Atlanta)
    2089: "restaurant",   # Beef O'Brady's (Jefferson)
    2090: "restaurant",   # Ceviche (Roswell)
    2091: "restaurant",   # Chairs (E Point)
    2064: "restaurant",   # Guac y Margys
    1707: "restaurant",   # Hattie B's (Atlanta)
    2046: "restaurant",   # Here Today Rotisserie
    2050: "restaurant",   # Iberville Cuisine
    2098: "restaurant",   # Los Magueys
    2042: "restaurant",   # Mayes Oyster House
    1523: "restaurant",   # Puckett's Grocery - Hendersonville (Nashville)
    2102: "restaurant",   # The Little Hippo (Avondale Estates)
    2107: "restaurant",   # Swan Coach House (Atlanta)
    1955: "restaurant",   # Euro Atlanta (Marietta)

    # ── nightclub ──
    1686: "nightclub",    # Avenue Atlanta

    # ── arena ──
    1429: "arena",        # Blue Raider Softball Field (MTSU)
    1428: "arena",        # Cheryl Holt Field at Cathi May (Austin Peay)
    142:  "arena",        # Coolray Field (Gwinnett Stripers)
    141:  "arena",        # EchoPark Speedway (auto racing)
    1423: "arena",        # Hawkins Field (Vanderbilt baseball)
    1426: "arena",        # Joe Maynard Field at Raymond C (Austin Peay)
    1408: "arena",        # Murphy Center (MTSU)
    1421: "arena",        # Reese Smith Field (MTSU baseball)
    1405: "arena",        # Nashville Municipal Auditorium

    # ── event_space ──
    1922: "convention_center",  # Cobb Convention Center Atlanta
    2131: "event_space",  # Decatur Conference Center
    1481: "event_space",  # Factory at Franklin (Nashville)
    1531: "event_space",  # The Factory at Franklin (Nashville - dupe?)
    1514: "event_space",  # The Union Station Nashville Yards
    2023: "event_space",  # Keith James Auditorium
    1430: "event_space",  # Toro Event Center (Madison/Nashville)
    1505: "event_space",  # Committee Chambers (Nashville)
    2076: "event_space",  # The Goat Farm (Atlanta arts space)
    110:  "event_space",  # Trilith LIVE (Fayetteville, GA)
    1409: "event_space",  # K-LOVE Center (Franklin)
    2070: "event_space",  # American Legion Post (135 Ballroom)

    # ── hotel ──
    1520: "hotel",        # Grand Hyatt Nashville
    1502: "hotel",        # Noelle (Nashville boutique hotel)
    1539: "hotel",        # Virgin Hotels Nashville
    2067: "hotel",        # Hyatt

    # ── recreation ──
    2105: "recreation",   # Puttshack (mini golf)
    1406: "recreation",   # Eastside Bowl (Nashville bowling)
    2085: "recreation",   # The Painted Pin (Atlanta bowling/bar)
    1417: "recreation",   # Ford Ice Center Clarksville
    1529: "recreation",   # Fogg Street Lawn Club (Nashville)

    # ── gallery/museum ──
    1478: "gallery",      # The First Center for the Visual Arts (Nashville)
    1526: "gallery",      # Monthaven Arts and Cultural Center (Nashville)
    2073: "gallery",      # Midnight Grove Collective (Murfreesboro)
    1516: "gallery",      # The Muses Studio (Nashville)
    1496: "museum",       # The Parthenon (Nashville)

    # ── park ──
    1528: "park",         # Nashville Zoo at Grassmere

    # ── brewery ──
    2013: "brewery",      # Hop Springs - Outdoors (Murfreesboro)
    1411: "brewery",      # Hop Springs (Murfreesboro)

    # ── bookstore ──
    2060: "bookstore",    # Barnes & Noble
    2055: "bookstore",    # Barnes & Noble The Grove

    # ── fitness ──
    1485: "fitness",      # The Crag Franklin (climbing gym)
    1500: "fitness",      # R + R Wellness (Nashville)

    # ── organization ──
    2062: "organization", # 404.exe (Atlanta DJ collective)
    1400: "organization", # Nashville Predators (sports team)
    1973: "organization", # Phase Events (event company)
    2124: "organization", # WRFG Atlanta (radio)
    2125: "organization", # WRFG Atlanta 89.3 FM (radio dupe)
    1959: "organization", # Emory (already covered by Emory University)
    1960: "organization", # Kennesaw State (already covered)
    2129: "organization", # Decatur City Hall (government)

    # ── entertainment / sports bar ──
    1684: "bar",          # DraftKings Nashville (sports bar)
    1525: "bar",          # The Outfield (Nashville bar near stadium)

    # ── retail ──
    2126: "retail",       # Big Peach Ride + Run
    2127: "retail",       # Big Peach Running Co.

    # ── food_hall ──
    1434: "food_hall",    # Assembly Food Hall (Nashville)

    # ── Not sure / need more context but classify best guess ──
    2072: "event_space",  # OFLOW (Murfreesboro creative space)
}

# Also fix some misclassifications from the rules pass
FIXES = {
    # "Park" in name but actually stadiums/arenas
    # Citizens Bank Park = Philadelphia Phillies stadium → deactivate (out of area)
    2119: "DEACTIVATE",
    # First Horizon Park = Nashville baseball → arena
    1436: "arena",
    # GEODIS Park = Nashville SC → arena
    1412: "arena",
    # Fritchie Park might be a real park, leave it

    # Heaven's Banquet Hall was classified as organization (from institution) but it's event_space
    377: "event_space",
}


def apply_manual(dry_run: bool = False):
    client = get_client()

    all_changes = {**MANUAL, **FIXES}

    deactivated = 0
    classified = 0
    errors = 0

    print(f"Applying {len(all_changes)} manual classifications...")
    print("=" * 60)

    for vid, action in sorted(all_changes.items()):
        # Get current venue info
        result = client.table("venues").select("id,name,venue_type,active").eq("id", vid).execute()
        if not result.data:
            print(f"  SKIP [{vid}] — not found")
            errors += 1
            continue

        venue = result.data[0]
        name = venue["name"][:50]

        if action == "DEACTIVATE":
            if not venue.get("active", True):
                continue  # already deactivated
            print(f"  DEACTIVATE [{vid}] {name}")
            if not dry_run:
                client.table("venues").update({"active": False}).eq("id", vid).execute()
            deactivated += 1
        else:
            current = venue.get("venue_type") or "(none)"
            if current == action:
                continue  # already correct
            print(f"  CLASSIFY [{vid}] {name}: {current} → {action}")
            if not dry_run:
                client.table("venues").update({"venue_type": action}).eq("id", vid).execute()
            classified += 1

    print(f"\n{'=' * 60}")
    print(f"Deactivated: {deactivated}")
    print(f"Classified:  {classified}")
    print(f"Errors:      {errors}")
    print(f"Total:       {deactivated + classified}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    apply_manual(dry_run=args.dry_run)
