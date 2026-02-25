#!/usr/bin/env python3
"""
Shared destination import flow helpers.

All curated destination import scripts should run enrichment after import so
new rows do not remain as low-data stubs.
"""

from __future__ import annotations

import argparse
import logging
from typing import Dict, Iterable, Optional


def add_enrichment_args(parser: argparse.ArgumentParser) -> None:
    """Add standard enrichment flags for destination import scripts."""
    parser.add_argument(
        "--skip-enrich",
        action="store_true",
        help="Import only; skip post-import enrichment pass.",
    )
    parser.add_argument(
        "--enrich-dry-run",
        action="store_true",
        help="Run enrichment in dry-run mode after import.",
    )


def _log(logger: Optional[logging.Logger], message: str) -> None:
    if logger:
        logger.info(message)
    else:
        print(message)


def run_post_import_enrichment(
    *,
    slugs: Iterable[str],
    skip_enrich: bool,
    enrich_dry_run: bool,
    logger: Optional[logging.Logger] = None,
) -> Optional[Dict[str, int]]:
    """Run targeted destination enrichment for the imported slug list."""
    unique_slugs = list(dict.fromkeys(slugs))
    if not unique_slugs:
        _log(logger, "No destination slugs to enrich.")
        return None

    if skip_enrich:
        _log(logger, "Skipping enrichment (--skip-enrich set).")
        return None

    try:
        from enrich_destination_slugs import enrich_slugs
    except Exception as exc:
        _log(logger, f"Unable to load enrichment module: {exc}")
        return None

    _log(logger, "")
    _log(logger, "=" * 68)
    _log(logger, "Running Post-Import Enrichment")
    _log(logger, "=" * 68)

    try:
        stats = enrich_slugs(slugs=unique_slugs, dry_run=enrich_dry_run)
    except Exception as exc:
        _log(logger, f"Enrichment failed: {exc}")
        return None

    _log(
        logger,
        "Enrichment summary: found=%d updated=%d missing=%d"
        % (stats.get("found", 0), stats.get("updated", 0), stats.get("missing", 0)),
    )
    return stats
