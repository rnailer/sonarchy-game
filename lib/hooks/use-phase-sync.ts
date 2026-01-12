/**
 * Phase Synchronization Hook
 *
 * Keeps all players synchronized by:
 * 1. Checking current phase on mount
 * 2. Redirecting if page doesn't match phase
 * 3. Subscribing to phase changes
 * 4. Auto-redirecting when phase changes
 */

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'
import { GamePhase, getCurrentPhase, getPageForPhase, PAGE_TO_PHASE } from '@/lib/game-phases'

// Phase ordering - prevents backwards navigation (except for legitimate round resets)
const PHASE_ORDER: GamePhase[] = [
  'lobby',
  'category_selection',
  'song_selection',
  'players_locked_in',
  'playback',
  'ranking',
  'final_placements',
  'game_complete'
]

interface UsePhaseSyncOptions {
  gameCode: string
  gameId: string | null
  expectedPhase: GamePhase | GamePhase[]
  /** Expected round number (defaults to 1) */
  expectedRound?: number
  /** Additional params to include when redirecting */
  redirectParams?: Record<string, string>
  /** Disable sync (for debugging) */
  disabled?: boolean
}

interface UsePhaseSyncReturn {
  currentPhase: GamePhase | null
  isLoading: boolean
  isCorrectPhase: boolean
}

export function usePhaseSync(options: UsePhaseSyncOptions): UsePhaseSyncReturn {
  const { gameCode, gameId, expectedPhase, expectedRound, redirectParams, disabled } = options
  const router = useRouter()
  const [currentPhase, setCurrentPhase] = useState<GamePhase | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const hasCheckedPhase = useRef(false)
  const hasNavigated = useRef(false)
  const lastPhase = useRef<GamePhase | null>(null)
  const redirectTimeout = useRef<NodeJS.Timeout | null>(null)
  const mountTime = useRef(Date.now())
  const subscriptionRef = useRef<any>(null)
  const retryCount = useRef(0)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const MAX_RETRIES = 3

  // Reset hasNavigated when we're on the correct page
  useEffect(() => {
    const expectedPhases = Array.isArray(expectedPhase) ? expectedPhase : [expectedPhase]
    const isOnValidPhase = expectedPhases.includes(currentPhase as GamePhase)
    if (isOnValidPhase) {
      console.log(`[PhaseSync] On correct page for phase ${currentPhase}, resetting navigation guard`)
      hasNavigated.current = false
    }
  }, [currentPhase, expectedPhase])

  // Cleanup redirect timeout on unmount
  useEffect(() => {
    return () => {
      if (redirectTimeout.current) {
        clearTimeout(redirectTimeout.current)
      }
    }
  }, [])

  // Check phase on mount
  useEffect(() => {
    if (disabled || !gameCode || hasCheckedPhase.current) return

    hasCheckedPhase.current = true

    const checkPhase = async () => {
      console.log(`[PhaseSync] Checking phase for ${gameCode}, expected: ${expectedPhase}, expectedRound: ${expectedRound}`)

      // Fetch both phase AND round from database
      const supabase = createClient()
      const { data: game } = await supabase
        .from('games')
        .select('current_phase, current_round')
        .eq('game_code', gameCode)
        .single()

      if (!game?.current_phase) {
        console.error('[PhaseSync] Could not fetch current phase')
        setIsLoading(false)
        return
      }

      const phase = game.current_phase as GamePhase
      const dbRound = game.current_round || 1
      const expectedRoundNum = expectedRound ?? 1

      const expectedPhases = Array.isArray(expectedPhase) ? expectedPhase : [expectedPhase]
      const primaryExpectedPhase = expectedPhases[0]
      const isOnValidPhase = expectedPhases.includes(phase)

      console.log(`[PhaseSync] Current phase: ${phase} (round ${dbRound}), Expected: ${expectedPhases.join(' or ')} (round ${expectedRoundNum})`)
      setCurrentPhase(phase)

      // CRITICAL: Compare rounds first before comparing phases
      const timeSinceMount = Date.now() - mountTime.current
      let playerIsBehind = false
      let playerIsAhead = false

      if (dbRound > expectedRoundNum) {
        // New round started - player is BEHIND (still on old round's page)
        playerIsBehind = true
        console.log(`[PhaseSync] 🔄 New round started (DB: ${dbRound}, Page: ${expectedRoundNum}) - Player is BEHIND`)
      } else if (dbRound < expectedRoundNum) {
        // Shouldn't happen - player's page is ahead of database round
        console.error(`[PhaseSync] ⚠️ Round went backwards? DB: ${dbRound}, Page: ${expectedRoundNum}`)
        setIsLoading(false)
        return
      } else {
        // Same round - use phase order comparison

        // Special case: ranking → playback is VALID (next song starting)
        // This is NOT a backwards transition
        if (primaryExpectedPhase === 'ranking' && phase === 'playback') {
          console.log(`[PhaseSync] 🎵 ranking → playback: Next song starting, redirecting forward`)
          playerIsBehind = true  // Treat as "behind" so redirect happens
          playerIsAhead = false
        } else {
          // Normal phase order comparison
          const currentIndex = PHASE_ORDER.indexOf(phase)
          const expectedIndex = PHASE_ORDER.indexOf(primaryExpectedPhase)
          playerIsBehind = currentIndex > expectedIndex && expectedIndex >= 0 && !isOnValidPhase
          playerIsAhead = currentIndex < expectedIndex && currentIndex >= 0 && !isOnValidPhase
        }
      }

      if (timeSinceMount < 500 && !playerIsBehind) {
        console.log(`[PhaseSync] In grace period (${timeSinceMount}ms since mount), skipping redirect check`)
        setIsLoading(false)
        return
      }

      // CRITICAL: Never redirect backwards unless it's a legitimate round reset
      // Only redirect forward (player is behind) or to valid phases
      if (playerIsAhead) {
        console.log(`[PhaseSync] ⚠️ Player is AHEAD (expected: ${primaryExpectedPhase}, current: ${phase}) - NOT redirecting backwards`)
        setIsLoading(false)
        return
      }

      if (playerIsBehind) {
        console.log(`[PhaseSync] Player is behind (expected: ${primaryExpectedPhase}, current: ${phase}), redirecting forward`)
      }

      // If phase doesn't match any expected phase, redirect with debouncing
      if (!isOnValidPhase && !hasNavigated.current) {
        console.log(`[PhaseSync] Phase mismatch! Scheduling redirect from ${expectedPhases.join('/')} to ${phase}`)

        if (redirectTimeout.current) {
          clearTimeout(redirectTimeout.current)
        }

        redirectTimeout.current = setTimeout(() => {
          if (!hasNavigated.current && !isOnValidPhase) {
            console.log(`[PhaseSync] Executing redirect to ${phase}`)
            hasNavigated.current = true
            const redirectUrl = getPageForPhase(phase, gameCode, redirectParams)
            router.push(redirectUrl)
          }
        }, 200) // 200ms debounce
      } else {
        setIsLoading(false)
      }
    }

    checkPhase()
  }, [gameCode, expectedPhase, disabled, redirectParams, router])

  // Stabilize dependencies to prevent unnecessary subscription recreation
  const expectedPhaseKey = Array.isArray(expectedPhase)
    ? expectedPhase.slice().sort().join(',')
    : expectedPhase

  const redirectParamsKey = redirectParams
    ? JSON.stringify(redirectParams)
    : ''

  // Subscription effect with retry logic
  useEffect(() => {
    if (disabled || !gameId || !gameCode) return

    const supabase = createClient()
    let isSubscribed = true
    let channel: RealtimeChannel | null = null

    const setupSubscription = () => {
      if (!isSubscribed) return

      // Clean up existing subscription before creating new one
      if (subscriptionRef.current) {
        console.log("[PhaseSync] Cleaning up existing subscription before reconnect")
        supabase.removeChannel(subscriptionRef.current)
        subscriptionRef.current = null
      }

      console.log(`[PhaseSync] Setting up subscription for game ${gameId}`)

      channel = supabase
        .channel(`phase_sync_${gameId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'games',
            filter: `id=eq.${gameId}`,
          },
          async (payload) => {
            if (!isSubscribed) return

            const newPhase = payload.new.current_phase as GamePhase
            const dbRound = payload.new.current_round || 1
            const expectedRoundNum = expectedRound ?? 1

            const expectedPhases = Array.isArray(expectedPhase) ? expectedPhase : [expectedPhase]
            const primaryExpectedPhase = expectedPhases[0]
            const isOnValidPhase = expectedPhases.includes(newPhase)

            console.log(`[PhaseSync] Phase changed to: ${newPhase} (round ${dbRound})`)
            setCurrentPhase(newPhase)

            // CRITICAL: Compare rounds first before comparing phases
            const timeSinceMount = Date.now() - mountTime.current
            let playerIsBehind = false
            let playerIsAhead = false

            if (dbRound > expectedRoundNum) {
              // New round started - player is BEHIND (still on old round's page)
              playerIsBehind = true
              console.log(`[PhaseSync] 🔄 New round started (DB: ${dbRound}, Page: ${expectedRoundNum}) - Player is BEHIND`)
            } else if (dbRound < expectedRoundNum) {
              // Shouldn't happen - player's page is ahead of database round
              console.error(`[PhaseSync] ⚠️ Round went backwards? DB: ${dbRound}, Page: ${expectedRoundNum}`)
              return
            } else {
              // Same round - use phase order comparison

              // Special case: ranking → playback is VALID (next song starting)
              // This is NOT a backwards transition
              if (primaryExpectedPhase === 'ranking' && newPhase === 'playback') {
                console.log(`[PhaseSync] 🎵 ranking → playback: Next song starting, redirecting forward`)
                playerIsBehind = true  // Treat as "behind" so redirect happens
                playerIsAhead = false
              } else {
                // Normal phase order comparison
                const currentIndex = PHASE_ORDER.indexOf(newPhase)
                const expectedIndex = PHASE_ORDER.indexOf(primaryExpectedPhase)
                playerIsBehind = currentIndex > expectedIndex && expectedIndex >= 0 && !isOnValidPhase
                playerIsAhead = currentIndex < expectedIndex && currentIndex >= 0 && !isOnValidPhase
              }
            }

            if (timeSinceMount < 500 && !playerIsBehind) {
              console.log(`[PhaseSync] In grace period (${timeSinceMount}ms since mount), skipping subscription redirect`)
              return
            }

            if (playerIsAhead) {
              console.log(`[PhaseSync] ⚠️ Player is AHEAD (expected: ${primaryExpectedPhase}, current: ${newPhase}) - NOT redirecting backwards`)
              return
            }

            if (!isOnValidPhase && !hasNavigated.current) {
              // Clear any existing redirect timeout
              if (redirectTimeout.current) {
                clearTimeout(redirectTimeout.current)
              }

              if (playerIsBehind) {
                console.log(`[PhaseSync] Player is behind (expected: ${primaryExpectedPhase}, current: ${newPhase}), redirecting forward`)
              }

              console.log(`[PhaseSync] Phase changed, scheduling redirect to ${newPhase} page`)

              // Small delay to let other state settle
              redirectTimeout.current = setTimeout(() => {
                if (!hasNavigated.current && isSubscribed) {
                  hasNavigated.current = true
                  console.log(`[PhaseSync] Executing auto-redirect to ${newPhase}`)
                  const redirectUrl = getPageForPhase(newPhase, gameCode, redirectParams)
                  router.push(redirectUrl)
                }
              }, 100)
            }
          }
        )
        .subscribe((status) => {
          if (!isSubscribed) return

          console.log(`[PhaseSync] Subscription status: ${status}`)

          if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            if (retryCount.current < MAX_RETRIES) {
              const delay = Math.pow(2, retryCount.current) * 1000 // 1s, 2s, 4s
              console.log(`[PhaseSync] ⚠️ Connection failed, retrying in ${delay}ms (attempt ${retryCount.current + 1}/${MAX_RETRIES})`)

              retryTimeoutRef.current = setTimeout(() => {
                if (isSubscribed) {
                  retryCount.current++
                  setupSubscription()
                }
              }, delay)
            } else {
              console.error('[PhaseSync] ❌ Max retries reached, subscription failed permanently')
            }
          } else if (status === 'SUBSCRIBED') {
            retryCount.current = 0 // Reset retry count on successful connection
            subscriptionRef.current = channel
          }
        })
    }

    setupSubscription()

    return () => {
      console.log(`[PhaseSync] Cleaning up subscription for game ${gameId}`)
      isSubscribed = false

      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }

      if (redirectTimeout.current) {
        clearTimeout(redirectTimeout.current)
        redirectTimeout.current = null
      }

      if (channel) {
        supabase.removeChannel(channel)
      }

      subscriptionRef.current = null
      retryCount.current = 0
    }
  }, [gameId, gameCode, expectedPhaseKey, expectedRound, disabled, redirectParamsKey, router])

  const isCorrectPhase = Array.isArray(expectedPhase)
    ? expectedPhase.includes(currentPhase as GamePhase)
    : currentPhase === expectedPhase

  return {
    currentPhase,
    isLoading,
    isCorrectPhase,
  }
}

/**
 * Helper hook for pages that need to know current page path
 */
export function useCurrentPagePhase(pathname: string): GamePhase | null {
  return PAGE_TO_PHASE[pathname] || null
}
