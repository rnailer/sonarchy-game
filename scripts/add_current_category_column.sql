-- Add current_category column to games table
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS current_category TEXT;

-- Add an index for better query performance
CREATE INDEX IF NOT EXISTS idx_games_current_category ON games(current_category);
