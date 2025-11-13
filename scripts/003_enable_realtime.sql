-- Enable Realtime for game_players table
ALTER PUBLICATION supabase_realtime ADD TABLE game_players;

-- Enable Realtime for games table (optional, for future use)
ALTER PUBLICATION supabase_realtime ADD TABLE games;

-- Enable Realtime for game_chat table (optional, for future use)
ALTER PUBLICATION supabase_realtime ADD TABLE game_chat;

-- Verify Realtime is enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
