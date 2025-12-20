/**
 * React hook for server-synchronized timers
 */

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

interface UseServerTimerOptions {
  gameId: string
  timerType: "song" | "leaderboard" | "category_selection" | "waiting" | "name_vote" | "song_selection"
  onExpire?: () => void
  enabled?: boolean
}

interface UseServerTimerReturn {
  timeRemaining: number
  isExpired: boolean
  startTimer: (duration: number) => Promise<void>
}

const FIELD_MAP = {
  song: "song_start_time",
  leaderboard: "leaderboard_start_time",
  category_selection: "category_selection_start_time",
  waiting: "waiting_start_time",
  name_vote: "name_vote_start_time",
  song_selection: "song_selection_start_time",
} as const

/**
 * Hook for server-synchronized timers
 *
 * Usage:
 * ```tsx
 * const { timeRemaining, isExpired, startTimer } = useServerTimer({
 *   gameId,
 *   timerType: "leaderboard",
 *   onExpire: () => setShowTimeUp(true),
 * })
 *
 * // Start the timer (usually only the host does this)
 * await startTimer(15) // 15 seconds
 * ```
 */
export function useServerTimer(options: UseServerTimerOptions): UseServerTimerReturn {
  const { gameId, timerType, onExpire, enabled = true } = options
  const [timeRemaining, setTimeRemaining] = useState(60) // Show 60 as default instead of 0
  const [isExpired, setIsExpired] = useState(false)
  const [timerVersion, setTimerVersion] = useState(0) // Increment to trigger re-fetch
  const onExpireRef = useRef(onExpire)

  // Keep onExpire ref up to date
  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  const startTimer = async (duration: number) => {
    if (!gameId) {
      console.error(`[ServerTimer] Cannot start timer: gameId is empty`)
      return
    }

    console.log(`[ServerTimer] startTimer called for ${timerType} with duration ${duration}s`)

    const supabase = createClient()
    const field = FIELD_MAP[timerType]
    const durationField = field.replace("_start_time", "_duration")

    console.log(`[ServerTimer] Using fields: ${field}, ${durationField}`)

    // Check if a timer is already running
    const { data: existingGame, error: fetchError } = await supabase
      .from("games")
      .select(`${field}, ${durationField}`)
      .eq("id", gameId)
      .maybeSingle()

    if (fetchError) {
      console.error(`[ServerTimer] Error fetching existing timer:`, fetchError)
      return
    }

    if (existingGame && existingGame[field]) {
      const existingStartTime = new Date(existingGame[field]).getTime()
      const existingDuration = existingGame[durationField] || duration
      const elapsed = Math.floor((Date.now() - existingStartTime) / 1000)

      console.log(`[ServerTimer] Existing timer check for ${timerType}:`, {
        elapsed,
        duration: existingDuration,
        startTime: existingGame[field],
        isExpired: elapsed >= existingDuration,
      })

      // Only skip if timer is actually still running (not expired) and elapsed is valid
      if (elapsed >= 0 && elapsed < existingDuration) {
        console.log(`[ServerTimer] Timer already running for ${timerType} (${existingDuration - elapsed}s remaining), skipping start`)
        return
      }

      console.log(`[ServerTimer] Timer expired or invalid, will restart`)
    }

    // Start new timer
    const now = new Date().toISOString()
    console.log(`[ServerTimer] Writing to database:`, { gameId, field, now, durationField, duration })

    const { data: updateData, error: updateError } = await supabase
      .from("games")
      .update({
        [field]: now,
        [durationField]: duration,
      })
      .eq("id", gameId)
      .select()

    if (updateError) {
      console.error(`[ServerTimer] Error starting timer:`, updateError)
      return
    }

    console.log(`[ServerTimer] ✅ Started ${timerType} timer for ${duration}s at ${now}`)
    console.log(`[ServerTimer] Update result:`, updateData)

    // Trigger re-fetch to start countdown
    setTimerVersion(v => v + 1)
  }

  useEffect(() => {
    if (!enabled || !gameId) return

    const supabase = createClient()
    const field = FIELD_MAP[timerType]
    const durationField = field.replace("_start_time", "_duration")

    let intervalId: NodeJS.Timeout | null = null
    let startTimeCache: string | null = null
    let durationCache: number | null = null

    const calculateRemaining = () => {
      if (!startTimeCache || !durationCache) return 0

      const start = new Date(startTimeCache).getTime()
      const now = Date.now()
      const elapsed = Math.floor((now - start) / 1000)
      const remaining = durationCache - elapsed

      return remaining
    }

    const updateTimer = () => {
      const remaining = calculateRemaining()
      setTimeRemaining(Math.max(0, remaining))

      if (remaining <= 0 && !isExpired) {
        setIsExpired(true)
        onExpireRef.current?.()
      }
    }

    // Fetch initial value
    const fetchInitialValue = async () => {
      const { data, error } = await supabase
        .from("games")
        .select(`${field}, ${durationField}`)
        .eq("id", gameId)
        .maybeSingle()

      if (error) {
        console.error(`[ServerTimer] Error fetching timer:`, error)
        return
      }

      if (data && data[field] && data[durationField]) {
        startTimeCache = data[field]
        durationCache = data[durationField]

        const elapsed = Math.floor((Date.now() - new Date(startTimeCache).getTime()) / 1000)
        const remaining = durationCache - elapsed

        console.log(`[ServerTimer] Loaded ${timerType} timer:`, {
          startTime: startTimeCache,
          duration: durationCache,
          elapsed,
          remaining,
          isExpired: remaining <= 0,
        })

        // Only start interval if timer hasn't expired
        if (remaining > 0) {
          updateTimer()
          // Update every second
          intervalId = setInterval(updateTimer, 1000)
        } else {
          console.warn(`[ServerTimer] Loaded timer is already expired, showing 0`)
          setTimeRemaining(0)
          setIsExpired(true)
        }
      } else {
        console.log(`[ServerTimer] No active ${timerType} timer found`)
      }
    }

    fetchInitialValue()

    // Subscribe to realtime changes
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
          const newStartTime = payload.new[field]
          const newDuration = payload.new[durationField]

          // Only update if the timer was actually reset/changed
          if (newStartTime && newDuration && newStartTime !== startTimeCache) {
            console.log(`[ServerTimer] Timer updated via realtime:`, {
              startTime: newStartTime,
              duration: newDuration,
            })
            startTimeCache = newStartTime
            durationCache = newDuration
            setIsExpired(false)
            updateTimer()
          }
        },
      )
      .subscribe()

    // Handle page visibility changes (when app returns from background)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log(`[ServerTimer] Page visible again, recalculating ${timerType} timer`)
        updateTimer()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    // Cleanup
    return () => {
      if (intervalId) clearInterval(intervalId)
      subscription.unsubscribe()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [enabled, gameId, timerType, isExpired, timerVersion]) // Added timerVersion to trigger re-fetch

  return {
    timeRemaining,
    isExpired,
    startTimer,
  }
}
