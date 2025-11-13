-- Create player_votes table for skip/extend voting
CREATE TABLE IF NOT EXISTS player_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('skip', 'extend')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (game_id, player_id, round_number)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_player_votes_game_round 
  ON player_votes(game_id, round_number);

-- Enable RLS
ALTER TABLE player_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view player votes"
  ON player_votes FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Players can insert their own votes"
  ON player_votes FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE player_votes;
