#!/usr/bin/env python3
"""
Enrichment proposals — submit and review proposed venue field changes.

Agents and crawlers propose changes; humans approve/reject via CLI or web UI.

Usage:
    # Submit a proposal
    python enrichment_proposals.py --propose --venue-id 42 --field description \
        --value "A historic jazz club..." --confidence 0.9

    # List pending proposals
    python enrichment_proposals.py --review

    # Approve a batch
    python enrichment_proposals.py --approve --batch-id enrichment-2026-02-15

    # Reject a single proposal
    python enrichment_proposals.py --reject --id 42
"""

import os
import sys
import json
import uuid
import argparse
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

sys.path.insert(0, str(Path(__file__).parent))
from db import get_client
from compute_data_quality import VENUE_WEIGHTS, score_record, update_scores

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

ALLOWED_FIELDS = {
    "description", "short_description", "explore_blurb", "venue_type",
    "vibes", "neighborhood", "image_url", "hero_image_url", "website",
    "hours", "phone", "parking_type", "transit_options",
}


def propose(
    venue_id: int,
    field_name: str,
    proposed_value: Any,
    *,
    source: str = "agent",
    agent_id: Optional[str] = None,
    confidence: float = 0.8,
    reasoning: str = "",
    batch_id: Optional[str] = None,
) -> int:
    """
    Submit a single enrichment proposal.
    Supersedes any existing pending proposal for the same venue+field.
    Returns the new proposal ID.
    """
    if field_name not in ALLOWED_FIELDS:
        raise ValueError(f"Field '{field_name}' not in allowed list: {sorted(ALLOWED_FIELDS)}")

    client = get_client()

    # Fetch current value for context
    resp = client.table("venues").select(field_name).eq("id", venue_id).single().execute()
    current_value = None
    if resp.data:
        raw = resp.data.get(field_name)
        current_value = json.dumps(raw) if not isinstance(raw, str) and raw is not None else raw

    # Supersede existing pending proposals for this venue+field
    client.table("venue_enrichment_proposals").update(
        {"status": "superseded"}
    ).eq("venue_id", venue_id).eq("field_name", field_name).eq("status", "pending").execute()

    # Serialize proposed value
    serialized = json.dumps(proposed_value) if not isinstance(proposed_value, str) else proposed_value

    row = {
        "venue_id": venue_id,
        "field_name": field_name,
        "current_value": current_value,
        "proposed_value": serialized,
        "source": source,
        "agent_id": agent_id,
        "confidence": confidence,
        "reasoning": reasoning,
        "batch_id": batch_id,
    }
    result = client.table("venue_enrichment_proposals").insert(row).execute()
    proposal_id = result.data[0]["id"]
    logger.info(f"Proposal {proposal_id} created: venue {venue_id}.{field_name}")
    return proposal_id


def propose_batch(
    proposals: List[Dict[str, Any]],
    *,
    batch_id: Optional[str] = None,
) -> Dict[str, int]:
    """
    Submit multiple proposals at once.

    Each item: {venue_id, field_name, proposed_value, source?, confidence?, reasoning?}
    Returns: {created, superseded}
    """
    if not batch_id:
        batch_id = f"batch-{uuid.uuid4().hex[:12]}"

    stats = {"created": 0, "superseded": 0}

    for p in proposals:
        try:
            propose(
                venue_id=p["venue_id"],
                field_name=p["field_name"],
                proposed_value=p["proposed_value"],
                source=p.get("source", "agent"),
                agent_id=p.get("agent_id"),
                confidence=p.get("confidence", 0.8),
                reasoning=p.get("reasoning", ""),
                batch_id=batch_id,
            )
            stats["created"] += 1
        except Exception as e:
            logger.error(f"Failed to create proposal for venue {p.get('venue_id')}: {e}")

    logger.info(f"Batch {batch_id}: {stats}")
    return stats


def list_pending(*, batch_id: Optional[str] = None, limit: int = 50) -> List[dict]:
    """List pending proposals with venue names."""
    client = get_client()

    q = (
        client.table("venue_enrichment_proposals")
        .select("id, venue_id, field_name, current_value, proposed_value, source, confidence, reasoning, batch_id, created_at, venues(name)")
        .eq("status", "pending")
        .order("created_at", desc=True)
        .limit(limit)
    )
    if batch_id:
        q = q.eq("batch_id", batch_id)

    resp = q.execute()
    return resp.data or []


def approve_proposal(proposal_id: int, *, reviewed_by: str = "cli") -> bool:
    """Approve a proposal: apply change to venue, log it, recompute quality."""
    client = get_client()

    # Fetch proposal
    resp = client.table("venue_enrichment_proposals").select("*").eq("id", proposal_id).single().execute()
    if not resp.data:
        logger.error(f"Proposal {proposal_id} not found")
        return False

    p = resp.data
    if p["status"] != "pending":
        logger.warning(f"Proposal {proposal_id} is already {p['status']}")
        return False

    venue_id = p["venue_id"]
    field_name = p["field_name"]

    # Try to deserialize the proposed value
    proposed = p["proposed_value"]
    try:
        proposed = json.loads(proposed)
    except (json.JSONDecodeError, TypeError):
        pass  # keep as string

    # Snapshot current value
    venue_resp = client.table("venues").select(field_name).eq("id", venue_id).single().execute()
    previous = venue_resp.data.get(field_name) if venue_resp.data else None

    # Apply update
    client.table("venues").update({field_name: proposed}).eq("id", venue_id).execute()

    # Log in enrichment_log
    client.table("venue_enrichment_log").insert({
        "venue_id": venue_id,
        "enrichment_type": f"proposal:{field_name}",
        "status": "success",
        "source": p.get("source", "agent"),
        "fields_updated": [field_name],
        "previous_values": json.dumps({field_name: previous}),
        "ran_by": f"proposal:{reviewed_by}",
    }).execute()

    # Mark proposal approved
    client.table("venue_enrichment_proposals").update({
        "status": "approved",
        "reviewed_by": reviewed_by,
        "reviewed_at": "now()",
    }).eq("id", proposal_id).execute()

    # Recompute data_quality
    fields = ",".join(["id"] + list(VENUE_WEIGHTS.keys()))
    v_resp = client.table("venues").select(fields).eq("id", venue_id).single().execute()
    if v_resp.data:
        score = score_record(v_resp.data, VENUE_WEIGHTS)
        update_scores(client, "venues", {venue_id: score})

    logger.info(f"Proposal {proposal_id} approved: venue {venue_id}.{field_name}")
    return True


def reject_proposal(proposal_id: int, *, reviewed_by: str = "cli") -> bool:
    """Reject a proposal."""
    client = get_client()

    resp = client.table("venue_enrichment_proposals").select("status").eq("id", proposal_id).single().execute()
    if not resp.data:
        logger.error(f"Proposal {proposal_id} not found")
        return False
    if resp.data["status"] != "pending":
        logger.warning(f"Proposal {proposal_id} is already {resp.data['status']}")
        return False

    client.table("venue_enrichment_proposals").update({
        "status": "rejected",
        "reviewed_by": reviewed_by,
        "reviewed_at": "now()",
    }).eq("id", proposal_id).execute()

    logger.info(f"Proposal {proposal_id} rejected")
    return True


def approve_batch(batch_id: str, *, reviewed_by: str = "cli") -> Dict[str, int]:
    """Approve all pending proposals in a batch."""
    pending = list_pending(batch_id=batch_id, limit=500)
    stats = {"approved": 0, "failed": 0}
    for p in pending:
        if approve_proposal(p["id"], reviewed_by=reviewed_by):
            stats["approved"] += 1
        else:
            stats["failed"] += 1
    logger.info(f"Batch {batch_id} review: {stats}")
    return stats


def main():
    parser = argparse.ArgumentParser(description="Venue enrichment proposals")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--propose", action="store_true", help="Submit a proposal")
    group.add_argument("--review", action="store_true", help="List pending proposals")
    group.add_argument("--approve", action="store_true", help="Approve proposals")
    group.add_argument("--reject", action="store_true", help="Reject a proposal")

    parser.add_argument("--venue-id", type=int, help="Venue ID (for --propose)")
    parser.add_argument("--field", help="Field name (for --propose)")
    parser.add_argument("--value", help="Proposed value (for --propose)")
    parser.add_argument("--confidence", type=float, default=0.8, help="Confidence 0-1 (for --propose)")
    parser.add_argument("--reasoning", default="", help="Reasoning (for --propose)")
    parser.add_argument("--id", type=int, help="Proposal ID (for --approve/--reject single)")
    parser.add_argument("--batch-id", help="Batch ID (for --approve batch or --review filter)")
    parser.add_argument("--limit", type=int, default=50, help="Max results (for --review)")
    args = parser.parse_args()

    if args.propose:
        if not args.venue_id or not args.field or not args.value:
            parser.error("--propose requires --venue-id, --field, and --value")
        propose(
            args.venue_id, args.field, args.value,
            confidence=args.confidence, reasoning=args.reasoning,
        )

    elif args.review:
        pending = list_pending(batch_id=args.batch_id, limit=args.limit)
        if not pending:
            print("No pending proposals.")
            return
        print(f"\n{'ID':>6}  {'Venue':>6}  {'Field':<20}  {'Conf':>5}  {'Source':<10}  Venue Name")
        print("-" * 80)
        for p in pending:
            venue_name = p.get("venues", {}).get("name", "?") if isinstance(p.get("venues"), dict) else "?"
            print(
                f"{p['id']:>6}  {p['venue_id']:>6}  {p['field_name']:<20}  "
                f"{p.get('confidence', 0):>5.2f}  {p.get('source', '?'):<10}  {venue_name}"
            )
        print(f"\n{len(pending)} pending proposals")

    elif args.approve:
        if args.batch_id:
            approve_batch(args.batch_id)
        elif args.id:
            approve_proposal(args.id)
        else:
            parser.error("--approve requires --id or --batch-id")

    elif args.reject:
        if not args.id:
            parser.error("--reject requires --id")
        reject_proposal(args.id)


if __name__ == "__main__":
    main()
