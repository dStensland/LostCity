# Museum & Gallery Crawler Research - Quick Scan Table

| Venue Name | ID | Verdict | Best URL | Notes |
|------------|-----|---------|----------|-------|
| **APEX Museum** | 216 | **CRAWLABLE** | https://www.apexmuseum.org/events-2026 | Events + exhibitions, Squarespace |
| **Hammonds House Museum** | 218 | **CRAWLABLE** | http://www.hammondshousemuseum.org/current-exhibit | Current exhibit + events page |
| **Jimmy Carter Library** | 220 | **CRAWLABLE** | http://www.jimmycarterlibrary.gov/events | Events calendar, programs |
| **Sandler Hudson Gallery** | 237 | **CRAWLABLE** | http://www.sandlerhudson.com/ | Crawl homepage for current show |
| **Clark Atlanta Art Museum** | 304 | **CRAWLABLE** | https://www.cau.edu/.../current-exhibitions | University museum, rotating shows |
| **The King Center** | 986 | **CRAWLABLE** | https://thekingcenter.org/events/ | Programs and talks |
| **Millennium Gate Museum** | 4062 | **VERIFY FIRST** | https://www.thegatemuseum.org/exhibitions | May be outdated, check manually |
| **ADAMA** | 2433 | **VERIFY FIRST** | https://www.adamatl.org/events | Shows "temporarily closed" |
| **Whitespace Gallery** | 234 | **VERIFY** | https://whitespace814.com/exhibitions | JavaScript-heavy, manual check |
| **Marcia Wood Gallery** | 238 | **VERIFY** | http://www.marciawoodgallery.com/exhibitions/ | Verify update frequency |
| **Mason Fine Art** | 236 | **VERIFY** | https://masonfineartandevents.com/exhibitions | Verify active status |
| **MOCA GA** | 586 | NOT_CRAWLABLE | https://www.mocaga.org | Closed (confirmed) |
| **CDC Museum** | 3786 | NOT_CRAWLABLE | https://www.cdc.gov/museum | Temporarily closed |
| **SCAD FASH** | 1247 | NOT_CRAWLABLE | http://www.scadfash.org/ | Returns 403 Forbidden |
| **Poem88 Gallery** | 435 | NOT_CRAWLABLE | https://www.poem88.com | SSL error |
| **Get This Gallery** | 245 | NOT_CRAWLABLE | http://getthisgallery.com | **DEFUNCT** (domain for sale) |
| **Besharat Gallery** | 242 | NOT_CRAWLABLE | https://www.besharatgallery.com/ | Empty landing page |
| **Hathaway Contemporary** | 463 | NOT_CRAWLABLE | http://hathawaygallery.com | No 2026/2027 dates |
| **World of Coca-Cola** | 209 | PERMANENT | http://www.worldofcoca-cola.com | Static tourist attraction |
| **Trap Music Museum** | 4073 | PERMANENT | https://trapmusicmuseum.com | Fixed exhibit space |
| **Margaret Mitchell House** | 224 | PERMANENT | .../margaret-mitchell-house | No exhibitions program |
| **Rhodes Hall** | 4049 | PERMANENT | https://rhodeshall.org/ | Event venue only |
| **Fernbank Science Center** | 225 | PERMANENT | http://www.fernbank.edu | Check if duplicate of Fernbank Museum |

---

## Legend

- **CRAWLABLE**: Build crawler, content is active and changing
- **VERIFY FIRST**: Manually check before building crawler
- **NOT_CRAWLABLE**: Do not build (closed, technical issues, or defunct)
- **PERMANENT**: No changing exhibitions/events to crawl

---

**Next Action**: crawler-dev prioritizes the 6 CRAWLABLE venues marked in bold
