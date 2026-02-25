# Performance Audit (2026-02-19T00:33:38.508Z)

Base URL: http://127.0.0.1:4010

| Endpoint | Status | Cold | Warm | Delta | Payload |
|---|---:|---:|---:|---:|---:|
| search_instant | 200 | 350.6 ms | 259.0 ms | 91.6 ms | 4.6 KB |
| portal_feed | 200 | 2.7 ms | 1.8 ms | 0.9 ms | 96.2 KB |
| showtimes | 200 | 1.3 ms | 1.4 ms | -0.1 ms | 8.6 KB |
| happening_now | 200 | 336.3 ms | 239.4 ms | 96.9 ms | 0.0 KB |
| trending | 200 | 131.3 ms | 160.7 ms | -29.4 ms | 0.0 KB |
| classes | 200 | 175.8 ms | 210.9 ms | -35.1 ms | 26.7 KB |
| specials | 200 | 2.6 ms | 2.9 ms | -0.3 ms | 142.9 KB |
| around_me | 200 | 1001.9 ms | 1.6 ms | 1000.3 ms | 28.6 KB |
| spots | 200 | 1049.0 ms | 5.0 ms | 1044.0 ms | 228.4 KB |
| tonight | 200 | 2.2 ms | 1.1 ms | 1.1 ms | 5.8 KB |

## Flags
- No cold-path endpoints above 1.5s in this run.