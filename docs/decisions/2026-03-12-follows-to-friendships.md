# ADR: Mutual Friendships as Social Primitive Over Follows

**Date:** 2026-03-12
**Status:** Accepted

## Context

The social layer needed a core relationship primitive. Follows (one-way, asymmetric like Twitter) vs friendships (mutual, symmetric like Facebook) serve different purposes. LostCity's mission is getting people out together — coordination requires mutual trust, not broadcast audiences.

## Decision

Mutual friendships are the social primitive. `get_friend_ids()` RPC gates all social features (hangs, activity feed, plans). The `follows` table is retained only for venue/org follows, not person-to-person relationships.

## Consequences

- Hangs, friend activity, plans, and social proof all require mutual friendship.
- No follower counts, no public follow lists, no asymmetric social dynamics.
- Higher friction to connect (must accept request) but higher signal when connected.
- Block propagation: `enforce_block_unfriend` trigger cascades blocks to unfriend + unfollow.

## Supersedes

None
