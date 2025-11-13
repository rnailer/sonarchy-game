-- Create table for individual player leaderboard placements
CREATE TABLE IF NOT EXISTS leaderboard_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  player_id UUID NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  song_player_id UUID NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  placement_position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Each player can only place each song once per round
  UNIQUE(game_id, round_number, player_id, song_player_id)
);

-- Enable RLS
ALTER TABLE leaderboard_placements ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read placements
CREATE POLICY "Anyone can view leaderboard placements"
  ON leaderboard_placements FOR SELECT
  USING (true);

-- Allow players to insert their own placements
CREATE POLICY "Players can create their own placements"
  ON leaderboard_placements FOR INSERT
  WITH CHECK (true);

-- Allow players to update their own placements
CREATE POLICY "Players can update their own placements"
  ON leaderboard_placements FOR UPDATE
  USING (true);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_placements_game_round 
  ON leaderboard_placements(game_id, round_number);
  
CREATE INDEX IF NOT EXISTS idx_leaderboard_placements_player 
  ON leaderboard_placements(player_id);
