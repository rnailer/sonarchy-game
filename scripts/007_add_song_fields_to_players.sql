-- Add song-related fields to game_players table for tracking song selections

-- Add song fields to game_players table
ALTER TABLE game_players
ADD COLUMN IF NOT EXISTS song_title TEXT,
ADD COLUMN IF NOT EXISTS song_artist TEXT,
ADD COLUMN IF NOT EXISTS song_uri TEXT,
ADD COLUMN IF NOT EXISTS song_preview_url TEXT,
ADD COLUMN IF NOT EXISTS album_cover_url TEXT,
ADD COLUMN IF NOT EXISTS song_duration_ms INTEGER;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_game_players_song_uri ON game_players(song_uri);
