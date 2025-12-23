"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useServerTimer } from "@/lib/hooks/use-server-timer";

export default function WaitingForSongs() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const gameCode = searchParams.get("code")
  const category = searchParams.get("category")
  const supabase = createClient()

  const [playersReady, setPlayersReady] = useState(0)
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [gameId, setGameId] = useState<string | null>(null)
  const hasNavigated = useRef(false)

  // Use server-synchronized timer from song selection phase
  const { timeRemaining } = useServerTimer({
    gameId: gameId || undefined,
    timerType: "song_selection",
    enabled: !!gameId,
    onExpire: () => {
      if (hasNavigated.current) return
      hasNavigated.current = true
      console.log("[v0] Time's up! Navigating to name vote...")
      router.push(`/playtime-name-vote?category=${encodeURIComponent(category || "")}&code=${gameCode}`)
    },
  })

  useEffect(() => {
    console.log("[v0] WaitingForSongs page loaded, game code:", gameCode)

    if (!supabase || !gameCode) {
      console.log("[v0] No Supabase or game code")
      return
    }

    const loadGameData = async () => {
      // Get game
      const { data: game } = await supabase.from("games").select("*").eq("game_code", gameCode).single()

      if (!game) {
        console.log("[v0] No game found")
        return
      }

      // Set gameId for server timer
      setGameId(game.id)

      // Get all players
      const { data: players } = await supabase.from("game_players").select("*").eq("game_id", game.id)

      if (!players) {
        console.log("[v0] No players found")
        return
      }

      setTotalPlayers(players.length)

      // Count players who have picked songs (have song_uri set)
      const ready = players.filter((p) => p.song_uri).length
      setPlayersReady(ready)

      console.log("[v0] Players ready:", ready, "Total players:", players.length)

      // If all players ready, navigate to name vote
      if (ready === players.length && !hasNavigated.current) {
        console.log("[v0] All players ready! Navigating to name vote...")
        hasNavigated.current = true
        setTimeout(() => {
          router.push(`/playtime-name-vote?category=${encodeURIComponent(category || "")}&code=${gameCode}`)
        }, 1000)
      }
    }

    loadGameData()

    // Subscribe to player updates
    const channel = supabase
      .channel(`game_${gameCode}_songs`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_players",
        },
        (payload) => {
          console.log("[v0] Player updated:", payload)
          loadGameData()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameCode, category, supabase, router])

  const progressPercentage = (playersReady / totalPlayers) * 100

  return (
    <div className="min-h-screen bg-[#000022] text-white flex flex-col">
      <header className="fixed top-[72px] left-0 right-0 z-50 flex items-center justify-between px-3 bg-[#000022] pb-4">
        <Link href={`/pick-your-song?category=${encodeURIComponent(category || "")}&code=${gameCode}`}>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 w-[24px] h-[24px] p-0">
            <ArrowLeft className="h-[24px] w-[24px]" />
          </Button>
        </Link>
        <h1
          className="text-[22px] font-black text-center bg-clip-text text-transparent"
          style={{
            backgroundImage: "linear-gradient(to bottom left, #8BE1FF, #0D91EA)",
          }}
        >
          WAITING FOR PLAYERS
        </h1>
        <div className="w-[24px]" />
      </header>

      <div
        className="flex-1 flex flex-col items-center justify-center mt-[140px] w-full relative"
        style={{
          borderTopLeftRadius: "24px",
          borderTopRightRadius: "24px",
          borderTop: "3px solid rgb(185, 243, 255)",
          background: "#0D113B",
          padding: "36px",
        }}
      >
        <p className="text-[20px] font-light text-[#B9F3FF] text-center mb-12 leading-relaxed">
          Waiting for other players to pick their songs...
        </p>

        <div
          className="relative flex items-center justify-center mb-8"
          style={{
            width: "280px",
            height: "280px",
            background: "#262C87",
            borderRadius: "50%",
          }}
        >
          <div
            className="flex flex-col items-center justify-center"
            style={{
              width: "242px",
              height: "242px",
              background: "transparent",
              border: "1px solid #D8D8E0",
              borderRadius: "50%",
            }}
          >
            <div
              className="text-[64px] font-extrabold text-white leading-none"
              style={{
                textShadow: "4px 4px 0px #0D113B",
              }}
            >
              {playersReady}/{totalPlayers}
            </div>
            <div className="text-[18px] font-semibold text-white mt-2">Players Ready</div>
          </div>
        </div>

        <div className="w-full max-w-md">
          <div
            className="w-full h-4 rounded-full overflow-hidden mb-2"
            style={{
              background: "#262C87",
            }}
          >
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${progressPercentage}%`,
                background: "#FFD03B",
              }}
            />
          </div>
          <p className="text-[14px] text-center" style={{ color: "#B9F3FF" }}>
            Time remaining: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, "0")}
          </p>
        </div>
      </div>
    </div>
  )
}
