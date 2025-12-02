/**
 * Server-synchronized timer utilities
 *
 * Instead of using local timers (useState + setTimeout) which can desync when
 * apps are backgrounded, we store start times in Supabase and calculate
 * remaining time based on server time.
 */

import { createClient } from "@/lib/supabase/client"

export interface TimerConfig {
  gameId: string
  duration: number // Duration in seconds
  timerType: "song" | "leaderboard" | "category_selection" | "waiting" | "name_vote"
}

/**
 * Start a server-synchronized timer by storing the start time in Supabase
 */
export async function startServerTimer(config: TimerConfig): Promise<void> {
  const supabase = createClient()
  const now = new Date().toISOString()

  const fieldMap = {
    song: "song_start_time",
    leaderboard: "leaderboard_start_time",
    category_selection: "category_selection_start_time",
    waiting: "waiting_start_time",
    name_vote: "name_vote_start_time",
  }

  const field = fieldMap[config.timerType]

  await supabase
    .from("games")
    .update({
      [field]: now,
      [`${field.replace("_time", "")}_duration`]: config.duration,
    })
    .eq("id", config.gameId)

  console.log(`[ServerTimer] Started ${config.timerType} timer for ${config.duration}s`)
}

/**
 * Calculate remaining time based on server start time
 * Returns remaining seconds (can be negative if expired)
 */
export function calculateRemainingTime(startTime: string | null, duration: number): number {
  if (!startTime) return duration

  const start = new Date(startTime).getTime()
  const now = Date.now()
  const elapsed = Math.floor((now - start) / 1000)
  const remaining = duration - elapsed

  return remaining
}

/**
 * Subscribe to timer updates and call callback with remaining time
 */
export function useServerTimer(
  gameId: string,
  timerType: TimerConfig["timerType"],
  onUpdate: (remainingSeconds: number) => void,
): () => void {
  const supabase = createClient()

  const fieldMap = {
    song: "song_start_time",
    leaderboard: "leaderboard_start_time",
    category_selection: "category_selection_start_time",
    waiting: "waiting_start_time",
    name_vote: "name_vote_start_time",
  }

  const field = fieldMap[timerType]
  const durationField = field.replace("_time", "_duration")

  // Subscribe to changes
  const subscription = supabase
    .channel(`timer_${gameId}_${timerType}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "games",
        filter: `id=eq.${gameId}`,
      },
      (payload) => {
        const startTime = payload.new[field]
        const duration = payload.new[durationField]
        if (startTime && duration) {
          const remaining = calculateRemainingTime(startTime, duration)
          onUpdate(remaining)
        }
      },
    )
    .subscribe()

  // Also set up a local interval to update the countdown
  let intervalId: NodeJS.Timeout | null = null

  // Fetch initial value
  supabase
    .from("games")
    .select(`${field}, ${durationField}`)
    .eq("id", gameId)
    .single()
    .then(({ data }) => {
      if (data && data[field] && data[durationField]) {
        const remaining = calculateRemainingTime(data[field], data[durationField])
        onUpdate(remaining)

        // Update every second
        intervalId = setInterval(() => {
          const newRemaining = calculateRemainingTime(data[field], data[durationField])
          onUpdate(newRemaining)
        }, 1000)
      }
    })

  // Cleanup function
  return () => {
    subscription.unsubscribe()
    if (intervalId) {
      clearInterval(intervalId)
    }
  }
}
