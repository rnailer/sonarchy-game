-- Add column to track which players have been the category picker
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS has_been_category_picker BOOLEAN DEFAULT FALSE;

-- Set all existing players to false (for existing games)
UPDATE game_players SET has_been_category_picker = FALSE WHERE has_been_category_picker IS NULL;
