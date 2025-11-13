-- Add current_category_picker column to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS current_category_picker UUID REFERENCES game_players(id);

-- Add comment
COMMENT ON COLUMN games.current_category_picker IS 'The player who is currently selecting the category for this round';
