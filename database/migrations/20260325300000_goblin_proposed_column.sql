-- Add proposed column for "Next Goblin Day" picks
ALTER TABLE goblin_movies ADD COLUMN proposed boolean NOT NULL DEFAULT false;
