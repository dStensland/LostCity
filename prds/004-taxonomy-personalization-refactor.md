# PRD 004: Taxonomy Refactor & Personalization System

> **Status**: Draft
> **Date**: 2026-02-10
> **Scope**: Data model, crawling pipeline, discovery UX, community tags, federated data strategy

---

## 1. Problem Statement

LostCity has a powerful event + venue database but users can't efficiently find what they want. The core issues:

- **Taxonomy confusion**: Events have `category` + `subcategory` + `genres[]` + `tags[]` — four overlapping dimensions where subcategory and genre duplicate each other
- **Genre coverage is abysmal**: Only 30% of music events have genres; 0% of non-music events do. A user can't search "jazz tonight" and get reliable results
- **Venue discovery is genre-blind**: Venues have no genre dimension. A jazz club, a hip-hop bar, and a sports bar are all just "bar"
- **Vibes are a junk drawer**: 56% of venues have vibes, but values include neighborhoods ("kennesaw"), activities ("roller-derby"), and actual vibes ("chill") mixed together
- **Personalization is shallow**: User preferences capture categories and neighborhoods but not genres — the thing people actually care about
- **Community tags are venue-only**: The tag voting system works but is limited to venues; events, series, and festivals can't be community-tagged

## 2. The Unified Taxonomy Model

### Before (4 confusing dimensions)

```
events.category      = "music"              (broad)
events.subcategory   = "music.live.jazz"    (hierarchical, single value)
events.genres[]      = ["jazz", "bebop"]    (array, overlaps with subcategory)
events.tags[]        = ["date-night", "21+"] (array, experiential)
```

### After (3 clean dimensions)

| Field | Purpose | Applies To | Type | Example |
|-------|---------|------------|------|---------|
| **category** | What kind of thing | Events, Series, Festivals | single | `music`, `comedy`, `sports` |
| **genres[]** | What flavor/style | Events, Venues, Series, Festivals | array | `jazz`, `hip-hop`, `improv`, `documentary` |
| **tags[]** | Vibe + logistics | Events | array | `date-night`, `free`, `outdoor`, `21+` |
| **needs** | Accessibility + dietary + family (community-verified) | Venues, Events, Festivals | community tags | `wheelchair-accessible`, `gluten-free-options`, `stroller-friendly` |

Venues keep a separate **vibes[]** for atmosphere (`late-night`, `chill`, `upscale`, `dive-bar`).

**Subcategory is dropped.** Its useful values migrate into genres.

### The Taste vs. Needs Distinction

The taxonomy serves two fundamentally different user goals:

**Taste** (what you enjoy — preferences, nice-to-have):
- Categories, genres, vibes
- "I like jazz", "I prefer dive bars", "I'm into documentary film"
- Influences ranking and recommendations

**Needs** (what you require — non-negotiable, must-have):
- Accessibility, dietary, family, sensory, mobility
- "I need wheelchair access", "I'm celiac", "I have a toddler"
- **Filters results** — not a ranking boost, a hard requirement

Needs are stored in the user profile and **auto-applied** across every portal, every city. A celiac user visiting Nashville through a hotel concierge portal should automatically see venues with gluten-free options without re-entering their dietary needs. This is where community-verified tags become essential — "gluten-free options (23 people confirm)" is data you can trust with your health.

### Why Genres Apply to Venues Too

A user who says "I like jazz" wants jazz shows AND jazz bars. Genre is the cross-cutting discovery dimension:

```
Search: "jazz" →
  Events: Jazz at Apache Cafe (tonight 8pm)
  Venues: Northside Tavern (blues/jazz bar, open now)
  Series: Jazz Mondays at Apres Diem (weekly)
```

Venue genres come from two sources:
- **Explicit**: Set by crawlers/admins ("this is a jazz club")
- **Inferred**: Computed from event history (venue hosts 60% rock shows → gets `rock` genre)

### Venue Type Stays Separate

`venue_type` answers "what IS this place?" (bar, restaurant, park). `genres[]` answers "what kind of experience?" (jazz, craft-beer, southern-cuisine). They're orthogonal:

```
Northside Tavern:  venue_type=bar,  genres=[blues, jazz]
Terminal West:     venue_type=music_venue, genres=[rock, indie, electronic]
Dad's Garage:      venue_type=comedy_club, genres=[improv, sketch]
```

Some venue_types that are really genre+type combos get normalized:
- `sports_bar` → `bar` + genre `sports`
- `wine_bar` → `bar` + genre `wine`
- `cocktail_bar` → `bar` + genre `cocktails`

---

## 3. Genre Taxonomy

### Design Principles

- **8-15 genres per category** visible in UI (more available for power users)
- **Lowercase hyphenated slugs** as canonical form: `hip-hop`, `r-and-b`, `sci-fi`
- **Scoped to category**: "comedy" can be a film genre AND a theater genre without ambiguity
- **Normalization map**: All variants ("Country" / "country music" / "Rap/Hip Hop") collapse to canonical slugs
- **Multi-valued**: Events/venues can have multiple genres (a "Mexican pop-up" gets both `mexican` + `pop-up`)
- **Tags for qualifiers**: Level (professional, rec-league), diet (vegan), difficulty (beginner) are tags, not genres

### What "Genre" Means Per Category

Genre is a loose umbrella that covers different classification types depending on category. From the user's perspective, the UI interaction is identical — pick category, pick refinement pills. The underlying semantics vary:

| Category | Genre actually means | Examples | Qualifiers (tags) |
|----------|---------------------|----------|-------------------|
| Music | Genre (literal) | jazz, rock, hip-hop, electronic | touring, local-artist |
| Film | Genre (literal) | documentary, horror, comedy, sci-fi | |
| Comedy | Format/style | stand-up, improv, sketch, open-mic | |
| Theater | Form | musical, drama, ballet, opera, immersive | |
| Sports | Sport type | baseball, basketball, soccer, mma | professional, college, rec-league |
| Fitness | Activity type | yoga, running, cycling, crossfit | beginner, advanced |
| Food & Drink | Cuisine + format + drink | mexican, italian, brunch, wine, pop-up | vegan, gluten-free |
| Art | Medium/format | photography, exhibition, installation | |
| Nightlife | Activity | trivia, karaoke, drag, dj, dance-party | |
| Learning | Format | workshop, lecture, seminar, class | beginner, advanced |
| Community | Type | volunteer, meetup, networking, lgbtq | |
| Family | Activity type | storytime, crafts, science, nature | |

An event can have multiple genres to cover compound concepts: "Mexican pop-up" = `[mexican, pop-up]`, "Jazz open mic" = `[jazz, open-mic]`, "Vegan cooking class" = genre `[cooking-class]` + tag `[vegan]`.

### Canonical Genre Lists

Each category below lists **UI genres** (shown as filter pills, 8-15 per category) and **extended genres** (available in search, used by crawlers, collapsed into UI genres for display). For each genre: what it covers, example events/venues in Atlanta, and title keywords used for inference.

---

#### Music
*Genre means: musical genre/style*

**UI Genres (top 15 pills):**

| Genre | Covers | Example Events | Example Venues | Infer From Title/Desc |
|-------|--------|---------------|----------------|----------------------|
| `rock` | Rock, classic rock, southern rock, hard rock, garage rock | "Rock Lobster 90s Night" | The EARL, Masquerade | rock, guitar, riff |
| `indie` | Indie rock, indie pop, indie folk, dream pop, shoegaze | "Indie Night at 529" | 529 Bar, The Earl | indie, lo-fi, bedroom pop |
| `hip-hop` | Hip-hop, rap, trap, bounce, grime | "Hip Hop Open Mic", "Trap Night" | Aisle 5, The Masquerade | hip-hop, rap, trap, mc, cypher, freestyle |
| `r-and-b` | R&B, neo-soul, contemporary R&B, quiet storm | "R&B Sundays" | Crimson Lounge | r&b, rnb, neo-soul, quiet storm |
| `jazz` | Jazz, bebop, fusion, swing, big band, smooth jazz | "Jazz on the Lawn", "Jazz Mondays" | Northside Tavern, Cafe 290 | jazz, bebop, swing, big band, quartet, trio |
| `blues` | Blues, delta blues, electric blues, Chicago blues | "Blues Jam Night" | Northside Tavern, Blind Willie's | blues, juke joint, harmonica |
| `country` | Country, outlaw, honky-tonk, bro-country, Americana | "Country Night at Buckhead Saloon" | Buckhead Saloon, Smith's Olde Bar | country, honky-tonk, nashville |
| `folk` | Folk, Americana, roots, bluegrass, old-time | "Folk & Roots Showcase" | Eddie's Attic, Red Light Cafe | folk, acoustic, roots, americana, bluegrass, banjo, mandolin |
| `electronic` | Electronic, EDM, techno, trance, drum & bass, dubstep, ambient | "Techno Tuesdays" | Ravine, District | electronic, edm, techno, trance, dnb, dubstep, synth |
| `pop` | Pop, synth-pop, power pop, dance-pop | "Pop Goes the Venue" | Center Stage | pop, top 40, chart |
| `soul` | Soul, funk, Motown, disco, boogie | "Soul Food Sessions" | Apache Cafe | soul, funk, motown, disco, groove, boogie |
| `metal` | Metal, death metal, black metal, doom, thrash, metalcore, hardcore | "Metal Monday" | The Masquerade, Boggs | metal, death, doom, thrash, hardcore, mosh, shred |
| `punk` | Punk, post-punk, pop-punk, emo, ska-punk | "Punk Rock Flea Market" | 529 Bar, The EARL | punk, emo, ska, mosh pit |
| `latin` | Latin, salsa, bachata, reggaeton, cumbia, mariachi, Afrobeat | "Salsa Night", "Latin Fridays" | Tongue & Groove | latin, salsa, bachata, reggaeton, cumbia, merengue, afrobeat |
| `classical` | Classical, orchestra, chamber, choral, symphony | "ASO: Beethoven's 9th" | Atlanta Symphony Hall | symphony, orchestra, chamber, philharmonic, concerto, sonata |

**Extended Genres** (available in search/crawlers, map to UI genres):

| Extended | Maps to UI | Notes |
|----------|-----------|-------|
| `alternative` | `indie` | Alt-rock, post-rock, art rock |
| `singer-songwriter` | `folk` | Acoustic solo/duo acts |
| `house` | `electronic` | Deep house, tech house, progressive |
| `reggae` | `latin` | Reggae, dancehall, dub |
| `gospel` | (standalone) | Gospel, praise & worship, CCM |
| `opera` | `classical` | Opera, vocal recital |
| `world` | `latin` | World music, Afrobeat, global fusion |
| `jam` | `rock` | Jam band, extended improvisation |
| `cover` | (standalone) | Cover bands, tribute acts |
| `edm` | `electronic` | Broad EDM, festival electronic |
| `funk` | `soul` | Funk, P-Funk, go-go |
| `bluegrass` | `folk` | Bluegrass, newgrass, old-time |
| `ambient` | `electronic` | Ambient, drone, soundscape |

**On Venues**: A venue's music genres reflect what they regularly book. Terminal West = `rock`, `indie`, `electronic`. Blind Willie's = `blues`. Eddie's Attic = `folk`, `singer-songwriter`.

---

#### Film
*Genre means: film genre (literal)*

**UI Genres (12 pills):**

| Genre | Covers | Example Events | Infer From Title/Desc |
|-------|--------|---------------|----------------------|
| `action` | Action, adventure, superhero, martial arts | "Marvel Marathon" | action, adventure, superhero, marvel, dc |
| `comedy` | Comedy, rom-com, parody, satire | "Comedy Film Fest" | comedy, funny, parody, satire |
| `documentary` | Documentary, docuseries, nature doc | "Doc Night at Plaza" | documentary, doc, true story, real-life |
| `drama` | Drama, period piece, biopic, legal, war | "Oscar Showcase" | drama, biopic, period |
| `horror` | Horror, slasher, psychological, supernatural, creature | "Horrorthon", "Friday Fright Night" | horror, scary, slasher, zombie, haunted |
| `sci-fi` | Sci-fi, fantasy, dystopia, space opera | "Sci-Fi Double Feature" | sci-fi, science fiction, space, alien, dystopia, fantasy |
| `thriller` | Thriller, mystery, noir, crime, heist | "Noir Night" | thriller, mystery, noir, suspense, heist, crime |
| `indie` | Independent film, arthouse, experimental | "Indie Film Showcase" | indie, arthouse, independent, sundance, a24 |
| `animation` | Animated features, anime, stop-motion | "Anime Night", "Studio Ghibli" | animated, anime, pixar, ghibli, cartoon |
| `romance` | Romance, rom-com, love story | "Valentine's Movie Night" | romance, love story, rom-com |
| `classic` | Classic film, cult, repertory, revival | "Classic Movie Monday" | classic, repertory, revival, 35mm, cult |
| `foreign` | Foreign language, international cinema | "French Film Festival" | foreign, subtitled, international, french, korean, bollywood |

**On Venues**: Cinemas get film genres based on their programming. Plaza Theatre = `indie`, `classic`, `horror`. Regal = `action`, `comedy`, `drama`.

---

#### Comedy
*Genre means: comedy format/style*

**UI Genres (6 pills):**

| Genre | Covers | Example Events | Example Venues | Infer From Title/Desc |
|-------|--------|---------------|----------------|----------------------|
| `stand-up` | Solo stand-up sets, headline shows, comedy specials | "Live at the Punchline" | Punchline Comedy Club, Laughing Skull | stand-up, stand up, comedy special, headliner, comedian |
| `improv` | Long-form, short-form improv, audience suggestions | "Friday Night Improv" | Dad's Garage, Village Theatre | improv, improvised, audience suggestion, yes and |
| `sketch` | Sketch comedy, variety, scripted comedy | "Sketch Comedy Revue" | Dad's Garage | sketch, variety show, comedy revue |
| `open-mic` | Open mic comedy, amateur night, new material | "Comedy Open Mic Night" | Java Lords, Highland Inn | open mic, open-mic, amateur night, new material night |
| `roast` | Roasts, roast battles | "Comedy Roast Battle" | Relapse Theatre | roast, roast battle |
| `storytelling` | Story slams, comedic monologue, Moth-style | "Moth StorySLAM" | various | moth, story slam, storytelling, monologue |

**On Venues**: Dad's Garage = `improv`, `sketch`. Punchline = `stand-up`. Relapse Theatre = `improv`, `open-mic`.

---

#### Theater
*Genre means: theatrical form/tradition*

**UI Genres (10 pills):**

| Genre | Covers | Example Events | Infer From Title/Desc |
|-------|--------|---------------|----------------------|
| `musical` | Broadway-style musicals, jukebox musicals, revivals | "Hamilton", "Dear Evan Hansen" | musical, broadway, tony, soundtrack, songbook |
| `drama` | Dramatic plays, tragedies, new works | "A Raisin in the Sun" | play, drama, tragedy, premiere, playwright |
| `comedy` | Comedic plays, farce, light-hearted theater | "Noises Off" | comedy, farce, hilarious, witty |
| `ballet` | Classical ballet, contemporary ballet, modern dance | "The Nutcracker", "Giselle" | ballet, nutcracker, dance company, choreograph |
| `opera` | Grand opera, chamber opera, operetta | "La Boheme" | opera, soprano, aria, libretto, operetta |
| `immersive` | Immersive theater, interactive, site-specific, promenade | "Sleep No More style" | immersive, interactive, site-specific, choose your own |
| `spoken-word` | Poetry slam, spoken word performance | "Poetry Slam Finals" | spoken word, poetry slam, verse |
| `burlesque` | Burlesque, cabaret, variety, vaudeville | "Burlesque Revue" | burlesque, cabaret, vaudeville, striptease |
| `puppet` | Puppetry, marionette, shadow puppet | "Center for Puppetry Arts" | puppet, marionette, shadow puppet |
| `shakespeare` | Shakespeare, classic repertory | "Hamlet in the Park" | shakespeare, bard, hamlet, romeo, othello, macbeth |

**On Venues**: Alliance Theatre = `drama`, `musical`. Fox Theatre = `musical`. Center for Puppetry Arts = `puppet`. Atlanta Ballet = `ballet`.

---

#### Sports
*Genre means: sport type. Use tags for level (professional, college, rec-league, amateur).*

**UI Genres (12 pills):**

| Genre | Covers | Example Events | Example Venues | Infer From Title/Desc |
|-------|--------|---------------|----------------|----------------------|
| `baseball` | Baseball, softball, little league | "Braves vs Mets" | Truist Park | braves, baseball, mlb, softball, batting |
| `basketball` | NBA, college, rec, pickup | "Hawks vs Celtics" | State Farm Arena | hawks, basketball, nba, ncaa, hoops |
| `football` | NFL, college, flag | "Falcons vs Saints" | Mercedes-Benz Stadium | falcons, football, nfl, sec, touchdown |
| `soccer` | MLS, NWSL, international, rec | "Atlanta United vs LAFC" | Mercedes-Benz Stadium | united, soccer, mls, nwsl, fc, futbol |
| `hockey` | NHL, minor league, rec | "Gladiators Hockey" | Gas South Arena | hockey, nhl, gladiators, puck |
| `mma` | MMA, boxing, kickboxing, wrestling | "UFC Fight Night" | State Farm Arena | ufc, mma, boxing, fight night, bout, knockout |
| `racing` | NASCAR, motorsports, karting, horse racing | "Atlanta Motor Speedway" | Atlanta Motor Speedway | nascar, racing, motorsport, grand prix, derby |
| `golf` | Golf tournaments, charity scrambles | "Tour Championship" | East Lake Golf Club | golf, pga, tour championship, scramble |
| `tennis` | ATP, WTA, rec league | "Atlanta Open" | Atlantic Station | tennis, atp, wta, serve, court |
| `running` | Marathons, 5Ks, trail runs, fun runs | "Peachtree Road Race" | various | marathon, 5k, 10k, half-marathon, road race, fun run |
| `esports` | Gaming tournaments, streaming events | "League of Legends Finals" | various | esports, gaming, tournament, league of legends, valorant |
| `roller-derby` | Roller derby bouts | "Atlanta Rollergirls" | Yaarab Shrine Temple | roller derby, rollergirls, bout |

**Tags for level**: `professional`, `college`, `rec-league`, `amateur`, `youth`, `charity`

**On Venues**: Truist Park = `baseball`. Mercedes-Benz Stadium = `football`, `soccer`. State Farm Arena = `basketball`, `mma`.

---

#### Fitness
*Genre means: activity/discipline type. Use tags for level (beginner, intermediate, advanced) and style (outdoor, studio).*

**UI Genres (10 pills):**

| Genre | Covers | Example Events | Example Venues | Infer From Title/Desc |
|-------|--------|---------------|----------------|----------------------|
| `yoga` | Vinyasa, hot yoga, restorative, yin, aerial yoga | "Sunrise Yoga in the Park" | CorePower, Inner Light | yoga, vinyasa, hot yoga, yin, asana, namaste |
| `run` | Running clubs, group runs, trail runs, track | "Monday Night Run Club" | Big Peach Running Co | run club, group run, trail run, pace group, runners |
| `cycling` | Spin classes, group rides, mountain biking | "Spin & Sip" | Flywheel, SoulCycle | spin, cycling, bike ride, peloton, criterium |
| `dance` | Dance classes, social dancing, Zumba | "Salsa Social", "Bachata Night" | Salsa ATL, Arthur Murray | dance class, salsa, bachata, swing dance, two-step, zumba |
| `hike` | Group hikes, nature walks, trail outings | "Stone Mountain Sunrise Hike" | various | hike, trail walk, nature walk, guided hike |
| `crossfit` | CrossFit WODs, HIIT, bootcamp, functional fitness | "CrossFit Open" | CrossFit boxes | crossfit, wod, hiit, bootcamp, burpee, functional |
| `martial-arts` | BJJ, karate, muay thai, krav maga, self-defense | "Intro to BJJ" | various | bjj, karate, muay thai, krav maga, self-defense, jiu-jitsu |
| `pilates` | Mat pilates, reformer, barre | "Barre & Brunch" | Club Pilates, Pure Barre | pilates, reformer, barre, core work |
| `swimming` | Lap swim, open water, aqua fitness, masters | "Masters Swim Practice" | pools | swim, lap swim, open water, aqua, pool |
| `climbing` | Bouldering, top rope, outdoor climbing meetups | "Belay Night" | Stone Summit, Movement | climbing, bouldering, belay, top rope, send |

**Tags for level**: `beginner`, `intermediate`, `advanced`, `all-levels`, `outdoor`, `studio`

**On Venues**: CorePower Yoga = `yoga`. Stone Summit = `climbing`. Big Peach Running = `run`.

---

#### Food & Drink
*Genre means: cuisine type, drink specialty, or event format. Use tags for dietary needs (vegan, gluten-free, halal, etc.).*

**UI Genres (14 pills):**

| Genre | Covers | Example Events | Example Venues | Infer From Title/Desc |
|-------|--------|---------------|----------------|----------------------|
| `southern` | Southern, soul food, BBQ, Cajun/Creole, low-country | "Southern Supper Club" | Fox Bros BBQ, Busy Bee Cafe | southern, soul food, bbq, barbecue, cajun, creole, biscuit |
| `mexican` | Mexican, Tex-Mex, tacos, mezcal | "Taco Tuesday Crawl" | Superica, El Tesoro | mexican, tacos, mezcal, tequila, margarita |
| `italian` | Italian, pizza, pasta, wine pairing | "Pasta Making Workshop" | Antico Pizza, Bacchanalia | italian, pasta, pizza, trattoria, risotto |
| `asian` | Pan-Asian, Japanese, Chinese, Korean, Thai, Vietnamese, Indian | "Ramen Pop-Up" | Buford Highway spots, Wagaya | sushi, ramen, dim sum, pho, curry, bibimbap, thai, korean |
| `brunch` | Brunch events, bottomless brunch, boozy brunch | "Drag Brunch" | Sun Dial, Lyla Lila | brunch, bottomless, mimosa, bloody mary |
| `wine` | Wine tasting, wine pairing, wine dinner, natural wine | "Natural Wine Fair" | Vin Salon | wine tasting, wine pairing, sommelier, natural wine, vineyard |
| `beer` | Beer tasting, craft beer, brewery events, beer dinner | "Craft Beer Festival" | Monday Night, Sweetwater | craft beer, brewery, taproom, ipa, stout, ale, lager, brew |
| `cocktails` | Cocktail class, mixology, spirits tasting | "Mixology 101" | Paper Plane, Ticonderoga Club | cocktail, mixology, spirits, bartend, aperitif |
| `coffee` | Coffee tastings, latte art, barista events | "Coffee Cupping" | Chrome Yellow, Taproom Coffee | coffee, latte, espresso, barista, cupping, pour-over |
| `pop-up` | Pop-up dinners, supper clubs, guest chef events | "Chef's Table Pop-Up" | various | pop-up, popup, supper club, guest chef, one-night |
| `tasting` | Multi-course tasting, wine+food pairing, beer+cheese | "Cheese & Wine Pairing" | various | tasting, pairing, flight, prix fixe, multi-course |
| `cooking-class` | Hands-on cooking, baking class, culinary workshop | "Pasta From Scratch" | Sur La Table, Cook's Warehouse | cooking class, baking class, culinary, hands-on, from scratch |
| `food-festival` | Food festivals, farmers markets, food truck rallies, night markets | "Atlanta Street Food Fest" | various | food fest, farmers market, food truck, night market |
| `seafood` | Seafood, oyster bar, fish fry, crawfish boil | "Crawfish Boil" | The Optimist | seafood, oyster, crawfish, crab, shrimp, fish fry |

**Tags for dietary**: `vegan`, `vegetarian`, `gluten-free`, `halal`, `kosher`, `nut-free`, `dairy-free`, `allergy-friendly`

**On Venues**: Fox Bros = `southern`. Superica = `mexican`. Sweetwater Brewing = `beer`. Vin Salon = `wine`. Sur La Table = `cooking-class`.

---

#### Art
*Genre means: art medium, format, or event type*

**UI Genres (9 pills):**

| Genre | Covers | Example Events | Example Venues | Infer From Title/Desc |
|-------|--------|---------------|----------------|----------------------|
| `exhibition` | Gallery shows, museum exhibitions, retrospectives | "New Exhibit at High Museum" | High Museum, MOCA GA | exhibition, exhibit, gallery show, retrospective, collection |
| `gallery-opening` | Opening receptions, first Friday, art walk | "First Friday Art Walk" | Castleberry Hill galleries | opening reception, first friday, art walk, gallery night |
| `photography` | Photo exhibits, workshops, portfolio reviews | "Photo Exhibition" | Whitespace Gallery | photography, photo exhibit, darkroom, portrait |
| `sculpture` | Sculpture exhibitions, outdoor installations | "Sculpture Garden Tour" | Atlanta Botanical | sculpture, installation, outdoor art, public art |
| `street-art` | Murals, graffiti tours, live painting | "Mural Tour of Cabbagetown" | Living Walls sites | mural, graffiti, street art, live painting, wheatpaste |
| `craft` | Pottery, weaving, printmaking, craft workshops | "Pottery Workshop" | Mudfire Studio | pottery, ceramics, weaving, printmaking, letterpress, craft |
| `digital` | Digital art, NFT, AI art, new media, video art | "Digital Art Night" | various | digital art, new media, projection, video art, generative |
| `performance` | Performance art, live art, happening, durational | "Performance Art Series" | Eyedrum | performance art, happening, durational, body art |
| `market` | Art markets, maker fairs, craft fairs | "Indie Craft Experience" | Ambient+ Studio | art market, maker fair, craft fair, handmade |

**On Venues**: High Museum = `exhibition`. Mudfire = `craft`. Castleberry galleries = `gallery-opening`, `exhibition`.

---

#### Nightlife
*Genre means: nightlife activity type*

**UI Genres (9 pills):**

| Genre | Covers | Example Events | Example Venues | Infer From Title/Desc |
|-------|--------|---------------|----------------|----------------------|
| `dj` | DJ sets, club nights, dance nights | "Resident DJ Night" | Ravine, District | dj, club night, dance floor, set, spinning |
| `drag` | Drag shows, drag brunch, drag bingo, pageants | "RuPaul Watch Party + Drag" | Mary's, Lips | drag, drag show, queen, pageant, lip sync |
| `trivia` | Pub trivia, themed trivia, music trivia | "Tuesday Trivia Night" | Bookhouse Pub, Wrecking Bar | trivia, quiz night, pub quiz, team trivia |
| `karaoke` | Karaoke nights, noraebang, sing-along | "Karaoke Thursdays" | Midtown Tavern, Pon de Replay | karaoke, sing-along, noraebang, mic night |
| `dance-party` | Themed dance parties, 80s/90s night, silent disco | "80s Night", "Silent Disco" | various | dance party, 80s night, 90s night, silent disco, throwback |
| `game-night` | Board games, arcade, bingo, poker | "Board Game Night" | Joystick Gamebar, Battle & Brew | board game, bingo, arcade, game night, poker |
| `burlesque` | Burlesque shows, cabaret, variety | "Burlesque Revue" | various | burlesque, cabaret, variety show, vaudeville |
| `wine-night` | Wine bars, wine-down Wednesdays, happy hour | "Wine Down Wednesday" | Vin Salon, Room at Twelve | wine night, wine down, wine bar, happy hour |
| `cocktail-night` | Cocktail events, speakeasy nights, mixology | "Speakeasy Saturday" | Paper Plane, Ticonderoga | speakeasy, cocktail party, mixology, craft cocktail |

**On Venues**: Mary's = `drag`, `dance-party`. Joystick = `game-night`. Bookhouse Pub = `trivia`.

---

#### Learning
*Genre means: educational format/style. Use tags for level (beginner, advanced) and topic.*

**UI Genres (8 pills):**

| Genre | Covers | Example Events | Example Venues | Infer From Title/Desc |
|-------|--------|---------------|----------------|----------------------|
| `workshop` | Hands-on workshops, maker sessions, skill-building | "Intro to Letterpress" | various | workshop, hands-on, make your own, build, create |
| `class` | Multi-session courses, recurring instruction | "6-Week Photography Course" | Creative Circus | class, course, session, week series, instruction |
| `lecture` | One-off talks, keynotes, guest speakers | "Author Talk at Carter Center" | Carter Center, Emory | lecture, talk, keynote, speaker, presents |
| `seminar` | Professional seminars, panels, conferences | "Tech Panel: AI in 2026" | various | seminar, panel, conference, summit, symposium |
| `book-club` | Book discussions, reading groups, author Q&A | "Monthly Book Club" | A Cappella Books | book club, reading group, book discussion, author q&a |
| `tour` | Walking tours, museum tours, behind-the-scenes | "History Walking Tour" | various | tour, walking tour, guided, behind-the-scenes |
| `film-screening` | Educational screenings, documentary + discussion | "Doc & Discussion Night" | various | screening, film discussion, watch party, documentary night |
| `language` | Language exchange, conversation practice | "Spanish Conversation Hour" | various | language exchange, conversation, practice, spanish, french |

**Tags**: `beginner`, `advanced`, `free`, `registration-required`, `virtual`, `in-person`

**On Venues**: Carter Center = `lecture`. Creative Circus = `class`, `workshop`. A Cappella Books = `book-club`, `lecture`.

---

#### Community
*Genre means: community gathering type*

**UI Genres (8 pills):**

| Genre | Covers | Example Events | Infer From Title/Desc |
|-------|--------|---------------|----------------------|
| `volunteer` | Volunteer days, park cleanups, service projects | "BeltLine Cleanup Day" | volunteer, cleanup, service, giving back, habitat |
| `meetup` | Social meetups, interest groups, new-in-town events | "Atlanta New Residents Meetup" | meetup, social, mixer, newcomers, new in town |
| `networking` | Professional networking, industry mixers, career events | "Tech Networking Happy Hour" | networking, mixer, professional, career, industry |
| `lgbtq` | Pride events, LGBTQ+ social, queer community | "Pride March", "Queer Book Club" | pride, lgbtq, queer, trans, gay, lesbian, rainbow |
| `faith` | Church events, interfaith, spiritual gatherings | "Interfaith Dialogue" | church, faith, spiritual, worship, prayer, interfaith |
| `activism` | Rallies, town halls, civic engagement, political | "Town Hall: Housing Crisis" | rally, town hall, civic, march, protest, advocacy |
| `support` | Support groups, recovery, grief, mental health | "NAMI Support Meeting" | support group, recovery, nami, grief, wellness circle |
| `cultural` | Cultural celebrations, heritage events, diaspora gatherings | "Diwali Festival", "Lunar New Year" | cultural, heritage, diwali, lunar new year, diaspora, celebration |

**On Venues**: Community centers, churches, libraries are primary venues — they get genres based on what they primarily host.

---

#### Family
*Genre means: family activity type. Use tags for age range (toddler, kids, teens, all-ages).*

**UI Genres (8 pills):**

| Genre | Covers | Example Events | Example Venues | Infer From Title/Desc |
|-------|--------|---------------|----------------|----------------------|
| `storytime` | Story hours, read-alouds, library programs | "Saturday Storytime" | libraries, bookstores | storytime, story hour, read-aloud, story time |
| `crafts` | Art projects, maker activities for kids, DIY | "Kids Craft Saturday" | various | craft, art project, make your own, diy, painting |
| `science` | Science experiments, STEM, nature exploration | "Science Night at Fernbank" | Fernbank, SCAD | science, stem, experiment, nature, discovery |
| `nature` | Nature walks, animal encounters, garden programs | "Zoo Keeper Talk" | Zoo Atlanta, Botanical Garden | nature walk, animal, zoo, garden, wildlife, butterfly |
| `puppet-show` | Puppet shows, marionettes, children's theater | "Rudolph Puppet Show" | Center for Puppetry Arts | puppet, marionette, puppet show |
| `festival` | Family festivals, fairs, carnivals, seasonal events | "Fall Festival at the Farm" | various | festival, fair, carnival, hayride, pumpkin, egg hunt |
| `music-for-kids` | Kids concerts, sing-alongs, music classes | "Toddler Rock" | various | kids concert, sing-along, music class, toddler, little |
| `outdoor-play` | Playground events, splash pads, sports days | "Play Day at Piedmont Park" | parks | play day, splash pad, playground, field day |

**Tags for age**: `toddler` (0-3), `preschool` (3-5), `kids` (5-12), `teens` (13-17), `all-ages`

**On Venues**: Center for Puppetry Arts = `puppet-show`. Fernbank = `science`, `nature`. Zoo Atlanta = `nature`.

---

#### Outdoor
*Genre means: outdoor activity type*

**UI Genres (7 pills):**

| Genre | Covers | Example Events | Example Venues | Infer From Title/Desc |
|-------|--------|---------------|----------------|----------------------|
| `parks` | Park events, picnics, lawn activities | "Movies in the Park" | Piedmont Park, Grant Park | park, picnic, lawn, green space |
| `garden` | Garden tours, botanical events, plant sales | "Spring Plant Sale" | Atlanta Botanical Garden | garden, botanical, plant, bloom, flower |
| `market` | Outdoor markets, flea markets, artisan markets | "Ponce City Market Pop-Up" | various | market, flea market, artisan, vendor, outdoor market |
| `sightseeing` | Walking tours, scenic overlooks, city exploration | "BeltLine Art Walk" | BeltLine, Skyline Park | tour, sightseeing, scenic, overlook, walk, beltline |
| `water` | Kayaking, paddleboarding, lake events, river trips | "Chattahoochee Paddle" | Chattahoochee | kayak, paddle, canoe, river, lake, water |
| `camping` | Group camping, stargazing, overnight outdoors | "Stargazing at Kennesaw" | state parks | camping, stargazing, campfire, overnight |
| `adventure` | Zip-lining, ropes courses, outdoor challenges | "Treetop Adventure" | various | adventure, zip line, ropes course, obstacle |

**On Venues**: Piedmont Park = `parks`. Atlanta Botanical Garden = `garden`. Stone Mountain = `sightseeing`, `adventure`.

---

#### Words & Literature
*Genre means: literary event format (category: `words`)*

**UI Genres (7 pills):**

| Genre | Covers | Example Events | Example Venues | Infer From Title/Desc |
|-------|--------|---------------|----------------|----------------------|
| `reading` | Author readings, book signings, launch parties | "Author Reading + Signing" | A Cappella Books | reading, signing, book launch, author event |
| `poetry` | Poetry slams, open mic poetry, spoken word | "Poetry Open Mic" | Java Monkey, Eyedrum | poetry, slam, spoken word, verse, poem |
| `book-club` | Book club meetings, reading groups | "Sci-Fi Book Club" | libraries, bookstores | book club, reading group, book discussion |
| `storytelling` | Story slams, Moth-style, narrative events | "StorySLAM" | various | storytelling, story slam, moth, narrative, tale |
| `writing` | Writing workshops, NaNoWriMo, critique groups | "Fiction Workshop" | various | writing workshop, nanowrimo, critique, fiction writing |
| `comics` | Comic book events, zine fairs, graphic novel discussions | "Zine Fest Atlanta" | Criminal Records | comic, zine, graphic novel, manga |
| `literary-festival` | Multi-day literary events, book fairs | "Decatur Book Festival" | various | book festival, literary fest, book fair |

**On Venues**: A Cappella Books = `reading`, `book-club`. Criminal Records = `comics`. Libraries = `book-club`, `reading`, `storytelling`.

### Genre Normalization Map

Applied at insert time in crawlers and during backfill:

```python
GENRE_NORMALIZATION = {
    # Case + spelling
    "Country": "country", "country music": "country", "COUNTRY": "country",
    "Hip-Hop": "hip-hop", "Hip Hop": "hip-hop", "Rap/Hip Hop": "hip-hop",
    "R&B": "r-and-b", "r&b": "r-and-b", "RnB": "r-and-b",
    "EDM": "edm", "Electronic": "electronic",
    "Singer/Songwriter": "singer-songwriter",

    # Merge near-duplicates
    "alternative rock": "alternative", "indie rock": "indie", "indie pop": "indie",
    "punk rock": "punk", "hard rock": "rock", "classic rock": "rock",
    "death metal": "metal", "heavy metal": "metal", "metalcore": "metal",
    "deep house": "house", "tech house": "house",
    "dubstep": "electronic", "trance": "electronic", "drum and bass": "electronic",
    "trap": "hip-hop", "americana": "folk", "roots": "folk",
    "neo-soul": "soul", "contemporary r&b": "r-and-b",
    ...
}
```

---

## 4. Vibe Cleanup

Venue vibes should be **atmosphere descriptors only**. Remove junk:

### Valid Vibes (curated list)
**Atmosphere**: `chill`, `upscale`, `intimate`, `high-energy`, `artsy`, `cozy`, `gritty`, `trendy`, `historic`
**Scene**: `dive-bar`, `speakeasy`, `rooftop`, `patio`, `late-night`, `neighborhood-spot`, `destination`
**Social**: `date-spot`, `group-friendly`, `solo-friendly`, `lgbtq-friendly`, `family-friendly`
**Features**: `live-music`, `outdoor-seating`, `dog-friendly`, `craft-beer`, `natural-wine`

### Invalid Vibes (to be removed or reclassified)
- Neighborhoods: `kennesaw`, `west-end` → delete (use `neighborhood` field)
- Activities: `roller-derby`, `roller-skating`, `women-sports` → move to genres or delete
- Types: `brewery`, `museum`, `fitness` → already in `venue_type`
- Meaningless: `unique`, `curator-vetted` → delete

---

## 5. Discovery UX

### 5.1 Genre-Powered Filter Bar

When user selects a category, genre pills appear:

```
[Music v]  [Tonight v]  [Free & Paid]  [+ Filters]

Jazz  Hip-Hop  Indie  Electronic  Rock  Country  +12 more
```

- Pills ordered: user's preferred genres first, then popular, then alpha
- Tapping a genre applies filter, shows count badge ("47 jazz events")
- Genre selection persists per category across sessions
- Multiple genres can be selected (OR logic)

### 5.2 Cross-Entity Genre View

URL: `/[portal]/genres/[slug]` (e.g., `/atlanta/genres/jazz`)

Shows unified results:
- **Jazz Events** (chronological, next 30 days)
- **Jazz Venues** (by distance or popularity)
- **Jazz Series** (by next occurrence)

Each section shows top 3-5 with "See all" expansion. Users can "Follow" a genre to add it to their taste profile.

### 5.3 "Tonight" Mode

Prominent toggle in filter bar. When active:
- Only events starting in next 6 hours
- Relative timestamps: "Starts in 2 hours" (not "8:00 PM")
- Sort by soonest first
- Include "Open Now" venues matching user's genre prefs

### 5.4 Tags on Event Cards

Show max 3 tags as small pills below event title:
- Priority: `free` > `outdoor` > `date-night` > by community vote count
- Age tags (`21+`) as icon, not text pill
- `free` gets accent color background

### 5.5 Genre on Venue Cards

Show venue genres separately from vibes:
```
Northside Tavern
Blues Bar · Collier Heights
Vibes: dive-bar, late-night, live-music
Genres: blues, jazz
```

---

## 6. Personalization

### 6.1 Onboarding (3 screens, < 45 seconds)

**Screen 1: "What brings you out?"** — Category selection
- Visual grid of 8-10 categories with icons
- Multi-select, minimum 3
- Pre-select Music, Food & Drink, Nightlife as defaults

**Screen 2: "Dial it in"** — Genre selection (contextual)
- Show 15-20 genre pills based on category picks
- Music selected? → jazz, hip-hop, indie, electronic, country, rock, folk, soul
- Comedy selected? → stand-up, improv, sketch
- Multi-select, minimum 5

**Screen 3: "Where & when?"** — Location + lifestyle
- Map with tappable neighborhood boundaries
- Quick toggles: Weeknight regular / Weekend warrior / Anytime
- Price preference: $ / $$ / $$$ / Any

**Screen 4 (optional): "Anything we should know?"** — Needs
- Only shown if user doesn't skip
- Friendly framing: "We'll keep these in mind everywhere you go"
- Toggle chips: Wheelchair accessible, Gluten-free, Vegan, Kid-friendly, ASL, Sensory-friendly
- "These help us filter results and show verified info"
- Skip is prominent — most users won't need this, but those who do will love it

Skip button on every screen. Feed still works without onboarding (falls back to popular + portal city).

### 6.2 User Preference Model

```sql
user_preferences:
  -- Taste (influences ranking)
  favorite_categories[]    -- broad interests
  favorite_genres JSONB    -- per-category: {"music": ["jazz","blues"], "film": ["documentary"]}
  favorite_neighborhoods[] -- where they go
  favorite_vibes[]         -- atmosphere they like
  price_preference         -- budget
  onboarding_mood          -- initial mood selection (legacy, keep for now)

  -- Needs (filters results, travels across portals/cities)
  needs_accessibility[]    -- ["wheelchair-accessible", "accessible-restroom"]
  needs_dietary[]          -- ["gluten-free-options", "vegan-options"]
  needs_family[]           -- ["stroller-friendly", "kid-friendly"]
```

Per-category genre prefs because "I like jazz" (music) doesn't mean "I like jazz-themed films."

Needs are separate from taste because they serve a different function: taste influences ranking (boost jazz events), needs filter results (deprioritize inaccessible venues, surface verified-accessible ones). Needs persist across all portals and cities — they describe the person, not the context.

### 6.3 Implicit Taste Signals

Extend `inferred_preferences` to track genre affinity from behavior:

| Action | Signal Score |
|--------|-------------|
| RSVP "going" | +5.0 |
| Check-in | +4.0 |
| Save/bookmark | +3.0 |
| RSVP "interested" | +2.0 |
| Add community tag | +2.0 |
| Detail view >5s | +1.0 |
| Dismiss / "not interested" | -1.0 |

Time decay: 30-day half-life. Signals from 3 months ago matter less than last week's.

### 6.4 For You Feed Sections

1. **"Tonight's Picks for You"** — Top 3 events matching genres + neighborhoods + today
2. **"Because you like [Genre]"** — Genre-specific section (triggered at 3+ interactions)
3. **"Trending in [Neighborhood]"** — Popular in saved neighborhoods, social proof badges
4. **"Venues you'll love"** — Genre + vibe matching for venue discovery
5. **"Discover: [New Genre]"** — Serendipity section, adjacent genres ("indie fans also love folk")
6. **"Coming Up"** — Chronological catch-all with date headers

Every recommendation has an explanation: "Because you saved Mary's Bar", "Jazz fans also loved this", "Trending in East Atlanta."

### 6.5 Portal-Specific Personalization

| Portal Type | Onboarding | Default View | Persistence |
|-------------|-----------|--------------|-------------|
| **City** | Full 3-screen | For You feed | Permanent |
| **Hotel** | None (urgency-first) | Tonight + Walking Distance | Session only |
| **Neighborhood** | Skip location screen | Hyper-local feed | Permanent |
| **Venue Network** | None | Events across venues | Permanent |

Hotel guests don't build taste profiles — their data is session-scoped and private to that portal.

---

## 7. Community Tags — Expand Beyond Venues

### 7.1 Extend to All Entities

Currently only venues have community tags. Extend to events, series, and festivals using the same pattern (separate tables per entity type, shared tag definitions).

Rename `venue_tag_definitions` → `tag_definitions` with `entity_types[]` column indicating which entities each tag applies to.

### 7.2 Tag Categories

| Category | Example Tags | Applies To |
|----------|-------------|------------|
| **Vibe** | great-sound, intimate, rowdy, chill | venues, events |
| **Good For** | date-night, group-hangs, solo-friendly, making-friends | venues, events, festivals |
| **Accessibility** | wheelchair-accessible, elevator-access, hearing-loop, asl-interpreted, sensory-friendly, service-animal-welcome, accessible-parking, accessible-restroom | venues, events, festivals |
| **Dietary** | gluten-free-options, vegan-options, halal, kosher, nut-free, dairy-free, allergy-friendly-menu | venues, festivals |
| **Family** | stroller-friendly, kid-friendly, nursing-room, changing-table, play-area | venues, festivals |
| **Amenity** | free-wifi, parking-available, outdoor-seating, dog-friendly | venues |
| **Heads Up** | cash-only, long-lines, loud, bring-a-blanket, limited-seating | venues, events, festivals |

### 7.3 Needs Profile (Auto-Filter)

Unlike taste preferences which influence ranking, **needs are hard filters**. A user sets them once and they persist across every session, every portal, every city.

```
User Needs Profile:
  accessibility: [wheelchair-accessible, accessible-restroom]
  dietary: [gluten-free-options]
  family: [stroller-friendly]
```

**How needs auto-filter works:**
1. User sets needs during onboarding or in settings
2. When browsing venues/events, results without matching community tags get **deprioritized** (not hidden — the tags may just be missing)
3. Results WITH confirmed need tags get a **trust badge**: "Wheelchair accessible (34 confirm)"
4. Results with **conflicting** heads-up tags get a warning: "Heads up: no elevator access"

**Why not hard-filter?** Because community tag coverage will be sparse initially. Hard-filtering would show empty results. Instead:
- **Confirmed match** → boosted, trust badge shown
- **No data** → shown normally, with "Help verify: is this accessible?" prompt
- **Confirmed mismatch** → shown with warning, deprioritized

As tag coverage grows, needs filtering can become stricter.

**Needs travel with the user:**
- Set dietary:gluten-free in Atlanta → auto-applied when visiting Nashville hotel portal
- Set accessibility:wheelchair in city portal → auto-applied when using any portal
- Needs are **network-wide** (not portal-scoped) because they're about the person, not the context

**Community verification is critical for needs:**
Tags like "wheelchair-accessible" are only trustworthy when multiple people confirm. Display verification count prominently: "Wheelchair accessible (47 people confirm)" vs "Wheelchair accessible (1 person tagged)". Higher confirmation = higher trust signal in results.

### 7.3 Voting UX

**Upvote-only** (positive community — no downvotes). Tap a tag to upvote, tap again to remove your vote.

**When to prompt for tags:**
- After RSVP: "Help others — is this good for date night?"
- After check-in: "How was [venue]?" → tap vibe pills
- On detail page scroll: "Been here? Add your take"

**Quality controls:**
- Max 5 tags per user per entity
- Rate limit: 20 votes per hour
- New tag suggestions require 3+ users to suggest same term before review
- Trust tiers: higher-trust users get auto-approved suggestions

### 7.4 Materialized Views

Switch from per-statement trigger refresh to **batch refresh every 5 minutes** (cron). The materialized view is a performance optimization; frontend can fall back to direct query for real-time reads.

---

## 8. Federated Data Strategy

### 8.1 What Data Creates Moat

In order of defensibility:

1. **Needs-verified accessibility & dietary data** — The single most defensible data in the system. This data can't be crawled, can't be faked, and creates the deepest user loyalty. A wheelchair user or celiac who finds a platform with reliable, community-verified accessibility/dietary data will NEVER leave. Google says "wheelchair accessible" based on business self-reports. We say "wheelchair accessible (47 people confirm, including accessible restroom)." That trust difference is the moat. This data also has immediate B2B value — hotels serving guests with accessibility needs depend on reliable local information.

2. **Taste profiles (genre + venue affinity)** — Cross-portal, cross-city, impossible to replicate without the federated architecture. Every portal and every city makes the taste graph richer.

3. **Community tags with votes** — User-generated knowledge that can't be crawled, bought, or AI-generated. "Cash Only", "Great for First Dates", "Hidden Gem" — this is local intelligence.

4. **Check-ins / attendance signals** — Social proof layer ("23 people checked in this week") that no competitor has for local events.

5. **Saves / demand signals** — "400 people saved this event" is valuable for ranking AND for B2B analytics to venues/promoters.

### 8.2 Cross-Portal Data Flow

**Network-wide** (all portals see):
- Tag definitions (vocabulary)
- Tags applied to entities + votes
- Check-in counts (anonymous/aggregated)
- All venue, event, series, festival records
- Genre assignments

**Portal-scoped** (only originating portal sees):
- Individual user taste profiles
- Individual user saves/RSVPs
- Onboarding preferences
- Portal-specific analytics

**How enrichment flows up:**
```
Hotel guest tags Mary's Bar as "Hidden Gem"
  → venue_tags table (global, visible to all portals)
  → Guest's taste signal logged with portal_id=forth (scoped)
  → Atlanta city portal shows the tag
  → Tag benefits every portal that includes Mary's Bar
```

### 8.3 Multi-City Compounding

When LostCity expands to Nashville:
- **Touring artists**: Genre data from Atlanta shows auto-tags Nashville events
- **Taste portability**: Atlanta user visits Nashville → instant personalized recommendations
- **Cross-city intelligence**: "Indie rock fans in Atlanta also love East Nashville's indie scene"
- **Each new city makes existing cities more valuable** — taste profiles get richer, switching costs increase

### 8.4 B2B Data Products

**Enterprise portal analytics** (justify premium pricing):
- "Your guests prefer indie rock 2.3x more than market average"
- "Top genres: Indie Rock (32%), Jazz (18%), Comedy (14%)"
- "Trending up among your audience: Natural wine bars (+40%)"
- "Your audience vs. city benchmark" comparison charts

**Venue analytics** (future revenue stream):
- "Your venue ranks #4 for 'dive bar' in East Atlanta"
- "Audience genre affinity: indie rock 45%, folk 22%, punk 18%"
- "Events you host that over-perform: jazz nights (+60% saves vs avg)"

---

## 9. Schema Changes

### New Columns
```sql
ALTER TABLE venues ADD COLUMN genres TEXT[];
ALTER TABLE festivals ADD COLUMN genres TEXT[];
ALTER TABLE user_preferences ADD COLUMN favorite_genres JSONB DEFAULT '{}';
ALTER TABLE user_preferences ADD COLUMN needs_accessibility TEXT[];
ALTER TABLE user_preferences ADD COLUMN needs_dietary TEXT[];
ALTER TABLE user_preferences ADD COLUMN needs_family TEXT[];
ALTER TABLE inferred_preferences ADD COLUMN portal_id UUID REFERENCES portals(id);
ALTER TABLE genre_options ADD COLUMN is_format BOOLEAN DEFAULT FALSE;
```

### New Indexes
```sql
CREATE INDEX idx_venues_genres ON venues USING GIN (genres);
CREATE INDEX idx_festivals_genres ON festivals USING GIN (genres);
```

### New Tables
```sql
-- Series tags (same pattern as venue_tags/event_tags)
series_tags (id, series_id, tag_id, added_by, created_at)
series_tag_votes (id, series_tag_id, user_id, vote_type, created_at)

-- Festival tags
festival_tags (id, festival_id, tag_id, added_by, created_at)
festival_tag_votes (id, festival_tag_id, user_id, vote_type, created_at)
```

### Materialized View
```sql
-- Venue genre inference from event history
CREATE MATERIALIZED VIEW venue_genre_inference AS
SELECT venue_id, genre, COUNT(*) as event_count,
       COUNT(*) FILTER (WHERE start_date >= CURRENT_DATE - INTERVAL '90 days') as recent_count
FROM events, unnest(genres) AS genre
WHERE start_date >= CURRENT_DATE - INTERVAL '365 days'
GROUP BY venue_id, genre
HAVING COUNT(*) >= 3;
```

### Rename
```sql
ALTER TABLE venue_tag_definitions RENAME TO tag_definitions;
-- Add entity_types[] column for scoping which entities each tag applies to
-- Create backwards-compatible view: venue_tag_definitions
```

### Search Vectors
Update event + venue search vector triggers to include genres (weight B).

### Deprecation
```sql
COMMENT ON COLUMN events.subcategory IS 'DEPRECATED: Migrated to genres[]. Will be removed.';
-- Keep column for 4+ weeks during frontend migration, then DROP
```

---

## 10. Implementation Phases

### Phase 1: Data Foundation (Week 1-2)
**Goal**: Schema ready, genres populated, crawlers updated

- [ ] Database migrations: add genres to venues/festivals, expand genre_options, rename tag_definitions
- [ ] Create `crawlers/genre_normalize.py` — normalization map + functions
- [ ] Backfill events.genres from subcategory values (normalize during migration)
- [ ] Backfill venue genres from venue_type normalization (sports_bar → bar + genre:sports)
- [ ] Update `tag_inference.py`: replace `infer_subcategory()` with `infer_genres()` returning list
- [ ] Update `db.py`: `insert_event()` calls `normalize_genres()`, writes genres not subcategory
- [ ] Update Ticketmaster + other crawlers that set subcategory → set genres instead
- [ ] Run MusicBrainz/Wikidata genre backfill on ungenred music events
- [ ] Title-based genre inference for remaining music events ("Jazz Brunch" → jazz)
- [ ] Clean venue vibes: remove neighborhoods, activities, types; keep atmosphere only
- [ ] Build venue_genre_inference materialized view
- [ ] Update search vectors to include genres
- [ ] Verify: `npx tsc --noEmit` clean, pytest passes

### Phase 2: Discovery UX (Week 3-4)
**Goal**: Users can filter by genre, discover cross-entity

- [ ] Genre filter pills in Find view (appear below category selection)
- [ ] Genre landing pages (`/[portal]/genres/[slug]`) with unified events + venues + series
- [ ] Cross-entity genre search (RPC function: search_by_genre)
- [ ] Update event cards to show genres
- [ ] Update venue cards to show genres separately from vibes
- [ ] Filter state in URL params (shareable: `?category=music&genres=jazz,blues`)
- [ ] "Tonight" mode with relative timestamps
- [ ] Frontend reads genres[] instead of subcategory (backward compat during transition)

### Phase 3: Personalization (Week 5-6)
**Goal**: Users get personalized discovery powered by genres

- [ ] New onboarding flow (3 screens: categories → genres → location)
- [ ] user_preferences.favorite_genres (per-category JSONB)
- [ ] Extend inferred_preferences with genre signal tracking
- [ ] "Because you like [Genre]" feed sections
- [ ] Genre affinity scoring with time decay
- [ ] Recommendation explanations on all For You items
- [ ] "Follow Genre" button on genre pages
- [ ] Settings page: "Genres You Love" (explicit + inferred, editable)

### Phase 4: Community Tags (Week 7-8)
**Goal**: Tags on all entities, voting activated

- [ ] Extend tag system to events, series, festivals (new tables + migrations)
- [ ] Tag display on event/venue detail pages with vote counts
- [ ] Tag voting UX (upvote-only, tap to vote)
- [ ] Post-RSVP tag prompt ("Is this good for date night?")
- [ ] Post-check-in vibe prompt
- [ ] Tag suggestion flow with moderation queue
- [ ] Batch materialized view refresh (replace per-statement triggers)
- [ ] Portal operator tag contribution (attributed to portal)

### Phase 5: Federated Intelligence (Week 9-12)
**Goal**: Cross-portal data enrichment, B2B analytics

- [ ] portal_id attribution on inferred_preferences + activities
- [ ] Portal-scoped taste profile privacy (hotel portal sees only its own signals)
- [ ] Enterprise taste intelligence dashboard (genre trends, audience benchmarks)
- [ ] Venue genre affinity analytics
- [ ] Cross-portal enrichment metrics ("Your portal contributed 42 tags this month")
- [ ] Contextual recommendations (time-of-day, day-of-week awareness)
- [ ] "Discover" serendipity section (adjacent genre suggestions)

### Phase 6: Cleanup (Week 13+)
**Goal**: Remove deprecated code

- [ ] Drop events.subcategory column (after confirming 0 reads)
- [ ] Remove sports_bar, wine_bar, cocktail_bar from venue_type taxonomy
- [ ] Remove infer_subcategory() from tag_inference.py
- [ ] Archive SubcategoryRow component

---

## 11. Success Metrics

### Data Quality
| Metric | Current | Target (Phase 1) | Target (Phase 3) |
|--------|---------|-------------------|-------------------|
| Music events with genres | 30% | 80% | 95% |
| All events with genres | 8% | 60% | 85% |
| Venues with genres | 0% | 30% | 50% |
| Venues with clean vibes | 56% (dirty) | 70% (clean) | 80% (clean) |

### Discovery Engagement
| Metric | Current | Target (6 months) |
|--------|---------|-------------------|
| Genre filter usage | 0% | 40% of find sessions |
| Avg cards viewed per session | ~8 | 15+ |
| Cross-entity discovery (event + venue in same genre) | 0% | 25% of sessions |
| For You feed RSVP rate | baseline | 60% of RSVPs from personalized feed |

### Community
| Metric | Current | Target (6 months) |
|--------|---------|-------------------|
| Tag coverage (venues) | ~10% | 40% |
| Tag coverage (events) | 0% | 20% |
| Tag contribution rate (post-RSVP) | 0% | 30% |
| Onboarding completion | N/A | 70% |

### Network Effects
| Metric | Target (12 months) |
|--------|-------------------|
| Cross-portal users (2+ portals) | 15% |
| Avg genre signals per user | 25+ |
| Portal enrichment contributions | 100/portal/month |
| Taste profile accuracy (click-through on recs) | 75% |

---

## 12. Competitive Position

### What This Creates That Competitors Can't Match

| Capability | Google Events | Eventbrite | Yelp | LostCity |
|-----------|--------------|------------|------|----------|
| Cross-entity genre search | Basic | Events only | Venues only | Events + Venues + Series |
| White-label personalization | No | Limited | No | Full |
| Community-curated tags | No | No | Reviews only | Structured tags + voting |
| Federated taste graph | No | No | No | Cross-portal, cross-city |
| Destination discovery (no events) | Yes | No | Yes | Yes + genre-powered |
| Touring artist intelligence | No | Partial | No | MusicBrainz + event history |

### The Moat Sequence

1. **Genre taxonomy** → better discovery → more user engagement
2. **Engagement** → behavioral signals → richer taste profiles
3. **Taste profiles** → better personalization → higher retention
4. **Retention** → more community tags → more defensible data
5. **Community data** → B2B analytics → portal customer lock-in
6. **Portal customers** → more portals → more cross-portal signals
7. **Cross-portal signals** → richer taste graph → harder to replicate

Each step compounds. A competitor starting today would need years to build the taste graph that emerges from this flywheel.

---

## Appendix A: Genre Normalization Map

Full mapping from raw genre strings to canonical slugs. Maintained in `crawlers/genre_normalize.py`. See Section 3.

## Appendix B: Subcategory → Genre Migration Map

```
music.live           → (no genre, just category:music)
music.live.rock      → genre: rock
music.live.jazz      → genre: jazz
music.live.hiphop    → genre: hip-hop
music.live.electronic → genre: electronic
music.live.country   → genre: country
music.live.metal     → genre: metal
music.live.pop       → genre: pop
music.live.latin     → genre: latin
music.live.acoustic  → genre: singer-songwriter
music.live.classical → genre: classical
music.live.openmic   → genre: open-mic (move to category: music)
music.concert        → (no genre, just category:music)
music.rock           → genre: rock
music.country        → genre: country
music.pop            → genre: pop
music.alternative    → genre: alternative
music.classical      → genre: classical
music.live           → (no genre)
comedy.improv        → genre: improv
comedy.standup       → genre: stand-up
comedy.sketch        → genre: sketch
comedy.openmic       → genre: open-mic
theater.play         → genre: drama
theater.musical      → genre: musical
theater.dance        → genre: ballet
film.cinema          → (no genre, just category:film)
film.documentary     → genre: documentary
sports.baseball      → genre: baseball
sports.softball      → genre: baseball
sports.fitness       → (move to category: fitness)
nightlife.lgbtq      → genre: lgbtq (move to tag or community genre)
nightlife.club       → genre: dj
nightlife.karaoke    → genre: karaoke
food_drink.farmers_market → genre: food-festival (approximate)
outdoor.sightseeing  → (no genre, just category:outdoor)
art.exhibition       → genre: exhibition
art.arts.workshop    → genre: craft (or workshop)
art.performance      → (no genre, just category:art)
words.reading        → genre: book-club (approximate)
family.festival      → (no genre, just category:family)
family.kids          → (no genre)
family.puppetry      → genre: puppet-show
community.gaming     → genre: game-night (move to nightlife?)
```

## Appendix C: Valid Venue Vibes (Curated)

```
# Atmosphere
chill, upscale, intimate, high-energy, artsy, cozy, gritty, trendy, historic, eclectic

# Scene
dive-bar, speakeasy, rooftop, patio, late-night, neighborhood-spot, destination, hidden-gem

# Social
date-spot, group-friendly, solo-friendly, lgbtq-friendly, family-friendly, locals-hangout

# Features
live-music, outdoor-seating, dog-friendly, craft-beer, natural-wine, dancing, good-coffee
```
