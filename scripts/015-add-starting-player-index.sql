-- Add starting_player_index column to randomize first turn
ALTER TABLE games ADD COLUMN IF NOT EXISTS starting_player_index INTEGER DEFAULT 0;

-- Add comment explaining the column
COMMENT ON COLUMN games.starting_player_index IS 'Random offset for determining first category selector (0 to player_count-1)';
