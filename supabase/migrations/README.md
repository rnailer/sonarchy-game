# Database Migrations

This directory contains SQL migration files that need to be applied to the Supabase database.

## How to Apply Migrations

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Open each migration file in order (001, 002, etc.)
4. Copy the SQL content and run it in the SQL Editor
5. Verify the migrations were successful

## Migration Files

### 001_add_category_picker_tracking.sql
Adds the `has_been_category_picker` column to the `game_players` table to track which players have been the category picker in the current game.

### 002_add_next_category_picker_id.sql
Adds the `next_category_picker_id` column to the `games` table to store which player will select the category for the next round.

### 003_add_final_placements_timer.sql
Adds the `final_placements_start_time` and `final_placements_duration` columns to the `games` table for server-synchronized timer on the final placements page.

## Required for Features

These migrations are **required** for the following features:
- **001 & 002**: Round rotation system to work properly. Without them, you'll see 400 errors when the game tries to reset between rounds.
- **003**: Server-synchronized timer on final placements page. Without it, players may experience desynced timers between rounds.
