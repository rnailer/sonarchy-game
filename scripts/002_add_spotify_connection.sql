-- Add Spotify connection info to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS spotify_access_token TEXT,
ADD COLUMN IF NOT EXISTS spotify_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS spotify_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS spotify_connected_at TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_spotify_connected 
ON user_profiles(spotify_connected_at) 
WHERE spotify_connected_at IS NOT NULL;
