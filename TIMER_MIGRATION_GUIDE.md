# Timer Migration Guide

## Overview
This guide explains how to migrate the remaining pages from local timers to server-synchronized timers.

## Completed Migrations
✅ `app/leaderboard/page.tsx` - Server timer implemented
✅ `app/playtime-playback/page.tsx` - Server timer implemented

## Pages Needing Migration

### High Priority (User-Facing During Gameplay)
1. `app/playtime-name-vote/page.tsx` - 10 second timer
2. `app/select-category/page.tsx` - 60 second timer
3. `app/playtime-waiting/page.tsx` - 60 second timer

### Medium Priority (Pre-Game)
4. `app/pick-your-song/page.tsx` - 60 second timer
5. `app/waiting-for-songs/page.tsx` - 60 second timer
6. `app/players-locked-in/page.tsx` - Dynamic timer
7. `app/waiting/page.tsx` - 60 second timer

## Migration Steps for Each Page

### Step 1: Import the Hook
```typescript
import { useServerTimer } from "@/lib/hooks/use-server-timer"
```

### Step 2: Add Game ID State (if not already present)
```typescript
const [gameId, setGameId] = useState<string | null>(null)
```

### Step 3: Replace Local Timer with Server Timer
Find and replace:
```typescript
// OLD:
const [timeRemaining, setTimeRemaining] = useState(60)

// NEW:
const { timeRemaining, isExpired, startTimer } = useServerTimer({
  gameId: gameId || "",
  timerType: "category_selection", // or appropriate type
  enabled: !!gameId,
})
const timerStartedRef = useRef(false)
```

### Step 4: Set Game ID When Fetched
In the useEffect that fetches game data:
```typescript
const { data: game } = await supabase
  .from("games")
  .select("id, ...")
  .eq("game_code", gameCode)
  .single()

if (game) {
  setGameId(game.id) // Add this line
  // ... rest of code
}
```

### Step 5: Start Timer When Page Loads
```typescript
// After game data is loaded and ready
if (!timerStartedRef.current) {
  timerStartedRef.current = true
  startTimer(60).catch(console.error) // or appropriate duration
}
```

### Step 6: Remove Old Timer Logic
Delete any useEffect that was manually counting down:
```typescript
// DELETE THIS:
useEffect(() => {
  if (timeRemaining > 0) {
    const timer = setTimeout(() => setTimeRemaining(timeRemaining - 1), 1000)
    return () => clearTimeout(timer)
  }
}, [timeRemaining])
```

### Step 7: Update Timer Expiry Logic
If the page has custom logic for when the timer expires:
```typescript
// OLD:
useEffect(() => {
  if (timeRemaining === 0) {
    handleTimeout()
  }
}, [timeRemaining])

// NEW:
useEffect(() => {
  if (isExpired) {
    handleTimeout()
  }
}, [isExpired])
```

## Timer Types Reference

Map each page to its appropriate timer type:

| Page | Timer Type | Default Duration |
|------|-----------|------------------|
| `playtime-playback` | `"song"` | 30 seconds |
| `leaderboard` | `"leaderboard"` | 15 seconds |
| `select-category` | `"category_selection"` | 60 seconds |
| `playtime-waiting` | `"waiting"` | 60 seconds |
| `playtime-name-vote` | `"name_vote"` | 10 seconds |
| `pick-your-song` | `"waiting"` | 60 seconds |
| `waiting-for-songs` | `"waiting"` | 60 seconds |
| `players-locked-in` | `"waiting"` | varies |
| `waiting` | `"waiting"` | 60 seconds |

## Example: Full Migration of `playtime-name-vote/page.tsx`

### Before:
```typescript
export default function PlaytimeNameVote() {
  const [timeRemaining, setTimeRemaining] = useState(10)

  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setTimeout(() => setTimeRemaining(timeRemaining - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [timeRemaining])

  // ... rest of component
}
```

### After:
```typescript
import { useServerTimer } from "@/lib/hooks/use-server-timer"

export default function PlaytimeNameVote() {
  const [gameId, setGameId] = useState<string | null>(null)
  const { timeRemaining, isExpired, startTimer } = useServerTimer({
    gameId: gameId || "",
    timerType: "name_vote",
    enabled: !!gameId,
  })
  const timerStartedRef = useRef(false)

  useEffect(() => {
    const fetchGameData = async () => {
      // ... fetch game ...
      const { data: game } = await supabase
        .from("games")
        .select("id")
        .eq("game_code", gameCode)
        .single()

      if (game) {
        setGameId(game.id)

        if (!timerStartedRef.current) {
          timerStartedRef.current = true
          startTimer(10).catch(console.error)
        }
      }
    }

    fetchGameData()
  }, [gameCode])

  // ... rest of component (no manual timer logic needed)
}
```

## Testing Checklist

After migrating each page, test:

1. ✅ Timer starts when page loads
2. ✅ Timer counts down correctly (every second)
3. ✅ Timer stays in sync across multiple devices
4. ✅ Timer continues when app is backgrounded
5. ✅ Timer expires at 0 and triggers correct action
6. ✅ Timer resets properly when navigating back to page

## Common Issues

### Timer doesn't start
- Check that `gameId` is set before calling `startTimer`
- Check that `timerStartedRef.current` is being set to true
- Verify Supabase columns exist in database

### Timer is out of sync
- Make sure all clients are calling `startTimer` with same duration
- Check that server time fields are being updated in Supabase
- Verify realtime subscription is working

### Timer resets unexpectedly
- Check if `timerStartedRef` is being reset somewhere
- Make sure timer start logic only runs once per page load
- Verify dependencies in useEffect are correct

## Next Steps

1. Apply Supabase schema changes (see SCHEMA_CHANGES.md)
2. Migrate remaining pages one by one
3. Test each page thoroughly
4. Remove old timer-related code
5. Update any timer-related documentation
