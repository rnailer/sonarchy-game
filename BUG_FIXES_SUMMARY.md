# Bug Fixes Summary - Sonarchy Multiplayer Game

## Overview
Fixed two critical bugs affecting multiplayer synchronization in the Sonarchy music game.

---

## BUG 1: Round Transition Failure ✅ FIXED

### Problem
After Round 2 leaderboard voting completed (TIME UP), both players got stuck on the leaderboard page instead of transitioning to Round 3 or final results.

### Root Causes Identified

1. **Indefinite waiting for rankings**: The navigation logic waited indefinitely for all players to rank the current song. If a player didn't rank within the 15-second timer, navigation would never occur.

2. **Missing playerId in navigation**: When the playback page detected all songs were played, it navigated to the leaderboard WITHOUT including the `playerId` parameter, causing the navigation logic to never execute.

### Fixes Applied

#### Fix 1: Added Force Navigation After Timeout
**File**: `app/leaderboard/page.tsx`

```typescript
// Track how long we've been showing TIME UP
const [timeUpDuration, setTimeUpDuration] = useState(0)

// After 10 seconds of TIME UP, force navigation anyway
const forceNavigation = timeUpDuration >= 10

if (!allPlayersReady && !forceNavigation) {
  console.log("[v0] ⏳ Waiting for more players to rank...")
  return
}
```

**Impact**: Players no longer get stuck waiting forever. After 10 seconds of TIME UP, the game proceeds to the next step even if not all players have ranked.

#### Fix 2: Include Last Song's playerId in Round Complete Navigation
**File**: `app/playtime-playback/page.tsx` (line 222)

```typescript
// OLD:
router.push(
  `/leaderboard?category=${...}&code=${gameCode}&roundComplete=true&t=${...}`
)

// NEW:
const lastSongPlayerId = game.current_song_player_id || ""
router.push(
  `/leaderboard?category=${...}&code=${gameCode}&playerId=${lastSongPlayerId}&roundComplete=true&t=${...}`
)
```

**Impact**: The leaderboard page now receives the playerId parameter, allowing the navigation logic to execute properly.

---

## BUG 2: Timer Desync ✅ FIXED

### Problem
Each device ran its own local timer (useState + setTimeout). When players backgrounded the app, their timers would pause/freeze, causing:
- Different players seeing different remaining times
- Race conditions in game state transitions
- Poor multiplayer synchronization

### Solution: Server-Synchronized Timers

All clients now calculate time remaining based on server timestamps stored in Supabase, rather than using local timers.

### Implementation

#### Created Server Timer Infrastructure

**Files Created**:
1. `lib/hooks/use-server-timer.ts` - React hook for easy integration
2. `lib/server-timer.ts` - Core timer utilities
3. `SCHEMA_CHANGES.md` - Database schema documentation
4. `TIMER_MIGRATION_GUIDE.md` - Migration guide for remaining pages

#### How It Works

```typescript
// Instead of local timer:
const [timeRemaining, setTimeRemaining] = useState(30)

// Use server-synchronized timer:
const { timeRemaining, isExpired, startTimer } = useServerTimer({
  gameId: gameId,
  timerType: "song",
  enabled: !!gameId,
})

// Start timer (stores server timestamp in Supabase)
await startTimer(30)

// All clients calculate: remaining = (start_time + duration) - current_time
```

#### Pages Already Migrated

✅ **app/leaderboard/page.tsx** - 15 second timer for song ranking
✅ **app/playtime-playback/page.tsx** - 30 second timer for song playback

#### Remaining Pages to Migrate

These pages still use local timers and need migration:

1. `app/playtime-name-vote/page.tsx` - 10 seconds
2. `app/select-category/page.tsx` - 60 seconds
3. `app/playtime-waiting/page.tsx` - 60 seconds
4. `app/pick-your-song/page.tsx` - 60 seconds
5. `app/waiting-for-songs/page.tsx` - 60 seconds
6. `app/players-locked-in/page.tsx` - Dynamic
7. `app/waiting/page.tsx` - 60 seconds

**See `TIMER_MIGRATION_GUIDE.md` for step-by-step instructions.**

---

## Required Database Changes

You must apply these schema changes to your Supabase `games` table:

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

**See `SCHEMA_CHANGES.md` for detailed information.**

---

## Testing Instructions

### Test BUG 1 Fix

1. Start a 2-player game
2. Complete Round 1 (all songs played and ranked)
3. Complete Round 2 (all songs played and ranked)
4. **After Round 2 leaderboard TIME UP**: Both players should navigate to final-results
5. If a player doesn't rank within 15 seconds, the game should proceed after 10 seconds of TIME UP

### Test BUG 2 Fix (After Schema Changes)

1. Start a game and navigate to playback or leaderboard page
2. Timer should start counting down from 30s (playback) or 15s (leaderboard)
3. **Background the app** on one device (go to home screen)
4. Wait 5 seconds
5. Return to the app
6. **Verify**: Timer should match other players' timers (not frozen or ahead)

---

## Files Modified

### BUG 1 Fixes
- `app/leaderboard/page.tsx` - Added forced navigation after 10s timeout
- `app/playtime-playback/page.tsx` - Fixed navigation to include playerId

### BUG 2 Fixes
- `app/leaderboard/page.tsx` - Migrated to server timer
- `app/playtime-playback/page.tsx` - Migrated to server timer

### New Files Created
- `lib/hooks/use-server-timer.ts` - React hook for server timers
- `lib/server-timer.ts` - Core timer utilities
- `SCHEMA_CHANGES.md` - Database migration documentation
- `TIMER_MIGRATION_GUIDE.md` - Step-by-step migration guide
- `BUG_FIXES_SUMMARY.md` - This file

---

## Next Steps

1. **Apply Supabase schema changes** (required for timer fixes to work)
2. **Test BUG 1 fix** in 2-player game through Round 2
3. **Test BUG 2 fix** by backgrounding app during timers
4. **Migrate remaining pages** using `TIMER_MIGRATION_GUIDE.md`
5. **Deploy and monitor** for any issues

---

## Notes

- BUG 1 fixes are backward compatible and work immediately
- BUG 2 fixes require database schema changes to function
- The two critical pages (leaderboard and playback) are fully migrated for BUG 2
- Other pages can be migrated incrementally without breaking existing functionality
- All changes maintain existing game logic and UI behavior

---

**Questions or Issues?**
- Check console logs for `[ServerTimer]` and `[v0]` debug messages
- Review `TIMER_MIGRATION_GUIDE.md` for common issues
- Verify Supabase realtime is enabled for the `games` table
