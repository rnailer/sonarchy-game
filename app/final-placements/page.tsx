"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, ChevronUp } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

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

interface PlayerSong {
  round: number
  song_title: string
  song_artist: string
}

interface Player {
  id: string
  player_name: string
  avatar_id: string
  songs: PlayerSong[]
  placement: number
}

function FinalPlacementsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const gameCode = searchParams.get("code")
  const currentRound = parseInt(searchParams.get("round") || "1")

  const [timeRemaining, setTimeRemaining] = useState(10)
  const [players, setPlayers] = useState<Player[]>([])
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set())
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [currentSongPlayerId, setCurrentSongPlayerId] = useState<string | null>(null)
  const hasNavigated = useRef(false)

  useEffect(() => {
    const loadPlayers = async () => {
      if (!gameCode) return

      const supabase = createClient()
      const { data: game } = await supabase
        .from("games")
        .select("id, current_song_player_id")
        .eq("game_code", gameCode)
        .single()

      if (!game) return

      setGameId(game.id)
      setCurrentSongPlayerId(game.current_song_player_id)

      // Get all players
      const { data: gamePlayers } = await supabase
        .from("game_players")
        .select("*")
        .eq("game_id", game.id)
        .order("joined_at", { ascending: true })

      if (!gamePlayers) return

      setTotalPlayers(gamePlayers.length)

      // Get current player's placements for THIS round from leaderboard_placements
      const myPlayerId = localStorage.getItem(`player_id_${gameCode}`)
      const { data: myPlacements } = await supabase
        .from("leaderboard_placements")
        .select("song_player_id, placement_position")
        .eq("game_id", game.id)
        .eq("round_number", currentRound)
        .eq("player_id", myPlayerId)

      const placementsMap: Record<string, number> = {}
      myPlacements?.forEach((p: any) => {
        placementsMap[p.song_player_id] = p.placement_position
      })

      // Show players with their songs from THIS round
      const playerData: Player[] = gamePlayers.map((p, index) => {
        const songs: PlayerSong[] = []

        if (p.song_title && p.song_artist) {
          songs.push({
            round: currentRound,
            song_title: p.song_title,
            song_artist: p.song_artist,
          })
        }

        return {
          id: p.id,
          player_name: p.player_name,
          avatar_id: p.avatar_id,
          songs,
          placement: placementsMap[p.id] || index + 1,
        }
      })

      // Sort by placement
      playerData.sort((a, b) => a.placement - b.placement)
      setPlayers(playerData)
    }

    loadPlayers()
  }, [gameCode, currentRound])

  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setTimeout(() => setTimeRemaining(timeRemaining - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeRemaining === 0 && !hasNavigated.current) {
      handleSubmit()
    }
  }, [timeRemaining])

  const handleSubmit = async () => {
    if (hasNavigated.current || !gameCode || !gameId) return
    hasNavigated.current = true

    console.log("[v0] 🏆 Final placements submitted for round", currentRound)

    const supabase = createClient()
    const myPlayerId = localStorage.getItem(`player_id_${gameCode}`)

    // Save updated placements to database
    for (let i = 0; i < players.length; i++) {
      const player = players[i]
      const position = i + 1

      if (myPlayerId) {
        await supabase.from("leaderboard_placements").upsert({
          game_id: gameId,
          round_number: currentRound,
          player_id: myPlayerId,
          song_player_id: player.id,
          placement_position: position,
        })
      }
    }

    console.log("[v0] ✅ Saved placements for round", currentRound)

    // Check if game should end
    console.log("[v0] 📊 Current round:", currentRound)
    console.log("[v0] 📊 Total players:", totalPlayers)
    console.log("[v0] 🔍 Game should end if:", `${currentRound} >= ${totalPlayers}`)

    if (currentRound >= totalPlayers) {
      // Game complete - go to final results
      console.log("[v0] 🎉 GAME COMPLETE! Going to final results")
      await new Promise((resolve) => setTimeout(resolve, 500))
      const timestamp = Date.now()
      router.push(`/final-results?code=${gameCode}&t=${timestamp}`)
      return
    }

    // Game continues - prepare for next round
    console.log("[v0] 🔄 Game continues to round", currentRound + 1)

    const isSongOwner = myPlayerId === currentSongPlayerId
    const nextRound = currentRound + 1

    // Get all players
    const { data: allPlayers } = await supabase
      .from("game_players")
      .select("*")
      .eq("game_id", gameId)
      .order("joined_at", { ascending: true })

    if (!allPlayers) {
      console.log("[v0] ❌ ERROR: Could not load players")
      return
    }

    let nextCategoryPickerId: string
    let nextPlayerName: string

    // CRITICAL: Only song owner updates database
    if (isSongOwner) {
      console.log("[v0] 🎭 SONG OWNER: Setting up next round")

      // Get players who haven't been category picker yet
      const { data: playersWhoHaventPicked } = await supabase
        .from("game_players")
        .select("id, player_name")
        .eq("game_id", gameId)
        .eq("has_been_category_picker", false)
        .order("joined_at", { ascending: true })

      console.log("[v0] 📊 Players who haven't picked:", playersWhoHaventPicked?.length || 0)

      if (playersWhoHaventPicked && playersWhoHaventPicked.length > 0) {
        // Randomly select from players who haven't picked yet
        const randomIndex = Math.floor(Math.random() * playersWhoHaventPicked.length)
        const selectedPlayer = playersWhoHaventPicked[randomIndex]
        nextCategoryPickerId = selectedPlayer.id
        nextPlayerName = selectedPlayer.player_name

        // Mark this player as having been the category picker
        await supabase
          .from("game_players")
          .update({ has_been_category_picker: true })
          .eq("id", nextCategoryPickerId)
        console.log("[v0] ✅ Marked", selectedPlayer.player_name, "as next category picker")
      } else {
        // Fallback: all players have picked, reset and pick randomly
        console.log("[v0] ⚠️ All players have picked - resetting")

        await supabase
          .from("game_players")
          .update({ has_been_category_picker: false })
          .eq("game_id", gameId)

        const randomIndex = Math.floor(Math.random() * allPlayers.length)
        nextCategoryPickerId = allPlayers[randomIndex].id
        nextPlayerName = allPlayers[randomIndex].player_name

        await supabase
          .from("game_players")
          .update({ has_been_category_picker: true })
          .eq("id", nextCategoryPickerId)

        console.log("[v0] ✅ Selected", nextPlayerName, "after reset")
      }

      // Reset for next round
      await supabase
        .from("games")
        .update({
          current_round: nextRound,
          current_category: null,
          current_song_player_id: null,
          next_category_picker_id: nextCategoryPickerId,
        })
        .eq("id", gameId)

      await supabase
        .from("game_players")
        .update({
          has_selected_category: false,
          song_played: false,
          song_uri: null,
          song_title: null,
          song_artist: null,
          song_preview_url: null,
          album_cover_url: null,
        })
        .eq("game_id", gameId)

      console.log("[v0] 🧹 Reset for round", nextRound)
    } else {
      console.log("[v0] 👥 REGULAR PLAYER: Waiting for song owner")
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Read next category picker from database
      const { data: updatedGame } = await supabase
        .from("games")
        .select("next_category_picker_id")
        .eq("id", gameId)
        .single()

      if (!updatedGame || !updatedGame.next_category_picker_id) {
        console.log("[v0] ❌ ERROR: Next category picker not set!")
        return
      }

      nextCategoryPickerId = updatedGame.next_category_picker_id

      const { data: nextPlayer } = await supabase
        .from("game_players")
        .select("player_name")
        .eq("id", nextCategoryPickerId)
        .single()

      nextPlayerName = nextPlayer?.player_name || "Unknown"
    }

    console.log("[v0] 🎲 Next category picker:", nextPlayerName)
    console.log("[v0] 🎲 Am I next?", myPlayerId === nextCategoryPickerId)

    await new Promise((resolve) => setTimeout(resolve, 800))

    const timestamp = Date.now()

    if (myPlayerId === nextCategoryPickerId) {
      console.log("[v0] ✅ My turn to select category!")
      router.push(`/select-category?code=${gameCode}&round=${nextRound}&t=${timestamp}`)
    } else {
      console.log("[v0] ⏳ Waiting for", nextPlayerName)
      router.push(
        `/playtime-waiting?code=${gameCode}&choosingPlayer=${encodeURIComponent(nextCategoryPickerId)}&t=${timestamp}`,
      )
    }
  }

  const handlePlayerTap = (playerId: string) => {
    if (selectedPlayerId === playerId) {
      setSelectedPlayerId(null)
    } else if (selectedPlayerId === null) {
      setSelectedPlayerId(playerId)
    } else {
      // Move selected player to tapped position
      const selectedIndex = players.findIndex((p) => p.id === selectedPlayerId)
      const targetIndex = players.findIndex((p) => p.id === playerId)

      if (selectedIndex !== -1 && targetIndex !== -1) {
        const newPlayers = [...players]
        const [movedPlayer] = newPlayers.splice(selectedIndex, 1)
        newPlayers.splice(targetIndex, 0, movedPlayer)

        // Update placements
        newPlayers.forEach((p, index) => {
          p.placement = index + 1
        })

        setPlayers(newPlayers)
        setSelectedPlayerId(null)
      }
    }
  }

  const toggleExpand = (playerId: string) => {
    const newExpanded = new Set(expandedPlayers)
    if (newExpanded.has(playerId)) {
      newExpanded.delete(playerId)
    } else {
      newExpanded.add(playerId)
    }
    setExpandedPlayers(newExpanded)
  }

  const getPlayerColorIndex = (playerId: string) => {
    return players.findIndex((p) => p.id === playerId)
  }

  return (
    <div className="min-h-screen bg-[#000022] text-white flex flex-col">
      <header className="fixed top-[72px] left-0 right-0 z-50 flex items-center justify-center px-3 bg-[#000022] pb-4">
        <h1
          className="text-[22px] font-black text-center bg-clip-text text-transparent"
          style={{
            backgroundImage: "linear-gradient(to bottom left, #8BE1FF, #0D91EA)",
          }}
        >
          ROUND {currentRound} PLACEMENTS
        </h1>
      </header>

      <div className="fixed top-[140px] left-0 right-0 z-40 bg-[#000022] px-9">
        <p className="text-[14px] font-normal mb-3 text-center" style={{ color: "#B9F3FF" }}>
          Tap to adjust your rankings for this round
        </p>

        <div
          className="rounded-2xl mb-4"
          style={{
            background: "#262C87",
            border: "2px solid #C7D2FF",
            padding: "12px 16px",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[18px] font-semibold text-white">Time Remaining</span>
            <span
              className="text-[32px] font-extrabold text-white"
              style={{
                textShadow: "2px 2px 0px #0D113B",
              }}
            >
              0:{timeRemaining.toString().padStart(2, "0")}
            </span>
          </div>

          <div className="mt-2">
            <div
              className="w-full h-2 rounded-full overflow-hidden"
              style={{
                background: "#C7D2FF",
              }}
            >
              <div
                className="h-full transition-all duration-1000"
                style={{
                  width: `${(timeRemaining / 10) * 100}%`,
                  background: "#E2A100",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div
        className="fixed left-0 right-0 flex flex-col"
        style={{
          top: "280px",
          bottom: "100px",
          borderTopLeftRadius: "24px",
          borderTopRightRadius: "24px",
          borderTop: "3px solid rgb(185, 243, 255)",
          background: "#0D113B",
          overflowY: "auto",
          padding: "24px",
        }}
      >
        <div className="space-y-3">
          {players.map((player) => {
            const isExpanded = expandedPlayers.has(player.id)
            const isSelected = selectedPlayerId === player.id
            const colorIndex = getPlayerColorIndex(player.id)
            const colors = PLAYER_COLOR_SETS[colorIndex % PLAYER_COLOR_SETS.length]
            const latestSong = player.songs[player.songs.length - 1]

            return (
              <div
                key={player.id}
                onClick={() => handlePlayerTap(player.id)}
                className="rounded-2xl transition-all cursor-pointer"
                style={{
                  background: colors.bg,
                  border: `2px solid ${isSelected ? "#FFD03B" : colors.border}`,
                  boxShadow: isSelected ? "0 0 0 3px rgba(255, 208, 59, 0.3)" : "none",
                  padding: "16px",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-extrabold"
                      style={{
                        background: colors.shadow,
                        color: "white",
                      }}
                    >
                      {player.placement}
                    </div>
                    <div>
                      <div className="text-[18px] font-bold text-white">{player.player_name}</div>
                      {latestSong && (
                        <div className="text-[12px] text-white/70">
                          {latestSong.song_title} - {latestSong.song_artist}
                        </div>
                      )}
                    </div>
                  </div>

                  {player.songs.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleExpand(player.id)
                      }}
                      className="text-white/70 hover:text-white"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  )}
                </div>

                {isExpanded && player.songs.length > 1 && (
                  <div className="mt-3 pt-3 border-t border-white/20 space-y-2">
                    {player.songs.slice(0, -1).map((song, index) => (
                      <div key={index} className="text-[12px] text-white/70">
                        Round {song.round}: {song.song_title} - {song.song_artist}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
        style={{
          background: "linear-gradient(to top, #000022 0%, rgba(0, 0, 34, 0.95) 50%, transparent 100%)",
          paddingTop: "40px",
          paddingBottom: "26px",
        }}
      >
        <button
          onClick={handleSubmit}
          className="w-[calc(100%-72px)] h-[56px] text-[20px] font-bold rounded-[16px] border-2"
          style={{
            background: "#FFD03B",
            border: "2px solid #FFF8C4",
            boxShadow: "0px 4px 0px 0px #7C5100",
            color: "#000033",
          }}
        >
          Confirm Round {currentRound} Placements
        </button>
      </div>
    </div>
  )
}

export default function FinalPlacements() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#000022] text-white flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#8BE1FF] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <FinalPlacementsContent />
    </Suspense>
  )
}
