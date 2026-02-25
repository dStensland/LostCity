-- Migration 246: Add feed_layout column to user_preferences
-- Stores per-user feed block ordering and visibility.
-- Format: { visible_blocks: string[], hidden_blocks: string[], version: 1 }
-- NULL = show all blocks in default order.

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS feed_layout JSONB DEFAULT NULL;

COMMENT ON COLUMN user_preferences.feed_layout IS
  'User feed layout: { visible_blocks, hidden_blocks, version }. NULL = default order.';
