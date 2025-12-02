# Supabase Schema Changes for Server-Synchronized Timers

## Problem
Local timers (useState + setTimeout) get out of sync when players background their apps, causing:
- Timers to pause/freeze
- Different players seeing different remaining times
- Race conditions in game state transitions

## Solution
Store timer start times in the `games` table and calculate remaining time on all clients based on server time.

## Required Schema Changes

Add the following columns to the `games` table in Supabase:

```sql
-- Song playback timer
ALTER TABLE games ADD COLUMN song_start_time TIMESTAMPTZ;
ALTER TABLE games ADD COLUMN song_duration INTEGER DEFAULT 30;

-- Leaderboard voting timer
ALTER TABLE games ADD COLUMN leaderboard_start_time TIMESTAMPTZ;
ALTER TABLE games ADD COLUMN leaderboard_duration INTEGER DEFAULT 15;

-- Category selection timer
ALTER TABLE games ADD COLUMN category_selection_start_time TIMESTAMPTZ;
ALTER TABLE games ADD COLUMN category_selection_duration INTEGER DEFAULT 60;

-- Waiting room timer
ALTER TABLE games ADD COLUMN waiting_start_time TIMESTAMPTZ;
ALTER TABLE games ADD COLUMN waiting_duration INTEGER DEFAULT 60;

-- Name vote timer
ALTER TABLE games ADD COLUMN name_vote_start_time TIMESTAMPTZ;
ALTER TABLE games ADD COLUMN name_vote_duration INTEGER DEFAULT 10;
```

## How It Works

1. **Starting a Timer**: When a page loads that needs a timer, the host (or first player) calls `startServerTimer()` which stores the current server timestamp in Supabase

2. **Calculating Remaining Time**: All clients calculate remaining time as:
   ```
   remaining = (start_time + duration) - current_time
   ```

3. **Staying in Sync**: Clients subscribe to Supabase realtime updates and recalculate every second using their local clock (which is more accurate than polling)

## Migration Path

For each page with a timer:

1. Import `startServerTimer` and `useServerTimer` from `@/lib/server-timer`
2. Replace `useState(duration)` with timer based on server time
3. Use `useServerTimer` hook to subscribe to updates
4. Remove local `setTimeout`/`setInterval` logic

## Example Usage

```typescript
import { startServerTimer, useServerTimer } from "@/lib/server-timer"

// In the component that should start the timer (usually host or first to load)
const startTimer = async () => {
  await startServerTimer({
    gameId: "uuid-here",
    duration: 30,
    timerType: "song"
  })
}

// In all components that need to display the timer
useEffect(() => {
  const cleanup = useServerTimer(gameId, "song", (remaining) => {
    setTimeRemaining(Math.max(0, remaining))
    if (remaining <= 0) {
      setShowTimeUp(true)
    }
  })

  return cleanup
}, [gameId])
```
