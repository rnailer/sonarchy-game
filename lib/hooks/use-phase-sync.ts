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
  const { gameCode, gameId, expectedPhase, redirectParams, disabled } = options
  const router = useRouter()
  const [currentPhase, setCurrentPhase] = useState<GamePhase | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const hasCheckedPhase = useRef(false)
  const hasNavigated = useRef(false)
  const lastPhase = useRef<GamePhase | null>(null)
  const redirectTimeout = useRef<NodeJS.Timeout | null>(null)
  const mountTime = useRef(Date.now())

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
      console.log(`[PhaseSync] Checking phase for ${gameCode}, expected: ${expectedPhase}`)

      const phase = await getCurrentPhase(gameCode)

      if (!phase) {
        console.error('[PhaseSync] Could not fetch current phase')
        setIsLoading(false)
        return
      }

      const expectedPhases = Array.isArray(expectedPhase) ? expectedPhase : [expectedPhase]
      const primaryExpectedPhase = expectedPhases[0]
      const isOnValidPhase = expectedPhases.includes(phase)

      console.log(`[PhaseSync] Current phase: ${phase}, Expected: ${expectedPhases.join(' or ')}`)
      setCurrentPhase(phase)

      // Grace period: Don't redirect for first 500ms UNLESS player is clearly behind
      const timeSinceMount = Date.now() - mountTime.current
      const currentIndex = PHASE_ORDER.indexOf(phase)
      const expectedIndex = PHASE_ORDER.indexOf(primaryExpectedPhase)
      const playerIsBehind = currentIndex > expectedIndex && expectedIndex >= 0 && !isOnValidPhase
      const playerIsAhead = currentIndex < expectedIndex && currentIndex >= 0 && !isOnValidPhase

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

  // Subscribe to phase changes
  useEffect(() => {
    if (disabled || !gameId || !gameCode) return

    const supabase = createClient()
    let isSubscribed = true

    console.log(`[PhaseSync] Setting up subscription for game ${gameId}`)

    const channel = supabase
      .channel(`phase_sync_${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          if (!isSubscribed) return

          const newPhase = payload.new.current_phase as GamePhase
          const expectedPhases = Array.isArray(expectedPhase) ? expectedPhase : [expectedPhase]
          const primaryExpectedPhase = expectedPhases[0]
          const isOnValidPhase = expectedPhases.includes(newPhase)

          console.log(`[PhaseSync] Phase changed to: ${newPhase}`)
          setCurrentPhase(newPhase)

          // Grace period: Don't redirect for first 500ms UNLESS player is clearly behind
          const timeSinceMount = Date.now() - mountTime.current
          const currentIndex = PHASE_ORDER.indexOf(newPhase)
          const expectedIndex = PHASE_ORDER.indexOf(primaryExpectedPhase)
          const playerIsBehind = currentIndex > expectedIndex && expectedIndex >= 0 && !isOnValidPhase
          const playerIsAhead = currentIndex < expectedIndex && currentIndex >= 0 && !isOnValidPhase

          if (timeSinceMount < 500 && !playerIsBehind) {
            console.log(`[PhaseSync] In grace period (${timeSinceMount}ms since mount), skipping subscription redirect`)
            return
          }

          // CRITICAL: Never redirect backwards unless it's a legitimate round reset
          // Only redirect forward (player is behind) or to valid phases
          if (playerIsAhead) {
            console.log(`[PhaseSync] ⚠️ Player is AHEAD (expected: ${primaryExpectedPhase}, current: ${newPhase}) - NOT redirecting backwards`)
            return
          }

          if (playerIsBehind) {
            console.log(`[PhaseSync] Player is behind (expected: ${primaryExpectedPhase}, current: ${newPhase}), redirecting forward`)
          }

          // If we're on wrong page, redirect with debouncing
          if (!isOnValidPhase && !hasNavigated.current) {
            console.log(`[PhaseSync] Phase changed, scheduling redirect to ${newPhase} page`)

            if (redirectTimeout.current) {
              clearTimeout(redirectTimeout.current)
            }

            redirectTimeout.current = setTimeout(() => {
              if (!hasNavigated.current && !isOnValidPhase) {
                console.log(`[PhaseSync] Executing auto-redirect to ${newPhase}`)
                hasNavigated.current = true
                const redirectUrl = getPageForPhase(newPhase, gameCode, redirectParams)
                router.push(redirectUrl)
              }
            }, 200) // 200ms debounce
          }
        }
      )
      .subscribe((status) => {
        console.log(`[PhaseSync] Subscription status: ${status}`)
      })

    return () => {
      isSubscribed = false
      supabase.removeChannel(channel)
    }
  }, [gameId, gameCode, expectedPhase, disabled, redirectParams, router])

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
