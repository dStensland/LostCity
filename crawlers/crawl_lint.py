#!/usr/bin/env python3
"""
crawl_lint.py — Static analysis linter for LostCity crawler source files.

Checks PLACE_DATA completeness and enrichment presence without importing
any crawler module. Uses ast.parse() so it runs in any environment.

Usage:
    python3 crawl_lint.py sources/terminal_west.py     # lint one file
    python3 crawl_lint.py sources/                      # lint all crawler files
    python3 crawl_lint.py --errors-only sources/        # only missing required fields
    python3 crawl_lint.py --summary sources/            # just counts

Exit codes:
    0  no errors (warnings/info are OK)
    1  at least one error found
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path
from typing import NamedTuple

# ---------------------------------------------------------------------------
# Field requirements
# ---------------------------------------------------------------------------

REQUIRED_FIELDS: tuple[str, ...] = (
    "name",
    "slug",
    "address",
    "city",
    "state",
    "lat",
    "lng",
    "venue_type",
    "website",
)

RECOMMENDED_FIELDS: tuple[str, ...] = (
    "neighborhood",
    "vibes",
    "zip",
    "spot_type",
)

# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------


class LintMessage(NamedTuple):
    level: str  # ERROR | WARNING | INFO
    text: str


class FileResult(NamedTuple):
    path: Path
    messages: list[LintMessage]
    skipped: bool
    skip_reason: str


# ---------------------------------------------------------------------------
# AST helpers
# ---------------------------------------------------------------------------


def _extract_dict_keys(node: ast.Dict) -> set[str]:
    """Return the set of string-literal keys from an ast.Dict node.

    Keys that are variable references (ast.Name, ast.Attribute, …) are
    silently ignored — the caller treats any non-string key as absent from
    the checked set, which is the conservative/correct behaviour for required
    field detection (we count the key as present regardless of value type,
    because the spec says to do so).

    Wait — the spec actually says "count the key as present regardless of
    value type."  So we must return ALL keys, whether their key node is a
    Constant or not.  For non-Constant key nodes we fall back to a best-effort
    string representation so the caller can at least see them, but we do NOT
    count them as "present" for required-field purposes because we can't know
    their runtime value.

    In practice almost every PLACE_DATA key is a string literal, so this edge
    case is rare.
    """
    keys: set[str] = set()
    for key_node in node.keys:
        if isinstance(key_node, ast.Constant) and isinstance(key_node.value, str):
            keys.add(key_node.value)
        # Non-constant key nodes (variables, subscripts, …) are skipped.
        # The spec says "count the key as present regardless of value type"
        # — this refers to the *value* side, not the *key* side.  Variable
        # keys are too rare to worry about.
    return keys


def _find_venue_data_assignments(tree: ast.Module) -> list[ast.Dict]:
    """Return all ast.Dict nodes assigned to a name matching PLACE_DATA."""
    dicts: list[ast.Dict] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign):
            continue
        for target in node.targets:
            if isinstance(target, ast.Name) and target.id == "PLACE_DATA":
                if isinstance(node.value, ast.Dict):
                    dicts.append(node.value)
                # If the value is something else (e.g. a function call or
                # another variable reference) we skip it — it is not a
                # literal dict we can inspect.
    return dicts


def _has_build_destination_envelope(tree: ast.Module) -> bool:
    """Return True if the module defines a function named _build_destination_envelope."""
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == "_build_destination_envelope":
            return True
    return False


def _venue_data_has_destination_details(dicts: list[ast.Dict]) -> bool:
    """Return True if any PLACE_DATA dict has a '_destination_details' key."""
    for d in dicts:
        if "_destination_details" in _extract_dict_keys(d):
            return True
    return False


# ---------------------------------------------------------------------------
# Core lint logic
# ---------------------------------------------------------------------------


def lint_file(path: Path) -> FileResult:
    """Lint a single crawler file.  Returns a FileResult."""

    # Skip base-class / utility modules (names start with '_')
    if path.name.startswith("_"):
        return FileResult(path=path, messages=[], skipped=True, skip_reason="base module")

    source = path.read_text(encoding="utf-8", errors="replace")

    try:
        tree = ast.parse(source, filename=str(path))
    except SyntaxError as exc:
        msg = LintMessage("ERROR", f"SyntaxError: {exc}")
        return FileResult(path=path, messages=[msg], skipped=False, skip_reason="")

    venue_dicts = _find_venue_data_assignments(tree)

    # Skip aggregator crawlers that have no PLACE_DATA at all
    if not venue_dicts:
        return FileResult(
            path=path,
            messages=[],
            skipped=True,
            skip_reason="no PLACE_DATA (aggregator or base crawler)",
        )

    messages: list[LintMessage] = []

    # Collect all keys present across *all* PLACE_DATA assignments in the file.
    # Some crawlers define multiple PLACE_DATA blocks (multi-venue files) — we
    # report per-block so the author knows which blocks are incomplete.
    if len(venue_dicts) == 1:
        _check_single_block(venue_dicts[0], messages, label=None)
    else:
        for idx, d in enumerate(venue_dicts):
            _check_single_block(d, messages, label=f"block {idx + 1}")

    # Enrichment check: _build_destination_envelope function OR
    # _destination_details key in any PLACE_DATA dict
    has_enrichment = _has_build_destination_envelope(
        tree
    ) or _venue_data_has_destination_details(venue_dicts)

    if not has_enrichment:
        messages.append(
            LintMessage(
                "INFO",
                "No venue enrichment (_destination_details key or _build_destination_envelope function)",
            )
        )

    return FileResult(path=path, messages=messages, skipped=False, skip_reason="")


def _check_single_block(
    d: ast.Dict, messages: list[LintMessage], label: str | None
) -> None:
    """Append lint messages for one PLACE_DATA dict node."""
    present = _extract_dict_keys(d)
    prefix = f"PLACE_DATA {label} " if label else "PLACE_DATA "

    missing_required = [f for f in REQUIRED_FIELDS if f not in present]
    if missing_required:
        messages.append(
            LintMessage(
                "ERROR",
                f"{prefix}missing required fields: {', '.join(missing_required)}",
            )
        )

    missing_recommended = [f for f in RECOMMENDED_FIELDS if f not in present]
    if missing_recommended:
        messages.append(
            LintMessage(
                "WARNING",
                f"{prefix}missing recommended fields: {', '.join(missing_recommended)}",
            )
        )


# ---------------------------------------------------------------------------
# File discovery
# ---------------------------------------------------------------------------


def _collect_paths(target: str) -> list[Path]:
    """Expand a file or directory argument into a sorted list of .py paths."""
    p = Path(target)
    if p.is_file():
        return [p]
    if p.is_dir():
        return sorted(p.glob("*.py"))
    # Glob pattern passed directly
    parent = p.parent
    return sorted(parent.glob(p.name)) if parent.is_dir() else []


# ---------------------------------------------------------------------------
# Output formatting
# ---------------------------------------------------------------------------

LEVEL_COLOR = {
    "ERROR": "\033[31m",    # red
    "WARNING": "\033[33m",  # yellow
    "INFO": "\033[36m",     # cyan
}
RESET = "\033[0m"


def _colorize(level: str, text: str, use_color: bool) -> str:
    if not use_color:
        return text
    color = LEVEL_COLOR.get(level, "")
    return f"{color}{text}{RESET}"


def _is_tty() -> bool:
    return sys.stdout.isatty()


def print_results(
    results: list[FileResult],
    *,
    errors_only: bool,
    summary_only: bool,
    verbose_skips: bool = False,
) -> int:
    """Print results and return exit code (0=clean, 1=errors)."""
    use_color = _is_tty()
    total_errors = 0
    total_warnings = 0
    total_infos = 0
    files_checked = 0
    files_with_errors = 0

    lines: list[str] = []

    for result in results:
        if result.skipped:
            if verbose_skips:
                lines.append(f"{result.path}: skipped ({result.skip_reason})")
            continue

        files_checked += 1

        file_errors = [m for m in result.messages if m.level == "ERROR"]
        file_warnings = [m for m in result.messages if m.level == "WARNING"]
        file_infos = [m for m in result.messages if m.level == "INFO"]

        total_errors += len(file_errors)
        total_warnings += len(file_warnings)
        total_infos += len(file_infos)

        if file_errors:
            files_with_errors += 1

        if summary_only:
            continue

        # Determine which messages to show
        if errors_only:
            to_show = file_errors
        else:
            to_show = result.messages

        if not to_show:
            lines.append(f"{result.path}:")
            lines.append(f"  {_colorize('INFO', 'OK', use_color)}")
        else:
            lines.append(f"{result.path}:")
            for msg in to_show:
                label = _colorize(msg.level, msg.level, use_color)
                lines.append(f"  {label}: {msg.text}")

    if not summary_only:
        print("\n".join(lines))
        if lines:
            print()

    # Summary line
    if total_errors:
        err_str = _colorize("ERROR", f"{total_errors} errors", use_color)
    else:
        err_str = "0 errors"

    warn_str = f"{total_warnings} warnings"
    info_str = f"{total_infos} info"

    print(
        f"Summary: {files_checked} files checked, "
        f"{err_str}, {warn_str}, {info_str}"
    )

    return 1 if total_errors > 0 else 0


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    if argv is None:
        argv = sys.argv[1:]

    errors_only = False
    summary_only = False
    targets: list[str] = []

    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg == "--errors-only":
            errors_only = True
        elif arg == "--summary":
            summary_only = True
        elif arg.startswith("-"):
            print(f"Unknown option: {arg}", file=sys.stderr)
            _print_usage()
            return 2
        else:
            targets.append(arg)
        i += 1

    if not targets:
        _print_usage()
        return 2

    paths: list[Path] = []
    for target in targets:
        found = _collect_paths(target)
        if not found:
            print(f"crawl_lint: no files found for: {target}", file=sys.stderr)
        paths.extend(found)

    if not paths:
        print("crawl_lint: no files to lint.", file=sys.stderr)
        return 2

    results = [lint_file(p) for p in paths]

    return print_results(
        results,
        errors_only=errors_only,
        summary_only=summary_only,
    )


def _print_usage() -> None:
    print(
        "Usage: crawl_lint.py [--errors-only] [--summary] <file_or_dir> [...]\n"
        "\n"
        "  python3 crawl_lint.py sources/terminal_west.py\n"
        "  python3 crawl_lint.py sources/\n"
        "  python3 crawl_lint.py --errors-only sources/\n"
        "  python3 crawl_lint.py --summary sources/\n",
        file=sys.stderr,
    )


if __name__ == "__main__":
    sys.exit(main())
