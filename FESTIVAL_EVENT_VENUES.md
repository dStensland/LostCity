# Festival & Large Event Venues in Atlanta

**Generated:** 2026-02-14  
**Purpose:** Venue IDs for major festival grounds, amphitheaters, arenas, and large event spaces in Atlanta

---

## Major Festival Grounds & Parks

| Venue ID | Name | Type | Neighborhood | Events | Has Image | Notes |
|----------|------|------|--------------|--------|-----------|-------|
| **305** | Piedmont Park | park | Midtown | 72 | Yes | **Primary festival venue** - Jazz Fest, Music Midtown, Dogwood |
| **1366** | Piedmont Park - Music Midtown | park | Midtown | 2 | Yes | Specific Music Midtown sub-location |
| **9** | Piedmont Park Greystone | park | Midtown | 0 | Yes | Specific area within Piedmont |
| **147** | Centennial Olympic Park | park | Downtown | 0 | Yes | Major downtown festival ground |
| **306** | Grant Park | park | Grant Park | 2 | Yes | Grant Park Summer Shade Festival, neighborhood events |
| **308** | Historic Fourth Ward Park | park | Old Fourth Ward | 1 | Yes | Community festivals, outdoor events |
| **931** | Pullman Yards | venue | Kirkwood | 16 | Yes | **Large outdoor event space**, concerts, festivals |
| **96** | Atlantic Station | event_space | Midtown | 6 | Yes | Retail/mixed-use with outdoor event plaza |
| **307** | Westside Park | park | Westside | 1 | Yes | New large westside park |

## Amphitheaters & Music Venues (Large Capacity)

| Venue ID | Name | Type | Neighborhood | Events | Has Image | Notes |
|----------|------|------|--------------|--------|-----------|-------|
| **311** | Chastain Park Amphitheatre | music_venue | Chastain Park | 15 | Yes | **Cadence Bank Amphitheatre**, outdoor concerts |
| **140** | Coca-Cola Roxy | music_venue | Smyrna | 34 | Yes | **Major concert venue**, Battery Atlanta |
| **118** | Tabernacle | music_venue | Downtown | 61 | Yes | Downtown concert hall |

**Note:** Lakewood Amphitheatre (Cellairis Amphitheatre) does **not appear** in the database under that name. Address `2540 Lakewood Ave SW` (ID: 299) exists but has 0 events.

## Arenas & Stadiums

| Venue ID | Name | Type | Neighborhood | Events | Has Image | Notes |
|----------|------|------|--------------|--------|-----------|-------|
| **126** | State Farm Arena | arena | Downtown | 129 | Yes | Hawks, concerts, major events |
| **108** | Mercedes-Benz Stadium | arena | Downtown | 32 | Yes | Falcons, United, mega-concerts |
| **116** | Gas South Arena | arena | Duluth | 96 | Yes | Gladiators, concerts, suburban events |
| **103** | Truist Park | arena | Smyrna | 64 | No | Braves stadium, Battery events |
| **106** | McCamish Pavilion | arena | Midtown | 27 | Yes | Georgia Tech basketball |
| **105** | GSU Convocation Center | arena | Downtown | 20 | Yes | GSU sports, events |
| **624** | Bobby Dodd Stadium | arena | Midtown | 7 | Yes | Georgia Tech football |
| **625** | Russ Chandler Stadium | arena | Midtown | 32 | Yes | Georgia Tech baseball |

## Convention Centers

| Venue ID | Name | Type | Neighborhood | Events | Has Image | Notes |
|----------|------|------|--------------|--------|-----------|-------|
| **90** | Georgia World Congress Center | convention_center | Downtown | 188 | Yes | **Dragon Con**, major conventions |
| **545** | AmericasMart Atlanta | convention_center | Downtown | 0 | Yes | Trade shows, design events |
| **186** | Atlanta Convention Center at AmericasMart | convention_center | Downtown | 3 | Yes | Sub-location |
| **548** | Cobb Convention Center-Atlanta | convention_center | Cumberland | 6 | Yes | Suburban convention space |
| **129** | Cobb Galleria Centre | convention_center | Cumberland | 1 | Yes | Galleria area events |

## Special Event Spaces

| Venue ID | Name | Type | Neighborhood | Events | Has Image | Notes |
|----------|------|------|--------------|--------|-----------|-------|
| **100** | Atlanta Botanical Garden | park | Midtown | 35 | Yes | Garden events, concerts in summer |
| **170** | Atlanta BeltLine | park | Inman Park | 16 | Yes | Trail-based events, Lantern Parade |
| **540** | Candler Park | park | Candler Park | 28 | Yes | Fall Fest, neighborhood events |

---

## Data Quality Notes

### Missing Venues
- **Lakewood Amphitheatre / Cellairis Amphitheatre**: Not properly tagged. Address exists (ID: 299) but venue_type is `event_space`, should be `amphitheater` or `music_venue`.

### Venue Type Inconsistencies
- Pullman Yards (ID: 931): Type = `venue` (generic). Should be `event_space` or `music_venue`.
- Atlantic Station (ID: 96): Type = `event_space` (correct).

### Image Coverage
- **Good coverage** for major venues (90%+ have images)
- Missing images: Truist Park (ID: 103)

### Event Count Leaders (Upcoming Events)
1. Georgia World Congress Center (188 events)
2. State Farm Arena (129 events)
3. Gas South Arena (96 events)
4. Piedmont Park (72 events)
5. Truist Park (64 events)
6. Tabernacle (61 events)

---

## Recommended Actions

1. **Add Lakewood Amphitheatre** as a proper venue record:
   - Name: "Lakewood Amphitheatre" or "Cellairis Amphitheatre at Lakewood"
   - Type: `amphitheater`
   - Address: 2002 Lakewood Way SE, Atlanta, GA 30315
   - Major concert venue, should have significant event coverage

2. **Reclassify Pullman Yards**:
   - Change venue_type from `venue` to `event_space` or `music_venue`

3. **Add missing park sub-areas** if they host distinct events:
   - Old Fourth Ward Park specific zones
   - Grant Park bandshell/stage area

4. **Verify Centennial Olympic Park** event coverage:
   - ID: 147 has 0 upcoming events
   - Should host summer concerts, festivals (Shaky Knees historically)
   - May need crawler for official park calendar

---

**For queries:**
```sql
-- Get all major festival venues
SELECT id, name, venue_type, neighborhood 
FROM venues 
WHERE id IN (305, 147, 306, 308, 931, 96, 311, 140, 118, 126, 108, 116, 90, 545, 100);

-- Get events at these venues
SELECT e.id, e.title, e.start_date, v.name as venue_name
FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE v.id IN (305, 147, 306, 308, 931, 96, 311, 140, 118, 126, 108, 116, 90, 545, 100)
  AND e.start_date >= CURRENT_DATE
ORDER BY e.start_date;
```
