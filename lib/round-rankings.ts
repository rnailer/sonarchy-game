"use client"

import { createClient } from "@/lib/supabase/client"

export interface RoundRanking {
  id: string
  game_id: string
  voter_id: string
  round: number
  song_player_id: string
  position: number
}

/**
 * Fetch all rankings for a voter in a specific round
 */
export async function getRoundRankings(
  gameId: string,
  voterId: string,
  round: number
): Promise<RoundRanking[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('round_rankings')
    .select('*')
    .eq('game_id', gameId)
    .eq('voter_id', voterId)
    .eq('round', round)
    .order('position', { ascending: true })

  if (error) {
    console.error('[RoundRankings] Error fetching rankings:', error)
    return []
  }

  return data || []
}

/**
 * Insert a song at a position, shifting others as needed
 */
export async function insertRanking(
  gameId: string,
  voterId: string,
  round: number,
  songPlayerId: string,
  position: number,
  totalSlots: number
): Promise<boolean> {
  const supabase = createClient()

  console.log(`[RoundRankings] Inserting song ${songPlayerId} at position ${position}`)

  // Get current rankings
  const existing = await getRoundRankings(gameId, voterId, round)

  // Check if this song is already ranked
  const existingSongRanking = existing.find(r => r.song_player_id === songPlayerId)
  if (existingSongRanking) {
    console.log('[RoundRankings] Song already ranked, removing old position first')
    await supabase
      .from('round_rankings')
      .delete()
      .eq('id', existingSongRanking.id)

    // Refresh existing after removal
    const refreshed = await getRoundRankings(gameId, voterId, round)
    existing.length = 0
    existing.push(...refreshed)
  }

  // Check if position is occupied
  const occupyingRanking = existing.find(r => r.position === position)

  if (occupyingRanking) {
    // Shift songs down (or up if at bottom)
    const isAtBottom = position === totalSlots

    if (isAtBottom) {
      // Shift songs UP (decrease positions)
      const toShift = existing
        .filter(r => r.position <= position)
        .sort((a, b) => a.position - b.position)

      for (const ranking of toShift) {
        if (ranking.position > 1) {
          await supabase
            .from('round_rankings')
            .update({ position: ranking.position - 1, updated_at: new Date().toISOString() })
            .eq('id', ranking.id)
        }
      }
    } else {
      // Shift songs DOWN (increase positions)
      const toShift = existing
        .filter(r => r.position >= position)
        .sort((a, b) => b.position - a.position) // Start from bottom to avoid conflicts

      for (const ranking of toShift) {
        if (ranking.position < totalSlots) {
          await supabase
            .from('round_rankings')
            .update({ position: ranking.position + 1, updated_at: new Date().toISOString() })
            .eq('id', ranking.id)
        }
      }
    }
  }

  // Insert the new ranking
  const { error } = await supabase
    .from('round_rankings')
    .insert({
      game_id: gameId,
      voter_id: voterId,
      round: round,
      song_player_id: songPlayerId,
      position: position
    })

  if (error) {
    console.error('[RoundRankings] Error inserting ranking:', error)
    return false
  }

  console.log(`[RoundRankings] ✅ Inserted at position ${position}`)
  return true
}

/**
 * Clear all rankings for a voter in a round (for reset)
 */
export async function clearRoundRankings(
  gameId: string,
  voterId: string,
  round: number
): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('round_rankings')
    .delete()
    .eq('game_id', gameId)
    .eq('voter_id', voterId)
    .eq('round', round)

  if (error) {
    console.error('[RoundRankings] Error clearing rankings:', error)
    return false
  }

  return true
}
