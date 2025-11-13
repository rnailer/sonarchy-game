-- Add name_vote column to game_players table for voting on showing player names
ALTER TABLE game_players
ADD COLUMN IF NOT EXISTS name_vote VARCHAR(10);

-- Add comment to explain the column
COMMENT ON COLUMN game_players.name_vote IS 'Player vote for showing names: hide or show';
