"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from 'next/navigation'
import Link from "next/link"
import { ArrowLeft } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { usePhaseSync } from '@/lib/hooks/use-phase-sync'
import { setGamePhase } from '@/lib/game-phases'
import { getRoundRankings, insertRanking, type RoundRanking } from '@/lib/round-rankings'

const SHOW_DEBUG = false

const PLAYER_COLOR_SETS = [
  { border: "#C084FC", bg: "#A855F7", shadow: "#7C3AED" },
  { border: "#B9F3FF", bg: "#0891B2", shadow: "#0E7490" },
  { border: "#D2FFFF", bg: "#06B6D4", shadow: "#0891B2" },
  { border: "#FFE5B4", bg: "#FB923C", shadow: "#EA580C" },
  { border: "#FFD0F5", bg: "#EC4899", shadow: "#DB2777" },
  { border: "#C7D2FF", bg: "#4338CA", shadow: "#3730A3" },
  { border: "#FFF8C4", bg: "#FBBF24", shadow: "#F59E0B" },
  { border: "#F5D8FF", bg: "#D946EF", shadow: "#C026D3" },
  { border: "#D0F5E5", bg: "#14B8A6", shadow: "#0D9488" },
  { border: "#E5E7EB", bg: "#6B7280", shadow: "#4B5563" },
]

export default function Leaderboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedCategory = searchParams.get("category") || ""
  const gameCode = searchParams.get("code")
  const roundComplete = searchParams.get("roundComplete") === "true"

  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null)
  const [currentSongPlayerId, setCurrentSongPlayerId] = useState<string>("")
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [currentRound, setCurrentRound] = useState(1)
  const [gameId, setGameId] = useState<string | null>(null)

  // NEW: Round rankings state
  const [rankings, setRankings] = useState<RoundRanking[]>([])
  const [totalSlots, setTotalSlots] = useState(0)
  const [songsWithUri, setSongsWithUri] = useState<any[]>([])

  // Phase sync for ranking/leaderboard
  // Accept both 'ranking' and 'playback' - playback means next song started
  const { currentPhase, isLoading, isCorrectPhase } = usePhaseSync({
    gameCode: gameCode || "",
    gameId: gameId || "",
    expectedPhase: ['ranking', 'playback'],
    expectedRound: currentRound,
    disabled: !gameCode || !gameId
  })

  // Detect when next song starts and navigate to playback
  useEffect(() => {
    if (currentPhase === 'playback' && gameCode) {
      console.log("[v0] 🎵 Next song starting - navigating to playback")
      router.push(`/playtime-playback?code=${gameCode}`)
    }
  }, [currentPhase, gameCode, router])

  // REMOVED: Phase should be set BEFORE navigation, not on page load
  // Pages should not set their own phase - it conflicts with phase sync
  // Phase is set by: playback page (via timer expiration or skip vote)

  const [timeRemaining, setTimeRemaining] = useState(10)
  const [showTimeUp, setShowTimeUp] = useState(false)
  const [timeUpDuration, setTimeUpDuration] = useState(0)

  const [currentSong, setCurrentSong] = useState<any>(null)
  const [allPlayers, setAllPlayers] = useState<any[]>([])
  const [myPlacements, setMyPlacements] = useState<Record<string, number>>({})

  const [isSaving, setIsSaving] = useState(false)
  const [hasPlacedAllSongs, setHasPlacedAllSongs] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false) // NEW: Immediate loading state

  const hasNavigated = useRef(false)
  const isProcessingNavigation = useRef(false)

  const [debugInfo, setDebugInfo] = useState<string[]>([])

  useEffect(() => {
    const fetchGameInfo = async () => {
      if (!gameCode) return

      const supabase = createClient()
      const playerId = localStorage.getItem(`player_id_${gameCode}`)
      setCurrentPlayerId(playerId)

      const { data: game } = await supabase
        .from("games")
        .select("id, current_round, total_rounds, current_song_player_id")
        .eq("game_code", gameCode)
        .single()

      if (game) {
        setGameId(game.id)
        setCurrentRound(game.current_round || 1)
        setCurrentSongPlayerId(game.current_song_player_id || "")
        console.log("[v0] 🎵 Current song player ID from database:", game.current_song_player_id)

        const { data: players } = await supabase
          .from("game_players")
          .select("*")
          .eq("game_id", game.id)
          .order("joined_at", { ascending: true })

        if (players) {
          setTotalPlayers(players.length)
          setAllPlayers(players)
        }

        if (playerId) {
          const { data: placements } = await supabase
            .from("leaderboard_placements")
            .select("song_player_id, placement_position")
            .eq("game_id", game.id)
            .eq("round_number", game.current_round)
            .eq("player_id", playerId)

          if (placements) {
            const placementMap: Record<string, number> = {}
            placements.forEach((p: any) => {
              placementMap[p.song_player_id] = p.placement_position
            })
            setMyPlacements(placementMap)

            const { data: allSongsWithUri } = await supabase
              .from("game_players")
              .select("id")
              .eq("game_id", game.id)
              .not("song_uri", "is", null)

            const totalSongs = allSongsWithUri?.length || 0
            const placedSongs = placements.length

            console.log("[v0] 📊 Placement check:", { placedSongs, totalSongs })
            if (placedSongs >= totalSongs && totalSongs > 0) {
              setHasPlacedAllSongs(true)
              console.log("[v0] ✅ Player has placed all songs!")
            }
          }
        }
      }
    }

    fetchGameInfo()
  }, [gameCode, currentSongPlayerId])

  // NEW: Fetch round rankings and all songs
  useEffect(() => {
    const fetchRankings = async () => {
      if (!gameId || !currentPlayerId) return

      console.log("[v0] 📊 Fetching round rankings for round", currentRound)

      // Fetch existing rankings for this voter
      const existingRankings = await getRoundRankings(gameId, currentPlayerId, currentRound)
      setRankings(existingRankings)
      console.log("[v0] 📊 Found", existingRankings.length, "existing rankings")

      // Fetch all players with songs this round (for total slot count)
      const supabase = createClient()
      const { data: playersWithSongs } = await supabase
        .from("game_players")
        .select("*")
        .eq("game_id", gameId)
        .not("song_uri", "is", null)
        .order("joined_at", { ascending: true })

      if (playersWithSongs) {
        setSongsWithUri(playersWithSongs)

        // Check if current player has a song
        const currentPlayerHasSong = playersWithSongs.some(p => p.id === currentPlayerId)

        // Calculate available slots:
        // - If current player has a song, they can't vote on it, so total slots = playersWithSongs - 1
        // - If current player doesn't have a song, they can vote on all songs
        const availableSlots = currentPlayerHasSong
          ? playersWithSongs.length - 1  // Can't vote on own song
          : playersWithSongs.length       // Can vote on all songs

        setTotalSlots(availableSlots)
        console.log("[v0] 📊 Total players with songs:", playersWithSongs.length)
        console.log("[v0] 📊 Current player has song:", currentPlayerHasSong)
        console.log("[v0] 📊 Available ranking slots:", availableSlots)
      }
    }

    fetchRankings()
  }, [gameId, currentPlayerId, currentRound])

  useEffect(() => {
    const fetchCurrentSong = async () => {
      if (!currentSongPlayerId) return

      const supabase = createClient()
      const { data: player } = await supabase.from("game_players").select("*").eq("id", currentSongPlayerId).single()

      if (player) {
        setCurrentSong(player)
        console.log("[v0] 🎵 Current song being ranked:", player.song_title, "by", player.player_name)
      }
    }

    fetchCurrentSong()
  }, [currentSongPlayerId])

  // Skip timer if round is complete - go straight to navigation logic
  useEffect(() => {
    if (roundComplete && !showTimeUp) {
      console.log("[v0] 🎯 Round complete flag detected - skipping timer, proceeding to next round logic")
      setShowTimeUp(true)
      setTimeRemaining(0)
    }
  }, [roundComplete, showTimeUp])

  useEffect(() => {
    if (timeRemaining > 0 && !showTimeUp && !roundComplete) {
      const timer = setTimeout(() => setTimeRemaining(timeRemaining - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeRemaining === 0 && !showTimeUp) {
      // IMMEDIATELY show loading state before any async work
      setIsNavigating(true)
      setShowTimeUp(true)
    }
  }, [timeRemaining, showTimeUp, roundComplete])

  // Track how long we've been in TIME UP state
  useEffect(() => {
    if (showTimeUp) {
      const timer = setInterval(() => {
        setTimeUpDuration((prev) => prev + 1)
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [showTimeUp])

  useEffect(() => {
    if (
      !showTimeUp ||
      !gameCode ||
      !gameId ||
      !currentSongPlayerId ||
      isProcessingNavigation.current ||
      hasNavigated.current
    ) {
      console.log("[v0] ⏸️ Navigation blocked:", {
        showTimeUp,
        hasGameCode: !!gameCode,
        hasGameId: !!gameId,
        hasSongPlayerId: !!currentSongPlayerId,
        isProcessing: isProcessingNavigation.current,
        hasNavigated: hasNavigated.current,
        isSongOwner: currentPlayerId === currentSongPlayerId,
      })
      return
    }

    const determineNextStep = async () => {
      // Don't run if we're not in ranking phase anymore (fetch fresh to avoid stale closure)
      const supabase = createClient()
      const { data: gameData } = await supabase
        .from("games")
        .select("current_phase")
        .eq("game_code", gameCode)
        .single()

      if (gameData?.current_phase !== 'ranking') {
        console.log("[v0] ⚠️ Not in ranking phase (current:", gameData?.current_phase, "), skipping determineNextStep")
        return
      }

      isProcessingNavigation.current = true

      const isSongOwner = currentPlayerId === currentSongPlayerId
      console.log("[v0] 🎯 === LEADERBOARD NAVIGATION LOGIC ===")
      console.log("[v0] 🎭 Current player ID:", currentPlayerId)
      console.log("[v0] 🎵 Song owner ID:", currentSongPlayerId)
      console.log("[v0] 🎪 Is song owner:", isSongOwner)
      console.log("[v0] ⚠️ SONG OWNER DEBUG: This player", isSongOwner ? "IS" : "IS NOT", "the song owner")

      // Step 1: Get current game state
      const { data: game } = await supabase
        .from("games")
        .select("id, current_round, current_song_player_id, starting_player_index")
        .eq("game_code", gameCode)
        .single()

      if (!game) {
        console.log("[v0] ❌ No game found")
        isProcessingNavigation.current = false
        return
      }

      console.log("[v0] 📊 Current round:", game.current_round)
      console.log("[v0] 📊 Current song player ID from DB:", game.current_song_player_id)

      // Step 2: Get all players
      const { data: allPlayers } = await supabase
        .from("game_players")
        .select("*")
        .eq("game_id", gameId)
        .order("joined_at", { ascending: true })

      const totalPlayerCount = allPlayers?.length || 0
      console.log("[v0] 👥 Total players:", totalPlayerCount)

      // Step 3: Check if all players have ranked current song
      const { data: currentSongPlacements } = await supabase
        .from("leaderboard_placements")
        .select("player_id")
        .eq("game_id", gameId)
        .eq("round_number", game.current_round)
        .eq("song_player_id", currentSongPlayerId)

      const playersWhoRanked = new Set(currentSongPlacements?.map((p) => p.player_id) || [])
      console.log("[v0] 📊 Players who ranked current song:", playersWhoRanked.size, "/", totalPlayerCount)
      console.log("[v0] 📊 TIME UP duration:", timeUpDuration, "seconds")

      // Don't wait for the song owner to rank their own song
      const allPlayersReady = playersWhoRanked.size >= totalPlayerCount - 1

      // After 5 seconds of TIME UP, proceed anyway to avoid infinite waiting
      const forceNavigation = timeUpDuration >= 5

      if (!allPlayersReady && !forceNavigation) {
        console.log("[v0] ⏳ Waiting for more players to rank... (TIME UP for", timeUpDuration, "seconds)")
        console.log("[v0] ⏳ Will force navigation in", 5 - timeUpDuration, "seconds if players don't rank")
        isProcessingNavigation.current = false
        return
      }

      if (forceNavigation && !allPlayersReady) {
        console.log("[v0] ⚠️ FORCING navigation after 5 seconds - not all players ranked")
      }

      console.log("[v0] ✅ All players have ranked! Proceeding...")

      // Step 4: Mark current song as played (single source of truth)
      // CRITICAL: Only song owner should mark to prevent race conditions
      if (isSongOwner) {
        console.log("[v0] 🎭 SONG OWNER: Marking song as played for ID:", currentSongPlayerId)
        await supabase.from("game_players").update({ song_played: true }).eq("id", currentSongPlayerId)
        console.log("[v0] ✅ Marked song as played")
      } else {
        console.log("[v0] ⏳ NON-OWNER: Skipping mark song_played (only song owner does this)")
      }

      // Step 5: Check for next unplayed song in current round (RANDOM ORDER)
      // First, get ALL players to debug
      const { data: allPlayersDebug } = await supabase
        .from("game_players")
        .select("id, player_name, song_uri, song_played, song_title")
        .eq("game_id", gameId)

      console.log("[v0] 🔍 DEBUG - ALL PLAYERS STATE:")
      allPlayersDebug?.forEach((p) => {
        console.log(
          `[v0]   - ${p.player_name}: song_uri=${p.song_uri ? "SET (" + p.song_uri.substring(0, 20) + "...)" : "NULL"}, song_played=${p.song_played}, song="${p.song_title || "none"}"`,
        )
      })

      const { data: unplayedSongs } = await supabase
        .from("game_players")
        .select("id, player_name, song_title")
        .eq("game_id", gameId)
        .not("song_uri", "is", null)
        .eq("song_played", false)

      // Randomize the order instead of sequential by joined_at
      const shuffledSongs = unplayedSongs?.sort(() => Math.random() - 0.5) || []

      console.log("[v0] 🔍 Unplayed songs remaining:", shuffledSongs.length)

      if (shuffledSongs.length > 0) {
        // More songs to play in this round (RANDOM ORDER)
        console.log("[v0] ➡️ Moving to next song (random):", shuffledSongs[0].song_title)

        // CRITICAL: Only song owner should update database to prevent race conditions
        if (isSongOwner) {
          console.log("[v0] 🎭 SONG OWNER: Setting next song as current")
          // Set next song as current (synchronized for all clients)
          await supabase.from("games").update({ current_song_player_id: shuffledSongs[0].id }).eq("id", gameId)

          // CRITICAL: Clear old timer before starting next song
          console.log("[v0] 🧹 Clearing old timer for next song...")
          await supabase.from("games").update({
            song_start_time: null,
            song_duration: null
          }).eq("id", gameId)

          // Set phase to playback BEFORE navigating
          console.log("[v0] 🔄 Setting phase to playback for next song...")
          await setGamePhase(gameId, 'playback')
          console.log("[v0] ✅ Phase set to playback - ALL players will be redirected")
        } else {
          console.log("[v0] ⏳ NON-OWNER: Waiting for song owner to set next song and phase")
          // Wait for song owner to complete database updates
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }

        // CRITICAL: Set navigation guard BEFORE any async operations
        if (hasNavigated.current) {
          console.log("[v0] ⚠️ Navigation already in progress, skipping")
          return
        }
        hasNavigated.current = true

        await new Promise((resolve) => setTimeout(resolve, 500))

        // Navigate to playback (phase sync will also handle this for other players)
        const timestamp = Date.now()
        router.push(
          `/playtime-playback?category=${encodeURIComponent(selectedCategory)}&code=${gameCode}&t=${timestamp}`,
        )
        return
      }

      // Step 6: All songs in round complete - navigate to final placements for this round
      console.log("[v0] ========================================")
      console.log("[v0] 🎯 ROUND COMPLETE - GOING TO FINAL PLACEMENTS")
      console.log("[v0] ========================================")
      console.log("[v0] 📊 Current round:", game.current_round)
      console.log("[v0] 📊 Total players:", totalPlayerCount)
      console.log("[v0] 📊 All players:", allPlayers.map(p => p.player_name).join(", "))
      console.log("[v0] 📊 Game will end after placements if:", `${game.current_round} >= ${totalPlayerCount}`)
      console.log("[v0] ========================================")

      // Update debug panel
      setDebugInfo([
        `🎯 ROUND ${game.current_round} COMPLETE`,
        `📊 Current round: ${game.current_round}`,
        `📊 Total players: ${totalPlayerCount}`,
        `📊 Going to: Final Placements for Round ${game.current_round}`,
        `📊 After placements: ${game.current_round >= totalPlayerCount ? "FINAL RESULTS" : "ROUND " + (game.current_round + 1)}`,
      ])

      // CRITICAL: Set navigation guard BEFORE any async operations
      if (hasNavigated.current) {
        console.log("[v0] ⚠️ Navigation already in progress, skipping final placements redirect")
        return
      }
      hasNavigated.current = true

      console.log("[v0] 🏆 Navigating to final placements for round", game.current_round)
      console.log("[v0] 🎭 Song owner for this round:", currentSongPlayerId)

      // NEW: Transition to final_placements phase
      // CRITICAL: Only song owner sets phase (consistent with other pages)
      if (isSongOwner) {
        console.log("[v0] 🔄 SONG OWNER: Transitioning to final_placements phase...")
        await setGamePhase(gameId, 'final_placements')
        console.log("[v0] ✅ Phase transition complete - ALL players will be redirected")
      } else {
        console.log("[v0] ⏳ Regular player waiting for song owner to trigger phase transition")
      }

      await new Promise((resolve) => setTimeout(resolve, 800))

      // KEEP existing navigation as fallback
      const timestamp = Date.now()
      // Only include songOwnerId if it's not empty (prevents TypeError in final-placements)
      const songOwnerParam = currentSongPlayerId ? `&songOwnerId=${currentSongPlayerId}` : ""
      router.push(`/final-placements?code=${gameCode}&round=${game.current_round}${songOwnerParam}&t=${timestamp}`)
      return
    }

    // Poll every 2 seconds to check if ready to navigate
    const pollInterval = setInterval(determineNextStep, 2000)
    determineNextStep() // Initial check

    return () => {
      clearInterval(pollInterval)
    }
  }, [showTimeUp, gameCode, gameId, currentSongPlayerId, currentRound, selectedCategory, router, timeUpDuration])

  const handlePlaceSong = async (position: number) => {
    if (!currentPlayerId || !gameId || !currentSong || isSaving) return

    setIsSaving(true)

    console.log("[v0] 💾 Placing song at position:", position)

    // Use new round rankings system
    const success = await insertRanking(
      gameId,
      currentPlayerId,
      currentRound,
      currentSong.id,
      position,
      totalSlots
    )

    if (success) {
      // Refresh rankings display
      const updatedRankings = await getRoundRankings(gameId, currentPlayerId, currentRound)
      setRankings(updatedRankings)
      console.log("[v0] ✅ Ranking updated, now have", updatedRankings.length, "songs ranked")

      // Check if all songs are ranked
      if (updatedRankings.length >= totalSlots && totalSlots > 0) {
        console.log("[v0] ✅ All songs placed!")
        setHasPlacedAllSongs(true)
      }

      // Update old placements map for compatibility with existing code
      const newPlacements = { ...myPlacements, [currentSong.id]: position }
      setMyPlacements(newPlacements)
    } else {
      console.error("[v0] ❌ Failed to insert ranking")
    }

    setIsSaving(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const isCurrentPlayerSongOwner = currentPlayerId === currentSongPlayerId

  const getPlayerColorIndex = (playerId: string) => {
    const index = allPlayers.findIndex((p) => p.id === playerId)
    return index >= 0 ? index : 0
  }

  if (!currentSong) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-purple-500 mx-auto mb-4" />
          <p className="text-white text-xl">Loading...</p>
        </div>
      </div>
    )
  }

  const songPlayerColorIndex = getPlayerColorIndex(currentSongPlayerId)
  const songPlayerColor = PLAYER_COLOR_SETS[songPlayerColorIndex % PLAYER_COLOR_SETS.length]

  // Show loading state immediately when navigating
  if (isNavigating) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-purple-500 mx-auto mb-4" />
          <p className="text-white text-xl">Loading next phase...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#000022] text-white flex flex-col">
      {SHOW_DEBUG && debugInfo.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white p-2 text-xs max-h-48 overflow-y-auto">
          <div className="font-bold mb-1">🔍 DEBUG: Round Rotation Decision</div>
          {debugInfo.map((info, i) => (
            <div key={i} className="font-mono">
              {info}
            </div>
          ))}
        </div>
      )}

      <header className="fixed top-[4.5rem] left-0 right-0 z-50 flex items-center justify-between px-3 bg-[#000022] pb-4">
        <Link href="/playtime-playback">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 w-6 h-6 p-0">
            <ArrowLeft className="h-6 w-6" />
          </Button>
        </Link>
        <h1
          className="text-[1.375rem] font-black text-center leading-tight bg-clip-text text-transparent"
          style={{
            backgroundImage: "linear-gradient(to bottom left, #8BE1FF, #0D91EA)",
          }}
        >
          LEADERBOARD - ROUND {currentRound}
        </h1>
        <div className="w-6" />
      </header>

      <div
        className="fixed left-0 right-0 bottom-0 overflow-y-auto"
        style={{
          top: "8.75rem",
          borderTopLeftRadius: "1.5rem",
          borderTopRightRadius: "1.5rem",
          borderTop: "0.1875rem solid rgb(185, 243, 255)",
          background: "#0D113B",
        }}
      >
        <div style={{ padding: "1.5rem 1.5rem 1.5rem" }}>
          <div className="flex items-end justify-center gap-4 mb-6">
            <div className="flex flex-col items-center">
              <div
                className="relative flex items-center justify-center mb-2"
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "16px",
                  background: "linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)",
                  border: "3px solid #0D113B",
                  boxShadow: "0 4px 0 0 #8B4513",
                }}
              >
                <span
                  className="text-[40px] font-black"
                  style={{
                    color: "#0D113B",
                    textShadow: "2px 2px 0px rgba(255, 255, 255, 0.3)",
                  }}
                >
                  2
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div
                className="relative flex items-center justify-center mb-2"
                style={{
                  width: "100px",
                  height: "100px",
                  borderRadius: "20px",
                  background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                  border: "4px solid #0D113B",
                  boxShadow: "0 6px 0 0 #B8860B",
                }}
              >
                <span
                  className="text-[56px] font-black"
                  style={{
                    color: "#0D113B",
                    textShadow: "2px 2px 0px rgba(255, 255, 255, 0.3)",
                  }}
                >
                  1
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div
                className="relative flex items-center justify-center mb-2"
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "16px",
                  background: "linear-gradient(135deg, #CD7F32 0%, #8B4513 100%)",
                  border: "3px solid #0D113B",
                  boxShadow: "0 4px 0 0 #654321",
                }}
              >
                <span
                  className="text-[40px] font-black"
                  style={{
                    color: "#0D113B",
                    textShadow: "2px 2px 0px rgba(255, 255, 255, 0.3)",
                  }}
                >
                  3
                </span>
              </div>
            </div>
          </div>

          <div className="mb-6 p-4 rounded-xl bg-[#000022] border-2 border-[#8BE1FF]">
            <div className="flex items-center gap-3 mb-2">
              <img
                src={currentSong?.album_cover_url || "/placeholder.svg"}
                alt="Album cover"
                className="w-16 h-16 rounded-lg"
              />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">{currentSong?.song_title}</h3>
                <p className="text-sm text-[#8BE1FF]">{currentSong?.song_artist}</p>
                <p className="text-xs text-white/70 mt-1">by {currentSong?.player_name}</p>
              </div>
            </div>
          </div>

          <div
            className="mb-6 p-4 flex items-center justify-between"
            style={{
              borderRadius: "1rem",
              border: "2px solid #C7D2FF",
              background: "#4A5FD9",
            }}
          >
            <div className="flex-1">
              {showTimeUp ? (
                <p className="text-[1.5rem] font-black italic text-white">TIME UP</p>
              ) : isCurrentPlayerSongOwner ? (
                <p className="text-[1rem] font-medium text-white">Your song is being ranked, good luck!</p>
              ) : (
                <p className="text-[1rem] font-medium text-white">Tap position to rank.</p>
              )}
              <p className="text-[2rem] font-black text-white leading-none mt-1">{formatTime(timeRemaining)}</p>
            </div>
            {!showTimeUp && !isCurrentPlayerSongOwner && (
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                />
              </svg>
            )}
          </div>

          {!isCurrentPlayerSongOwner && (
            <div className="space-y-3">
              {Array.from({ length: totalSlots || totalPlayers }).map((_, index) => {
                const position = index + 1

                // Find what song is ranked at this position
                const rankedSong = rankings.find(r => r.position === position)
                const rankedPlayer = rankedSong ? songsWithUri.find(p => p.id === rankedSong.song_player_id) : null

                // Check if this is the current song being ranked
                const isCurrentSong = rankedSong?.song_player_id === currentSong?.id

                // Get color for the ranked song
                const rankedPlayerColorIndex = rankedPlayer ? getPlayerColorIndex(rankedPlayer.id) : 0
                const rankedPlayerColor = PLAYER_COLOR_SETS[rankedPlayerColorIndex % PLAYER_COLOR_SETS.length]

                return (
                  <button
                    key={position}
                    onClick={() => handlePlaceSong(position)}
                    disabled={isSaving}
                    className={`w-full p-4 rounded-xl flex items-center gap-3 transition-all ${
                      isCurrentSong ? "ring-2 ring-yellow-400" : ""
                    }`}
                    style={{
                      background: rankedSong ? rankedPlayerColor.bg : "#0D113B",
                      border: rankedSong
                        ? `2px solid ${rankedPlayerColor.border}`
                        : "2px dashed #4A5FD9",
                      boxShadow: rankedSong ? `0 4px 0 0 ${rankedPlayerColor.shadow}` : "none",
                    }}
                  >
                    {rankedSong && rankedPlayer ? (
                      <>
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
                          style={{ background: rankedPlayerColor.border, color: rankedPlayerColor.shadow }}
                        >
                          {position}
                        </div>
                        <img
                          src={rankedPlayer.album_cover_url || "/placeholder.svg"}
                          alt="Album cover"
                          className="w-12 h-12 rounded-lg flex-shrink-0"
                        />
                        <div className="flex-1 text-left min-w-0">
                          <div className="text-sm font-bold text-white truncate">{rankedPlayer.song_title}</div>
                          <div className="text-xs text-white/80 truncate">{rankedPlayer.song_artist}</div>
                          <div
                            className="text-xs font-semibold mt-1 truncate"
                            style={{ color: rankedPlayerColor.border }}
                          >
                            by {rankedPlayer.player_name}
                          </div>
                        </div>
                        {isCurrentSong && (
                          <div className="text-yellow-400 text-xs font-bold">CURRENT</div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xl font-bold">{position}</span>
                        </div>
                        <span className="flex-1 text-left">Tap to place at #{position}</span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {isCurrentPlayerSongOwner && (
            <div className="text-center text-white/70 py-8">
              <p className="text-lg">Other players are ranking your song...</p>
              <p className="text-sm mt-2">Good luck!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}