-- Add spotify_user_id column to track which Spotify account is connected
-- This prevents multiple players from using the same Spotify account in a game

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS spotify_user_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_spotify_user_id 
ON user_profiles(spotify_user_id);

-- Add comment
COMMENT ON COLUMN user_profiles.spotify_user_id IS 'The Spotify user ID to detect duplicate accounts in games';
