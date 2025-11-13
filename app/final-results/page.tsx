"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { Play, Share2, Home } from "lucide-react"
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

export default function FinalResults() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const gameCode = searchParams.get("code")

  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchFinalResults = async () => {
      if (!gameCode) {
        console.log("[v0] ❌ No game code for final results")
        return
      }

      const supabase = createClient()
      if (!supabase) return

      const { data: game } = await supabase.from("games").select("id").eq("game_code", gameCode).single()

      if (!game) {
        console.log("[v0] ❌ Game not found")
        return
      }

      console.log("[v0] 🏆 Calculating final results for game:", game.id)

      // Get all players
      const { data: players } = await supabase
        .from("game_players")
        .select("*")
        .eq("game_id", game.id)
        .order("joined_at", { ascending: true })

      if (!players || players.length === 0) {
        console.log("[v0] ❌ No players found")
        return
      }

      console.log("[v0] 👥 Total players:", players.length)

      // Get all placement votes across all rounds
      const { data: placements } = await supabase.from("leaderboard_placements").select("*").eq("game_id", game.id)

      console.log("[v0] 📊 Total placements:", placements?.length || 0)

      // Calculate scores for each player
      const playerScores = players.map((player, index) => {
        // Get all votes for this player's song
        const votesForPlayer = placements?.filter((p) => p.song_player_id === player.id) || []

        // Calculate total score (lower placement = more points)
        // 1st place = playerCount points, 2nd = playerCount-1, etc.
        const totalScore = votesForPlayer.reduce((sum, vote) => {
          const points = players.length - vote.placement_position + 1
          return sum + points
        }, 0)

        const avgScore = votesForPlayer.length > 0 ? totalScore / votesForPlayer.length : 0

        console.log("[v0] 🎯", player.player_name, "- Total votes:", votesForPlayer.length, "Score:", avgScore)

        return {
          playerId: player.id,
          playerName: player.player_name,
          songTitle: player.song_title || "No Song",
          songArtist: player.song_artist || "",
          albumCover: player.album_cover_url,
          score: avgScore,
          color: PLAYER_COLOR_SETS[index % PLAYER_COLOR_SETS.length].bg,
        }
      })

      // Sort by score (highest first)
      const sortedResults = playerScores.sort((a, b) => b.score - a.score)

      console.log("[v0] 🏆 Final standings:")
      sortedResults.forEach((p, i) => {
        console.log(`[v0] ${i + 1}. ${p.playerName} - ${p.score.toFixed(2)} points`)
      })

      setLeaderboard(sortedResults)
      setIsLoading(false)
    }

    fetchFinalResults()
  }, [gameCode])

  const handlePlayAgain = () => {
    router.push(`/category-selection?code=${gameCode}`)
  }

  const handleShare = () => {
    console.log("[v0] Share results")
    // TODO: Implement share functionality
  }

  const handlePickGame = () => {
    router.push("/")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#000022] text-white flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#8BE1FF] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const topThree = leaderboard.slice(0, 3)
  const [first, second, third] = topThree

  return (
    <div className="min-h-screen bg-[#000022] text-white flex flex-col items-center justify-start px-6 py-12 overflow-y-auto">
      <h1
        className="text-[2.5rem] font-black text-center mb-8 leading-tight"
        style={{
          backgroundImage: "linear-gradient(to bottom, #8BE1FF, #0D91EA)",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        GAME COMPLETE!
      </h1>
      {/* </CHANGE> */}

      <div className="absolute top-20 left-10 text-4xl animate-bounce" style={{ animationDelay: "0s" }}>
        🎵
      </div>
      <div className="absolute top-32 right-12 text-3xl animate-bounce" style={{ animationDelay: "0.2s" }}>
        🎶
      </div>
      <div className="absolute top-24 left-1/4 text-2xl animate-bounce" style={{ animationDelay: "0.4s" }}>
        ✨
      </div>
      <div className="absolute top-28 right-1/4 text-2xl animate-bounce" style={{ animationDelay: "0.6s" }}>
        🎉
      </div>

      <div className="flex items-end justify-center gap-6 mb-12 relative">
        {second && (
          <div className="flex flex-col items-center">
            <p className="text-white font-bold text-lg mb-2">{second.playerName}</p>
            <div
              className="relative flex items-center justify-center mb-2"
              style={{
                width: "90px",
                height: "90px",
                borderRadius: "18px",
                background: "linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)",
                border: "3px solid #0D113B",
                boxShadow: "0 4px 0 0 #8B4513",
              }}
            >
              <span
                className="text-[48px] font-black"
                style={{
                  color: "#0D113B",
                  textShadow: "2px 2px 0px rgba(255, 255, 255, 0.3)",
                }}
              >
                2
              </span>
            </div>
          </div>
        )}

        {first && (
          <div className="flex flex-col items-center">
            <p className="text-white font-bold text-xl mb-2">{first.playerName}</p>
            <div
              className="relative flex items-center justify-center mb-2"
              style={{
                width: "110px",
                height: "110px",
                borderRadius: "22px",
                background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                border: "4px solid #0D113B",
                boxShadow: "0 6px 0 0 #B8860B",
              }}
            >
              <span
                className="text-[64px] font-black"
                style={{
                  color: "#0D113B",
                  textShadow: "2px 2px 0px rgba(255, 255, 255, 0.3)",
                }}
              >
                1
              </span>
            </div>
          </div>
        )}

        {third && (
          <div className="flex flex-col items-center">
            <p className="text-white font-bold text-lg mb-2">{third.playerName}</p>
            <div
              className="relative flex items-center justify-center mb-2"
              style={{
                width: "90px",
                height: "90px",
                borderRadius: "18px",
                background: "linear-gradient(135deg, #CD7F32 0%, #8B4513 100%)",
                border: "3px solid #0D113B",
                boxShadow: "0 4px 0 0 #654321",
              }}
            >
              <span
                className="text-[48px] font-black"
                style={{
                  color: "#0D113B",
                  textShadow: "2px 2px 0px rgba(255, 255, 255, 0.3)",
                }}
              >
                3
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="w-full max-w-md">
        <h2 className="text-[2rem] font-black italic text-white text-center mb-6">Final Standings</h2>

        <div className="space-y-3 mb-8">
          {leaderboard.map((entry, index) => (
            <div
              key={index}
              className="p-4 flex items-center gap-4 rounded-2xl"
              style={{
                background: entry.color,
                border: `3px solid ${entry.color}`,
              }}
            >
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.3)",
                  border: "2px solid rgba(255, 255, 255, 0.5)",
                }}
              >
                <span className="text-[1.5rem] font-black text-white">{index + 1}</span>
              </div>

              <div className="flex-1">
                <h3 className="text-[1.25rem] font-bold text-white leading-tight">{entry.playerName}</h3>
                <p className="text-[0.875rem] text-white/90 leading-tight">
                  {entry.songTitle} - {entry.songArtist}
                </p>
                <p className="text-[0.75rem] text-white/70 leading-tight mt-1">
                  Score: {entry.score.toFixed(1)} points
                </p>
                {/* </CHANGE> */}
              </div>

              {entry.albumCover && (
                <Image
                  src={entry.albumCover || "/placeholder.svg"}
                  alt={`${entry.playerName} avatar`}
                  width={56}
                  height={56}
                  className="rounded-lg object-cover"
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-6 mb-6">
          <button onClick={handlePlayAgain} className="flex flex-col items-center gap-2 group">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
              style={{
                border: "3px solid #C7D2FF",
                background: "transparent",
              }}
            >
              <Play className="w-10 h-10 text-white fill-white" />
            </div>
            <span className="text-white font-semibold text-sm">Play again</span>
          </button>

          <button onClick={handleShare} className="flex flex-col items-center gap-2 group">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
              style={{
                border: "3px solid #C7D2FF",
                background: "transparent",
              }}
            >
              <Share2 className="w-10 h-10 text-white" />
            </div>
            <span className="text-white font-semibold text-sm">Share</span>
          </button>

          <button onClick={handlePickGame} className="flex flex-col items-center gap-2 group">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
              style={{
                border: "3px solid #C7D2FF",
                background: "transparent",
              }}
            >
              <Home className="w-10 h-10 text-white" />
            </div>
            <span className="text-white font-semibold text-sm">Pick game</span>
          </button>
        </div>
      </div>
    </div>
  )
}
