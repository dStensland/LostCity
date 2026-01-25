---
description: Create or debug an event source crawler
---

# Crawler Task

$ARGUMENTS

## Guidelines

Reference crawler-dev agent in `.claude/agents/crawler-dev.md`.

- Check existing similar crawlers in `crawlers/sources/` for patterns
- Test with `python main.py --source <name> --dry-run`
- Follow async patterns and error handling conventions
- Ensure proper date parsing for the source's format

## Crawler Structure
```python
async def crawl(session, config):
    # Fetch page content
    # Parse HTML or JSON
    # Return list of raw event dicts for extraction
```

## Key Files
- `crawlers/sources/` - All source crawlers
- `crawlers/extract.py` - LLM extraction
- `crawlers/config.py` - Configuration
