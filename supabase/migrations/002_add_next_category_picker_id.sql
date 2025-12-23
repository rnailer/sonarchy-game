-- Add column to store which player is next to pick a category
ALTER TABLE games ADD COLUMN IF NOT EXISTS next_category_picker_id UUID REFERENCES game_players(id);

-- Add comment explaining the column
COMMENT ON COLUMN games.next_category_picker_id IS 'ID of the player who will select the category for the next/current round';
