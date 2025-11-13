"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export default function MigratePage() {
  const [copied, setCopied] = useState(false)

  const sqlScript = `-- Run this SQL in your Supabase SQL Editor
-- This will create all necessary tables for the game system

-- Create games table
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_code VARCHAR(6) UNIQUE NOT NULL,
  host_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'waiting',
  max_players INTEGER DEFAULT 10,
  playback_device VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create game_players table
CREATE TABLE IF NOT EXISTS game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  player_name VARCHAR(100) NOT NULL,
  avatar_id VARCHAR(50) NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_host BOOLEAN DEFAULT FALSE,
  UNIQUE(game_id, user_id)
);

-- Create game_chat table
CREATE TABLE IF NOT EXISTS game_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  player_name VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_games_code ON games(game_code);
CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_game_chat_game_id ON game_chat(game_id);

-- Enable RLS
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_chat ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view games" ON games FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create games" ON games FOR INSERT WITH CHECK (auth.uid() = host_user_id);
CREATE POLICY "Host can update their games" ON games FOR UPDATE USING (auth.uid() = host_user_id);

CREATE POLICY "Anyone can view game players" ON game_players FOR SELECT USING (true);
CREATE POLICY "Authenticated users can join games" ON game_players FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view game chat" ON game_chat FOR SELECT USING (true);
CREATE POLICY "Authenticated users can send messages" ON game_chat FOR INSERT WITH CHECK (auth.uid() = user_id);`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlScript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#000033] flex items-center justify-center p-4">
      <Card className="max-w-4xl w-full p-8 bg-gradient-to-b from-[#0D113B] to-[#5E6590] border-2 border-[#6CD9FF] rounded-3xl">
        <h1 className="text-3xl font-bold text-white mb-4">Database Setup</h1>
        <p className="text-gray-300 mb-6">To set up the game tables in your Supabase database, follow these steps:</p>

        <ol className="text-gray-300 mb-6 space-y-2 list-decimal list-inside">
          <li>Copy the SQL script below</li>
          <li>Go to your Supabase project dashboard</li>
          <li>Navigate to the SQL Editor</li>
          <li>Paste and run the script</li>
        </ol>

        <div className="relative">
          <pre className="p-4 bg-black/50 rounded-lg text-white text-sm overflow-x-auto max-h-96 overflow-y-auto">
            {sqlScript}
          </pre>
          <Button
            onClick={copyToClipboard}
            className="absolute top-4 right-4 bg-[#FFD03B] hover:bg-[#FFD03B]/90 text-[#000033] font-semibold"
          >
            {copied ? "✓ Copied!" : "Copy SQL"}
          </Button>
        </div>

        <div className="mt-6 p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg">
          <p className="text-blue-200 text-sm">
            <strong>Note:</strong> The SQL script uses "CREATE TABLE IF NOT EXISTS" so it's safe to run multiple times.
            It will only create tables that don't already exist.
          </p>
        </div>
      </Card>
    </div>
  )
}
