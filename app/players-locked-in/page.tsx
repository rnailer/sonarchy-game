"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useServerTimer } from "@/lib/hooks/use-server-timer"
import { usePhaseSync } from '@/lib/hooks/use-phase-sync'
import { setGamePhase } from '@/lib/game-phases'

const SHOW_DEBUG = false

interface Player {
  id: string
  player_name: string
  avatar_id: string
  song_title: string | null
  song_artist: string | null
  has_song: boolean
}

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

const getAvatarImage = (avatarId: string) => {
  const avatarMap: Record<string, string> = {
    vinyl: "/vinyl-deck-sq.png",
    jukebox: "/jukebox-sq.png",
    mp3: "/mp3-player.png",
    cassette: "/sg-casette.png",
    minidisc: "/midi-sq.png",
    boombox: "/beatbox-sq.png",
    walkman: "/walkman.png",
  }
  return avatarMap[avatarId] || "/music-cloud-sq.png"
}

export default function PlayersLockedIn() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const category = searchParams.get("category") || "Songs about cars or driving"
  const gameCode = searchParams.get("code")

  const [isMuted, setIsMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [gameId, setGameId] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [hostName, setHostName] = useState("")
  const [isStarting, setIsStarting] = useState(false)
  const [timerExpired, setTimerExpired] = useState(false)
  const supabase = createClient()

  // Phase sync
  const { currentPhase, isLoading, isCorrectPhase } = usePhaseSync({
    gameCode: gameCode || "",
    gameId: gameId || "",
    expectedPhase: ['song_selection', 'players_locked_in'],
    disabled: !gameCode || !gameId
  })

  // Timer with expiry callback
  const { timeRemaining } = useServerTimer({
    gameId: gameId || undefined,
    timerType: "song_selection",
    enabled: !!gameId,
    onExpire: () => {
      console.log("[v0] Timer expired - enabling Start Playback button")
      setTimerExpired(true)
    }
  })

  useEffect(() => {
    if (!gameCode) return

    const loadGameData = async () => {
      const { data: game } = await supabase
        .from("games")
        .select("id, host_user_id")
        .eq("game_code", gameCode)
        .single()

      if (game) {
        setGameId(game.id)

        // Check if current user is host
        const { data: { user } } = await supabase.auth.getUser()
        if (user && game.host_user_id === user.id) {
          setIsHost(true)
        }

        // Get host name
        const { data: hostPlayer } = await supabase
          .from("game_players")
          .select("player_name")
          .eq("game_id", game.id)
          .eq("user_id", game.host_user_id)
          .single()

        if (hostPlayer) {
          setHostName(hostPlayer.player_name)
        }
      }
    }

    loadGameData()
  }, [gameCode, supabase])

  useEffect(() => {
    if (!gameCode) return

    const fetchPlayers = async () => {
      const { data: game } = await supabase
        .from("games")
        .select("id")
        .eq("game_code", gameCode)
        .single()

      if (!game) return

      const { data: playersData } = await supabase
        .from("game_players")
        .select("id, player_name, avatar_id, song_title, song_artist, song_uri")
        .eq("game_id", game.id)
        .order("joined_at", { ascending: true })

      if (playersData) {
        const formattedPlayers: Player[] = playersData.map((p) => ({
          id: p.id,
          player_name: p.player_name,
          avatar_id: p.avatar_id,
          song_title: p.song_title,
          song_artist: p.song_artist,
          has_song: !!p.song_uri,
        }))
        setPlayers(formattedPlayers)
      }
    }

    fetchPlayers()

    const channel = supabase
      .channel(`game-${gameCode}-players`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_players",
        },
        () => {
          fetchPlayers()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameCode, supabase])

  useEffect(() => {
    audioRef.current = new Audio("https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ClockTick_BW.49759-5tQ73YsHaA1iUYYs96tgX16MIN18cC.wav")
    audioRef.current.loop = true
    audioRef.current.volume = isMuted ? 0 : 0.5
    audioRef.current.play().catch((e) => console.log("[v0] Audio play failed:", e))

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const handleStartPlayback = async () => {
    if (!gameId || !gameCode || isStarting) return

    setIsStarting(true)
    console.log("[v0] Host starting playback...")

    try {
      // Transition to playback phase
      await setGamePhase(gameId, 'playback')
      console.log("[v0] ✅ Phase set to playback")

      // Phase sync will redirect all players
    } catch (error) {
      console.error("[v0] Error starting playback:", error)
      setIsStarting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const initialTime = 60
  const progressPercentage = (timeRemaining / initialTime) * 100
  const playersWithSongs = players.filter(p => p.has_song).length
  const totalPlayers = players.length

  return (
    <div className="min-h-screen bg-[#000022] text-white flex flex-col relative overflow-hidden">
      <header className="fixed top-[72px] left-0 right-0 z-50 flex items-center justify-between px-3 bg-[#000022] pb-4">
        <Link href="/pick-your-song">
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
          PLAYERS LOCKED IN
        </h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMuted(!isMuted)}
          className="text-white hover:bg-white/10 w-[24px] h-[24px] p-0"
        >
          {isMuted ? <VolumeX className="h-[20px] w-[20px]" /> : <Volume2 className="h-[20px] w-[20px]" />}
        </Button>
      </header>

      <div className="fixed top-[124px] left-0 right-0 z-40 bg-[#000022] px-9">
        <div
          className="rounded-2xl"
          style={{
            background: "#262C87",
            border: "2px solid #C7D2FF",
            padding: "12px 8px",
          }}
        >
          <div className="px-2">
            <h3 className="text-[18px] font-semibold text-white leading-tight mb-2">{category}</h3>
            <span
              className="text-[32px] font-extrabold italic text-white leading-none block"
              style={{
                textShadow: "2px 2px 0px #0D113B",
              }}
            >
              {formatTime(timeRemaining)}
            </span>
          </div>

          <div className="px-2 mt-2">
            <div
              className="w-full h-2 rounded-full overflow-hidden"
              style={{
                background: "#C7D2FF",
              }}
            >
              <div
                className="h-full transition-all duration-1000"
                style={{
                  width: `${progressPercentage}%`,
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
          top: "256px",
          bottom: 0,
          borderTopLeftRadius: "24px",
          borderTopRightRadius: "24px",
          borderTop: "3px solid rgb(185, 243, 255)",
          background: "#0D113B",
        }}
      >
        <div className="flex-1 overflow-y-auto px-9 mt-6 pb-24">
          <div className="mb-6 text-center">
            <p className="text-white/70 text-sm mb-2">
              {playersWithSongs}/{totalPlayers} players selected songs
            </p>
            {!timerExpired && hostName && (
              <p className="text-white/70 text-sm">
                Waiting for timer to finish...
              </p>
            )}
            {timerExpired && !isHost && hostName && (
              <p className="text-white/70 text-sm">
                Waiting for {hostName} to start playback...
              </p>
            )}
          </div>

          <div className="space-y-3">
            {players.map((player, index) => {
              const avatarImage = getAvatarImage(player.avatar_id)
              const colorSet = PLAYER_COLOR_SETS[index % PLAYER_COLOR_SETS.length]

              return (
                <div
                  key={player.id}
                  className="rounded-2xl flex items-center justify-between"
                  style={{
                    minHeight: "48px",
                    background: colorSet.bg,
                    border: `2px solid ${colorSet.border}`,
                    padding: "8px 16px 8px 0",
                    opacity: player.has_song ? 1 : 0.5,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 flex items-center justify-center">
                      <img
                        src={avatarImage || "/placeholder.svg"}
                        alt={player.player_name}
                        className="w-10 h-10 object-contain"
                      />
                    </div>
                    <span
                      className="text-[18px] font-semibold text-white"
                      style={{
                        textShadow: `2px 2px 0px ${colorSet.shadow}`,
                      }}
                    >
                      {player.player_name}
                    </span>
                  </div>
                  <div>
                    {player.has_song ? (
                      <span className="text-green-300 text-2xl">✓</span>
                    ) : (
                      <span className="text-white/50 text-2xl">✗</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {isHost && timerExpired && (
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-[#0D113B]">
            <Button
              onClick={handleStartPlayback}
              disabled={isStarting}
              className="w-full h-14 text-xl font-bold"
              style={{
                background: isStarting ? "#666" : "#14B8A6",
                border: "2px solid #D0F5E5",
                boxShadow: "0px 4px 0px 0px #0D9488",
              }}
            >
              {isStarting ? "Starting..." : "Start Playback"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
