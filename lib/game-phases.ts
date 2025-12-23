/**
 * Game Phase State Machine
 *
 * Centralizes game flow control - all players navigate based on DB phase.
 * ONE player triggers phase change, ALL players auto-navigate via subscription.
 */

import { createClient } from "@/lib/supabase/client"

export type GamePhase =
  | 'lobby'
  | 'category_selection'
  | 'song_selection'
  | 'players_locked_in'
  | 'playback'
  | 'ranking'
  | 'final_placements'
  | 'game_complete'

/**
 * Maps each phase to its corresponding page path
 */
export const PHASE_TO_PAGE: Record<GamePhase, string> = {
  lobby: '/game-starting',
  category_selection: '/select-category',
  song_selection: '/pick-your-song',
  players_locked_in: '/playtime-waiting',
  playback: '/playtime-playback',
  ranking: '/leaderboard',
  final_placements: '/final-placements',
  game_complete: '/final-results',
}

/**
 * Reverse mapping: page path to phase
 */
export const PAGE_TO_PHASE: Record<string, GamePhase> = {
  '/game-starting': 'lobby',
  '/select-category': 'category_selection',
  '/pick-your-song': 'song_selection',
  '/playtime-waiting': 'players_locked_in',
  '/playtime-playback': 'playback',
  '/leaderboard': 'ranking',
  '/final-placements': 'final_placements',
  '/final-results': 'game_complete',
}

/**
 * Fetches the current game phase from the database
 */
export async function getCurrentPhase(gameCode: string): Promise<GamePhase | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('games')
    .select('current_phase')
    .eq('game_code', gameCode)
    .single()

  if (error || !data) {
    console.error('[GamePhase] Error fetching phase:', error)
    return null
  }

  return data.current_phase as GamePhase
}

/**
 * Updates the game phase in the database
 * This triggers realtime subscription updates for all connected clients
 */
export async function setGamePhase(gameId: string, phase: GamePhase): Promise<boolean> {
  const supabase = createClient()

  console.log(`[GamePhase] Setting phase to: ${phase}`)

  const { error } = await supabase
    .from('games')
    .update({ current_phase: phase })
    .eq('id', gameId)

  if (error) {
    console.error('[GamePhase] Error setting phase:', error)
    return false
  }

  console.log(`[GamePhase] ✅ Phase updated to: ${phase}`)
  return true
}

/**
 * Gets the full page URL for a given phase, including query params
 */
export function getPageForPhase(
  phase: GamePhase,
  gameCode: string,
  additionalParams?: Record<string, string>
): string {
  const basePath = PHASE_TO_PAGE[phase]
  const params = new URLSearchParams({ code: gameCode })

  // Add any additional params
  if (additionalParams) {
    Object.entries(additionalParams).forEach(([key, value]) => {
      params.set(key, value)
    })
  }

  // Add timestamp to force navigation
  params.set('t', Date.now().toString())

  return `${basePath}?${params.toString()}`
}

/**
 * Helper to determine if a phase transition is valid
 */
export function isValidTransition(from: GamePhase, to: GamePhase): boolean {
  const validTransitions: Record<GamePhase, GamePhase[]> = {
    lobby: ['category_selection'],
    category_selection: ['song_selection'],
    song_selection: ['players_locked_in'],
    players_locked_in: ['playback'],
    playback: ['ranking'],
    ranking: ['playback', 'final_placements'], // Can go to next song or end round
    final_placements: ['category_selection', 'game_complete'], // Next round or game over
    game_complete: [], // Terminal state
  }

  return validTransitions[from]?.includes(to) ?? false
}
