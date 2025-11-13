-- Track which players have been category selectors
ALTER TABLE game_players
ADD COLUMN IF NOT EXISTS has_selected_category BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS category_selector_order INTEGER DEFAULT NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_game_players_category_selector 
  ON game_players(game_id, has_selected_category);
