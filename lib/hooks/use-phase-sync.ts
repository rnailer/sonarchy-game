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

interface UsePhaseSyncOptions {
  gameCode: string
  gameId: string | null
  expectedPhase: GamePhase
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
    if (currentPhase === expectedPhase) {
      console.log(`[PhaseSync] On correct page for phase ${expectedPhase}, resetting navigation guard`)
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

      console.log(`[PhaseSync] Current phase: ${phase}, Expected: ${expectedPhase}`)
      setCurrentPhase(phase)

      // Grace period: Don't redirect for first 500ms UNLESS player is clearly behind
      const timeSinceMount = Date.now() - mountTime.current
      const phaseOrder = ['lobby', 'category_selection', 'song_selection', 'players_locked_in', 'playback', 'ranking', 'final_placements', 'game_complete']
      const currentIndex = phaseOrder.indexOf(phase)
      const expectedIndex = phaseOrder.indexOf(expectedPhase)
      const playerIsBehind = currentIndex > expectedIndex && expectedIndex >= 0

      if (timeSinceMount < 500 && !playerIsBehind) {
        console.log(`[PhaseSync] In grace period (${timeSinceMount}ms since mount), skipping redirect check`)
        setIsLoading(false)
        return
      }

      if (playerIsBehind) {
        console.log(`[PhaseSync] Player is behind (expected: ${expectedPhase}, current: ${phase}), redirecting immediately`)
      }

      // If phase doesn't match, redirect with debouncing
      if (phase !== expectedPhase && !hasNavigated.current) {
        console.log(`[PhaseSync] Phase mismatch! Scheduling redirect from ${expectedPhase} to ${phase}`)

        if (redirectTimeout.current) {
          clearTimeout(redirectTimeout.current)
        }

        redirectTimeout.current = setTimeout(() => {
          if (!hasNavigated.current && phase !== expectedPhase) {
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
          console.log(`[PhaseSync] Phase changed to: ${newPhase}`)
          setCurrentPhase(newPhase)

          // Grace period: Don't redirect for first 500ms UNLESS player is clearly behind
          const timeSinceMount = Date.now() - mountTime.current
          const phaseOrder = ['lobby', 'category_selection', 'song_selection', 'players_locked_in', 'playback', 'ranking', 'final_placements', 'game_complete']
          const currentIndex = phaseOrder.indexOf(newPhase)
          const expectedIndex = phaseOrder.indexOf(expectedPhase)
          const playerIsBehind = currentIndex > expectedIndex && expectedIndex >= 0

          if (timeSinceMount < 500 && !playerIsBehind) {
            console.log(`[PhaseSync] In grace period (${timeSinceMount}ms since mount), skipping subscription redirect`)
            return
          }

          if (playerIsBehind) {
            console.log(`[PhaseSync] Player is behind (expected: ${expectedPhase}, current: ${newPhase}), redirecting immediately`)
          }

          // If we're on wrong page, redirect with debouncing
          if (newPhase !== expectedPhase && !hasNavigated.current) {
            console.log(`[PhaseSync] Phase changed, scheduling redirect to ${newPhase} page`)

            if (redirectTimeout.current) {
              clearTimeout(redirectTimeout.current)
            }

            redirectTimeout.current = setTimeout(() => {
              if (!hasNavigated.current && newPhase !== expectedPhase) {
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

  const isCorrectPhase = currentPhase === expectedPhase

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
