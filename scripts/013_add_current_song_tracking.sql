-- Add current_song_player_id to games table to track which song all players should see
ALTER TABLE games ADD COLUMN IF NOT EXISTS current_song_player_id UUID REFERENCES game_players(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_games_current_song_player_id ON games(current_song_player_id);
