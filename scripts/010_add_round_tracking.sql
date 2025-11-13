-- Add round and turn tracking to game_players table
ALTER TABLE game_players
ADD COLUMN IF NOT EXISTS has_picked_category BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS song_played BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS song_play_order INTEGER DEFAULT NULL;

-- Add round tracking to games table
ALTER TABLE games
ADD COLUMN IF NOT EXISTS current_round INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS total_rounds INTEGER DEFAULT NULL;

-- Update total_rounds based on player count
UPDATE games
SET total_rounds = (
  SELECT COUNT(*) 
  FROM game_players 
  WHERE game_id = games.id
)
WHERE total_rounds IS NULL;
