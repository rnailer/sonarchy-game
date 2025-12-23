-- Migration: Add game phase state machine support
-- Run this in Supabase SQL Editor

-- Add current_phase column with default value
ALTER TABLE games
ADD COLUMN IF NOT EXISTS current_phase text DEFAULT 'lobby';

-- Add constraint to ensure only valid phases
ALTER TABLE games
ADD CONSTRAINT valid_phase CHECK (
  current_phase IN (
    'lobby',
    'category_selection',
    'song_selection',
    'players_locked_in',
    'playback',
    'ranking',
    'final_placements',
    'game_complete'
  )
);

-- Set existing games to lobby phase if NULL
UPDATE games SET current_phase = 'lobby' WHERE current_phase IS NULL;

-- Verify migration
SELECT id, game_code, current_phase, status FROM games LIMIT 5;
